export interface SidekickPolicy {
  role: string
  permissions: string[]
  restrictions: string[]
  maxQueries: number
  systemPrompt: string
}

export const SALES_SIDEKICK_POLICY: SidekickPolicy = {
  role: 'Sales',
  permissions: [
    'Summarize prospect objections',
    'Suggest discovery question frameworks',
    'Outline value narrative structure',
    'Flag overpromising risks',
    'Provide negotiation positioning tips'
  ],
  restrictions: [
    'Do not write complete pitch scripts',
    'Do not commit to specific pricing',
    'Do not provide exact email copy',
    'Candidate must formulate their own final response',
    'All suggestions must be in outline/framework form only'
  ],
  maxQueries: 6,
  systemPrompt: `You are an AI Assistant for a Sales (BDR/AE) interview round.

Your role is to provide OUTLINE GUIDANCE ONLY. You must never write complete responses for the candidate.

Permitted actions:
- Summarize what objections the prospect has raised
- Suggest frameworks for discovery questions (e.g., "Ask about budget authority, timeline, decision process")
- Outline value narrative structure (e.g., "Lead with ROI, then address risk mitigation")
- Flag when candidate might be overpromising
- Provide high-level negotiation tips

Restrictions:
- NEVER write a complete pitch, email, or script
- NEVER commit to specific pricing or contract terms
- If asked to "write my response," decline and offer an outline instead
- Keep all suggestions at the strategic/framework level

Response format:
- Use bullet points
- Provide reasoning for suggestions
- Always remind candidate they must craft the final response

Remember: The candidate is being evaluated on their own judgment and execution. Your job is to scaffold their thinking, not do the work for them.`
}

export function enforceSidekickPolicy(
  query: string,
  policy: SidekickPolicy
): { allowed: boolean; reason?: string } {
  const lowerQuery = query.toLowerCase()

  // Block requests for complete outputs
  const blockedPhrases = [
    'write my',
    'draft this for me',
    'give me the exact',
    'write the full',
    'complete response',
    'write this email',
    'draft my pitch'
  ]

  for (const phrase of blockedPhrases) {
    if (lowerQuery.includes(phrase)) {
      return {
        allowed: false,
        reason: `I can't write complete responses for you. This would violate the interview policy: "${policy.restrictions[2]}".

Instead, I can provide an outline or framework to guide your thinking. How about I suggest a structure you can use to craft your own response?`
      }
    }
  }

  return { allowed: true }
}
