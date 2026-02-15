import { supabaseAdmin } from '@/lib/supabase/server'
import { getAIClient, mapModel } from '@/lib/ai/client'

export interface ScoringDimension {
  name: string
  description: string
  maxScore: number
  scoringCriteria: string[]
}

export const STANDARD_DIMENSIONS: ScoringDimension[] = [
  {
    name: 'role_depth',
    description: 'Role-specific depth and correctness of domain knowledge',
    maxScore: 30,
    scoringCriteria: [
      'Demonstrates accurate domain concepts and constraints',
      'Applies role-relevant frameworks appropriately',
      'Avoids factual errors or invented capabilities'
    ]
  },
  {
    name: 'reasoning',
    description: 'Reasoning and problem decomposition quality',
    maxScore: 20,
    scoringCriteria: [
      'Breaks down the problem into logical steps',
      'Explains tradeoffs and priorities',
      'Connects reasoning to constraints'
    ]
  },
  {
    name: 'verification',
    description: 'Verification and evidence discipline',
    maxScore: 20,
    scoringCriteria: [
      'Mentions validation, testing, or proof strategy',
      'Avoids overconfident claims without a check',
      'Uses evidence or data to support claims'
    ]
  },
  {
    name: 'communication',
    description: 'Communication clarity and structure',
    maxScore: 15,
    scoringCriteria: [
      'Clear, concise, and structured responses',
      'Uses appropriate tone for the role',
      'Avoids ambiguity and filler'
    ]
  },
  {
    name: 'reliability',
    description: 'Reliability, ownership, and accountability',
    maxScore: 15,
    scoringCriteria: [
      'Shows ownership of outcomes and next steps',
      'Makes realistic commitments',
      'Communicates risks and mitigations'
    ]
  }
]

export interface TruthLogEntry {
  claim: string
  evidence: string
  timestamp: string
}

export interface ScoringResult {
  dimension: string
  score: number
  confidence: number
  reasoning: string
  evidence: TruthLogEntry[]
}

export async function generateFollowups(
  content: string,
  dimensionScores: Record<string, number>,
  evidenceQuotes: Array<{ dimension: string; quote: string }>
): Promise<string[]> {
  if (!content || evidenceQuotes.length === 0) return []

  const prompt = `You are an interviewer assistant. Create 3-5 concise follow-up questions.

Inputs:
- Dimension scores (0-100 scaled or raw): ${JSON.stringify(dimensionScores)}
- Evidence quotes: ${JSON.stringify(evidenceQuotes.slice(0, 5))}

Rules:
- Target the weakest dimensions first.
- Ask probing questions that elicit evidence or clarification.
- Keep each question under 20 words.
- Return JSON: {"followups": ["Q1", "Q2", ...]}`

  try {
    const completion = await getAIClient().chat.completions.create({
      model: mapModel('gpt-4o'),
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: { type: 'json_object' },
      max_tokens: 200
    })

    const result = JSON.parse(completion.choices[0].message.content || '{}')
    const followups = Array.isArray(result.followups) ? result.followups.map(String) : []
    return followups.slice(0, 5)
  } catch (error) {
    console.error('Follow-up generation error:', error)
    return []
  }
}

