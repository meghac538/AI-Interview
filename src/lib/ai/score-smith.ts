import OpenAI from 'openai'
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

export const IMPLEMENTATION_R1_DIMENSIONS: ScoringDimension[] = [
  {
    name: 'tone_and_clarity',
    description: 'Calm, professional, empathetic tone with clear structure',
    maxScore: 25,
    scoringCriteria: [
      'Acknowledges the client concern without being dismissive or defensive',
      'Uses clear, structured language free of jargon or ambiguity',
      'Maintains professional warmth while being direct'
    ]
  },
  {
    name: 'de_escalation',
    description: 'Effective de-escalation without minimizing the issue',
    maxScore: 25,
    scoringCriteria: [
      'Validates the concern as legitimate',
      'Does not blame the customer or external factors',
      'Reduces emotional temperature while maintaining seriousness',
      'Avoids defensive posturing or corporate deflection'
    ]
  },
  {
    name: 'commitment_accuracy',
    description: 'Realistic, specific commitments that avoid overreach',
    maxScore: 25,
    scoringCriteria: [
      'Makes commitments that are realistically achievable',
      'Does not promise outcomes outside their control',
      'Avoids legal overreach or contractual language',
      'Distinguishes between what is confirmed vs. what needs investigation'
    ]
  },
  {
    name: 'next_step_structure',
    description: 'Clear, actionable next steps with owners and timeline',
    maxScore: 25,
    scoringCriteria: [
      'Provides specific next steps, not vague reassurances',
      'Includes timeline for each action item',
      'Assigns ownership (self or team) for each step',
      'Proposes a follow-up checkpoint or cadence'
    ]
  }
]

export const IMPLEMENTATION_R2_DIMENSIONS: ScoringDimension[] = [
  {
    name: 'internal_coordination',
    description: 'Quality of internal team interaction and information gathering',
    maxScore: 25,
    scoringCriteria: [
      'Asks targeted questions to the right internal stakeholders',
      'Synthesizes conflicting or partial information effectively',
      'Does not accept internal answers at face value without verification',
      'Manages internal team efficiently (not too many or too few questions)'
    ]
  },
  {
    name: 'technical_comprehension',
    description: 'Accuracy in understanding and relaying technical details',
    maxScore: 25,
    scoringCriteria: [
      'Correctly interprets technical information from internal agents',
      'Does not introduce inaccuracies when translating for the customer',
      'Identifies gaps in technical answers that need follow-up',
      'Distinguishes between current capabilities and roadmap items'
    ]
  },
  {
    name: 'customer_communication_quality',
    description: 'Quality and accuracy of the final customer response',
    maxScore: 25,
    scoringCriteria: [
      'Addresses all customer questions with specific answers',
      'Sets realistic expectations based on verified information',
      'Professional tone appropriate for a technical audience',
      'Organizes information clearly (numbered responses matching questions)'
    ]
  },
  {
    name: 'risk_identification',
    description: 'Proactive identification and communication of risks',
    maxScore: 25,
    scoringCriteria: [
      'Identifies discrepancies between customer expectations and reality',
      'Flags risks that the customer did not explicitly ask about',
      'Proposes mitigation strategies alongside risk identification',
      'Does not hide bad news or risks from the customer'
    ]
  }
]

export function getDimensionsForRound(track: string, roundNumber: number): ScoringDimension[] {
  if (track === 'implementation') {
    switch (roundNumber) {
      case 1: return IMPLEMENTATION_R1_DIMENSIONS
      case 2: return IMPLEMENTATION_R2_DIMENSIONS
      default: return STANDARD_DIMENSIONS
    }
  }
  return STANDARD_DIMENSIONS
}

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

Task: Score the following interview response on the dimension "${dimension.name}".

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

