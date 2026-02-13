import OpenAI from 'openai'
import { supabaseAdmin } from '@/lib/supabase/server'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

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
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
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
  dimensions: ScoringDimension[]
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
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      })

      const result = JSON.parse(completion.choices[0].message.content || '{}')

      // Check for red flags
      await detectRedFlags(sessionId, roundId, dimension.name, result, artifactContent)

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

async function detectRedFlags(
  sessionId: string,
  roundId: string,
  dimension: string,
  scoringResult: any,
  content: string
) {
  const evidence = Array.isArray(scoringResult?.evidence) ? scoringResult.evidence : []
  if (evidence.length === 0) {
    return
  }

  // Check for overpromising (honesty dimension)
  if (dimension === 'reliability' && scoringResult.score < 8) {
    await supabaseAdmin.from('red_flags').insert({
      session_id: sessionId,
      round_id: roundId,
      flag_type: 'overpromising',
      severity: 'critical',
      description: 'Candidate may have overpromised or made false claims',
      evidence
    })
  }

  // Check for poor objection handling
  if (dimension === 'communication' && scoringResult.score < 8) {
    await supabaseAdmin.from('red_flags').insert({
      session_id: sessionId,
      round_id: roundId,
      flag_type: 'conflict_escalation',
      severity: 'high',
      description: 'Communication suggests escalation risk or poor conflict handling',
      evidence
    })
  }

  // Check for lack of verification discipline
  if (dimension === 'verification' && scoringResult.score < 10) {
    await supabaseAdmin.from('red_flags').insert({
      session_id: sessionId,
      round_id: roundId,
      flag_type: 'overconfident_without_verification',
      severity: 'critical',
      description: 'Overconfident claims without a verification plan',
      evidence
    })
  }

  // Check for unsafe data handling hints
  if (dimension === 'role_depth' && scoringResult.score < 15) {
    await supabaseAdmin.from('red_flags').insert({
      session_id: sessionId,
      round_id: roundId,
      flag_type: 'unsafe_data_handling',
      severity: 'critical',
      description: 'Potential unsafe handling of sensitive data or security gaps',
      evidence
    })
  }
}