export async function scoreArtifact(
  sessionId: string,
  roundId: string,
  artifactId: string,
  artifactContent: string,
  dimensions: ScoringDimension[],
  track?: string
): Promise<ScoringResult[]> {
  const results: ScoringResult[] = []

  for (const dimension of dimensions) {
    const prompt = `You are ScoreSmith, an evidence-based interview scoring system.

Task: Score the following sales interaction on the dimension "${dimension.name}".

Dimension: ${dimension.name}
Description: ${dimension.description}
Max Score: ${dimension.maxScore}

Scoring Criteria:
${dimension.scoringCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Content to Score:
${artifactContent}

Instructions:
1. Read the content carefully
2. For each criterion, identify specific evidence (quotes) that support or contradict it
3. Calculate a score from 0 to ${dimension.maxScore}
4. Provide confidence level (0.0 to 1.0)
5. Write a brief reasoning explaining the score

Respond in JSON format:
{
  "score": <number 0-${dimension.maxScore}>,
  "confidence": <number 0.0-1.0>,
  "reasoning": "<brief explanation>",
  "evidence": [
    {"rubric_clause": "<criterion>", "quote": "<quote from content>", "timestamp": "<when in interaction>"}
  ]
}

Be strict and evidence-based. Only award points where there is clear evidence.
If you cannot provide evidence, return score 0 and an empty evidence array.`

    try {
      const completion = await getAIClient().chat.completions.create({
        model: mapModel('gpt-4o'),
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      })

      const result = JSON.parse(completion.choices[0].message.content || '{}')

      // Check for red flags — emit as live_events for realtime propagation
      await detectRedFlags(sessionId, Number(roundId), dimension.name, result, artifactContent, track)

      const evidence = Array.isArray(result.evidence) ? result.evidence : []
      const hasEvidence = evidence.length > 0

      results.push({
        dimension: dimension.name,
        score: hasEvidence ? result.score : 0,
        confidence: hasEvidence ? result.confidence : 0,
        reasoning: hasEvidence
          ? result.reasoning
          : 'No evidence provided. Score invalidated.',
        evidence: evidence.map((item: any) => ({
          claim: item.rubric_clause || item.claim || '',
          evidence: item.quote || item.evidence || '',
          timestamp: item.timestamp || ''
        }))
      })
    } catch (error) {
      console.error(`Scoring error for ${dimension.name}:`, error)
    }
  }

  return results
}

import { TRACK_FLAG_FILTERS } from '@/lib/constants/red-flags'
import { emitRedFlag } from '@/lib/db/helpers'

async function detectRedFlags(
  sessionId: string,
  roundNumber: number,
  dimension: string,
  scoringResult: any,
  content: string,
  track?: string
): Promise<Array<{ flag_type: string; severity: string; auto_stop: boolean }>> {
  const detected: Array<{ flag_type: string; severity: string; auto_stop: boolean }> = []
  const evidence = Array.isArray(scoringResult?.evidence) ? scoringResult.evidence : []
  if (evidence.length === 0) return detected

  const checks = [
    { dimension: 'reliability', condition: scoringResult.score < 8, flag_type: 'overpromising' as const, severity: 'critical' as const, description: 'Candidate may have overpromised or made false claims', auto_stop: true },
    { dimension: 'communication', condition: scoringResult.score < 8, flag_type: 'conflict_escalation' as const, severity: 'critical' as const, description: 'Communication suggests escalation risk or poor conflict handling', auto_stop: true },
    { dimension: 'verification', condition: scoringResult.score < 10, flag_type: 'overconfident_without_verification' as const, severity: 'critical' as const, description: 'Overconfident claims without a verification plan', auto_stop: true },
    { dimension: 'verification', condition: scoringResult.score < 5, flag_type: 'no_testing_mindset' as const, severity: 'critical' as const, description: 'No evidence of testing mindset or quality assurance thinking', auto_stop: true },
    { dimension: 'role_depth', condition: scoringResult.score < 15, flag_type: 'unsafe_data_handling' as const, severity: 'critical' as const, description: 'Potential unsafe handling of sensitive data or security gaps', auto_stop: true },
  ]

  for (const check of checks) {
    if (check.dimension !== dimension || !check.condition) continue

    const allowedTracks = TRACK_FLAG_FILTERS[check.flag_type]
    if (allowedTracks && track && !allowedTracks.includes(track)) continue

    await emitRedFlag(sessionId, {
      flag_type: check.flag_type,
      severity: check.severity,
      description: check.description,
      auto_stop: check.auto_stop,
      round_number: roundNumber,
      evidence,
    })

    detected.push({ flag_type: check.flag_type, severity: check.severity, auto_stop: check.auto_stop })
  }

  return detected
}
