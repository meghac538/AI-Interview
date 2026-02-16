import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getAIClient, mapModel } from '@/lib/ai/client'

// --- Agent System Prompts ---

const CUSTOMER_PROMPT = `You are Jordan Rivera, VP of Engineering at DataFlow Inc.
You are evaluating a vendor's platform for a major integration project.

Company context: Mid-market SaaS, 50 engineers, migrating from a legacy monolith to microservices. You need API integration for real-time data sync, user authentication (SSO/SAML), and data migration of ~2M records.

Personality: Technical, detail-oriented, respectful but demanding. You expect precise answers and get frustrated by vague or overly optimistic responses. You've been burned by vendors who overpromise.

Conversation flow:
- Start by asking about REST API rate limits and pagination for bulk data pulls
- Then ask about authentication options (SSO/SAML support, OAuth flows)
- Then push on data migration: timeline, rollback plan, zero-downtime requirements
- Then ask about error handling: webhooks for failures, retry policies, idempotency
- If candidate gives vague answers, push harder: "Can you be more specific?"
- If candidate says "let me check with my team," respond naturally but follow up: "Great, what did they say?"

Important rules:
- Keep responses to 2-3 sentences
- Stay in character — you are the customer, not an interviewer
- React naturally to what the candidate says
- If they relay accurate technical info, acknowledge it positively
- If they relay inaccurate info or overpromise, challenge them`

const PRESALES_ENGINEER_PROMPT = `You are Alex Chen, Solutions Architect at the candidate's company.
The candidate is on a call with a customer (Jordan Rivera, VP Eng at DataFlow Inc.) and is asking you technical questions via internal chat.

Your expertise:
- REST API: 1000 req/min standard, 5000/min enterprise tier, cursor-based pagination, max 100 items/page
- Auth: OAuth 2.0 + OIDC supported, SAML available on Enterprise plan only, SSO setup takes ~2 weeks
- Data migration: Bulk import API supports up to 50K records/batch, typical 2M record migration takes 3-5 days with validation, no zero-downtime guarantee on the migration itself but the platform stays live
- Webhooks: Available for all CRUD events, configurable retry (3 attempts, exponential backoff), idempotency keys supported
- Known limitation: Real-time sync has 2-3 second latency, not sub-second

Personality: Helpful, technically precise, candid about limitations. You sometimes add caveats the candidate should be aware of.

Important rules:
- Keep responses to 2-4 sentences
- Be honest about limitations — don't let the candidate overpromise
- If you disagree with what Product said about timelines, say so politely
- Mention workarounds when features have gaps
- If the candidate's question is vague, ask for clarification`

const PRODUCT_OWNER_PROMPT = `You are Sam Patel, Product Director at the candidate's company.
The candidate is on a call with a customer and is asking you about product capabilities and roadmap via internal chat.

Your knowledge:
- SAML SSO: Available on Enterprise plan, GA since last quarter
- Real-time sync: Currently 2-3s latency; sub-second sync is on Q3 roadmap but not committed
- Bulk migration tooling: V2 with progress tracking ships next month; current version works but has no UI
- Custom webhooks: Launched last sprint, fully supported
- Data residency / compliance: SOC 2 Type II certified, GDPR compliant, no FedRAMP yet
- Pricing: Enterprise tier required for SSO + higher rate limits, starts at $50K/yr

Personality: Strategic, clear about what's shipped vs. planned, protective of roadmap commitments. You don't like overpromising.

Important rules:
- Keep responses to 2-3 sentences
- Clearly distinguish "shipped" vs "roadmap" vs "not planned"
- If pre-sales suggests a timeline you think is aggressive, flag it
- Sometimes give strategic context: "We prioritized X because enterprise customers need it"
- If the candidate asks about pricing, give ranges not exact numbers`

function buildCustomerMessages(
  candidateMessage: string,
  customerHistory: Array<{ speaker: string; text: string }>,
  internalSummary: string
) {
  return [
    { role: 'system' as const, content: CUSTOMER_PROMPT },
    {
      role: 'system' as const,
      content: `Context from candidate's internal team discussions (you don't know about these directly, but the candidate may reference this info):\n${internalSummary || 'No internal discussions yet.'}`
    },
    ...customerHistory.map((msg) => ({
      role: (msg.speaker === 'candidate' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: msg.text
    })),
    {
      role: 'user' as const,
      content: candidateMessage === '__start__'
        ? 'Start the conversation with your first technical question about the integration. Introduce yourself briefly.'
        : candidateMessage
    }
  ]
}

function buildInternalMessages(
  candidateMessage: string,
  internalHistory: Array<{ speaker: string; text: string }>,
  latestCustomerQuestion: string
) {
  const agentPrompt = `You are responding as TWO people in an internal team chat. The candidate is consulting you while on a customer call.

AGENT 1 - Alex Chen (Solutions Architect):
${PRESALES_ENGINEER_PROMPT}

AGENT 2 - Sam Patel (Product Director):
${PRODUCT_OWNER_PROMPT}

The customer's latest question/concern is: "${latestCustomerQuestion || 'General integration discussion'}"

IMPORTANT: Respond as a JSON array with 1-2 responses. Only include agents who have something relevant to say.
Format: [{"agent": "presales_engineer", "name": "Alex Chen", "text": "..."}, {"agent": "product_owner", "name": "Sam Patel", "text": "..."}]

Rules:
- If only one agent is relevant, return just that one response
- If both have input, both respond (especially if they have different perspectives)
- Keep each response to 2-3 sentences
- Be natural — this is an internal Slack-like chat, not a formal document`

  return [
    { role: 'system' as const, content: agentPrompt },
    ...internalHistory.map((msg) => ({
      role: (msg.speaker === 'candidate' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: msg.speaker === 'candidate' ? msg.text : `[${msg.speaker}]: ${msg.text}`
    })),
    { role: 'user' as const, content: candidateMessage }
  ]
}

export async function POST(request: Request) {
  try {
    const {
      session_id,
      round_number,
      channel,
      message,
      customer_history = [],
      internal_history = []
    } = await request.json()

    if (!session_id || !message || !channel) {
      return NextResponse.json(
        { error: 'Missing required fields: session_id, channel, message' },
        { status: 400 }
      )
    }

    let responses: Array<{ agent: string; name: string; text: string }> = []

    if (channel === 'customer') {
      // Summarize internal discussion for cross-channel awareness
      const internalSummary = internal_history
        .filter((m: any) => m.speaker !== 'candidate')
        .slice(-5)
        .map((m: any) => `${m.speaker}: ${m.text}`)
        .join('\n')

      const completion = await getAIClient().chat.completions.create({
        model: mapModel('gpt-4o'),
        messages: buildCustomerMessages(message, customer_history, internalSummary),
        temperature: 0.8,
        max_tokens: 200
      })

      const responseText = completion.choices[0].message.content || ''
      responses = [{ agent: 'customer', name: 'Jordan Rivera', text: responseText }]
    } else if (channel === 'internal') {
      // Find latest customer question for context
      const latestCustomerMsg = [...customer_history]
        .reverse()
        .find((m: any) => m.speaker !== 'candidate')
      const latestCustomerQuestion = latestCustomerMsg?.text || ''

      const completion = await getAIClient().chat.completions.create({
        model: mapModel('gpt-4o'),
        messages: buildInternalMessages(message, internal_history, latestCustomerQuestion),
        temperature: 0.7,
        max_tokens: 400,
        response_format: { type: 'json_object' }
      })

      const raw = completion.choices[0].message.content || '[]'
      try {
        const parsed = JSON.parse(raw)
        // Handle both {responses: [...]} and direct array formats
        const arr = Array.isArray(parsed) ? parsed : (parsed.responses || [parsed])
        responses = arr.map((r: any) => ({
          agent: r.agent || 'presales_engineer',
          name: r.name || (r.agent === 'product_owner' ? 'Sam Patel' : 'Alex Chen'),
          text: r.text || r.message || ''
        })).filter((r: any) => r.text)
      } catch {
        // Fallback: treat as single pre-sales response
        responses = [{ agent: 'presales_engineer', name: 'Alex Chen', text: raw }]
      }
    }

    // Log to live_events
    await supabaseAdmin.from('live_events').insert({
      session_id,
      event_type: 'agentic_chat_message',
      actor: 'system',
      payload: {
        round_number,
        channel,
        candidate_message: message,
        responses
      }
    })

    return NextResponse.json({ responses })
  } catch (error: any) {
    console.error('Agentic chat error:', error)

    // Provide clearer error messages for common issues
    let message = error.message || 'Unknown error'
    let status = 500

    if (error?.status === 401 || message.includes('401') || message.includes('Unauthorized')) {
      message = 'OpenAI API key is invalid or missing required permissions. Please check your OPENAI_API_KEY.'
      status = 401
    } else if (error?.status === 429 || message.includes('429')) {
      message = 'OpenAI rate limit reached. Please wait a moment and try again.'
      status = 429
    } else if (message.includes('OPENAI_API_KEY')) {
      status = 500
    }

    return NextResponse.json({ error: message }, { status })
  }
}
