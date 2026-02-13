import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { supabaseAdmin } from '@/lib/supabase/server'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const PROSPECT_PERSONA = `You are a VP of Operations at a mid-market B2B SaaS company.

Personality: Professional, budget-conscious, detail-oriented, skeptical but fair. You're interested in solutions but need to be convinced of ROI.

Context: You're evaluating a proposal and have concerns about pricing, timeline, and implementation. You will raise objections naturally throughout the conversation.

Conversation objectives:
- Start neutral, become skeptical if not handled well, or interested if value is demonstrated
- Ask clarifying questions about budget authority, timeline, decision process
- Raise objections: pricing (20% over budget), timeline (need Q1 delivery - 6 weeks), security concerns
- Inject curveballs: mention competitor options, budget cuts, CFO pushback

Scoring awareness (don't mention explicitly):
- Track if candidate asks discovery questions (need 5+)
- Notice if they quantify value with numbers
- Count objections they handle (need 3+)
- Evaluate if they close professionally

Response style:
- Keep responses natural and conversational (2-4 sentences)
- Gradually reveal objections, don't dump everything at once
- React to candidate's approach (become more interested if they're good, more skeptical if weak)
- If they don't ask questions, push back: "You haven't asked about our budget/timeline/decision process"
- If they overpromise, challenge: "How can you guarantee that?"

Remember: You're evaluating THEM. Be tough but fair.`

export async function POST(request: Request) {
  try {
    const { session_id, round_id, round_number, message, conversation_history, persona_state, metrics } = await request.json()

    if (!session_id || message === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const { data: session } = await supabaseAdmin
      .from('interview_sessions')
      .select('*')
      .eq('id', session_id)
      .single()

    const conversationLength = conversation_history?.length || 0
    let difficultyBoost = 0
    const isStart = message === '__start__'

    let piContext = 'No PI screening data available.'
    let scoreContext = 'No score data available.'
    if (isStart) {
      try {
        const { data: actions } = await supabaseAdmin
          .from('live_events')
          .select('*')
          .eq('session_id', session_id)
          .eq('event_type', 'interviewer_action')
          .order('created_at', { ascending: false })
          .limit(10)

        const match = (actions || []).find((event: any) => {
          return (
            event.payload?.action_type === 'escalate_difficulty' &&
            (event.payload?.target_round === round_number || event.payload?.target_round == null)
          )
        })

        if (match) {
          difficultyBoost = 1
        }
      } catch {
        difficultyBoost = 0
      }

      if (session?.candidate_id) {
        try {
          const { data: piScreenings } = await supabaseAdmin
            .from('pi_screenings')
            .select('*')
            .eq('candidate_id', session.candidate_id)
            .order('created_at', { ascending: false })
            .limit(1)

          const pi = piScreenings?.[0]
          if (pi) {
            const summary = {
              score_overall: pi.pi_score_overall,
              dimension_scores: pi.dimension_scores,
              pass_fail: pi.pass_fail,
              resume_analysis: pi.resume_analysis
            }
            piContext = `PI Screening summary: ${truncateJson(summary, 1200)}`
          }
        } catch {
          piContext = 'PI screening data unavailable.'
        }
      }

      scoreContext = await buildScoreContext(session_id)
    }

    const difficulty = computeDifficulty(metrics, conversationLength, message, difficultyBoost)

    if (message && message !== '__start__') {
      await supabaseAdmin.from('live_events').insert({
        session_id,
        event_type: 'candidate_action',
        actor: 'candidate',
        payload: {
          action: 'message_sent',
          message: String(message).slice(0, 500)
        }
      })
    }

    let followupToAsk: string | null = null
    try {
      const { data: followupEvents } = await supabaseAdmin
        .from('live_events')
        .select('*')
        .eq('session_id', session_id)
        .eq('event_type', 'interviewer_action')
        .order('created_at', { ascending: false })
        .limit(10)

      const { data: usedEvents } = await supabaseAdmin
        .from('live_events')
        .select('*')
        .eq('session_id', session_id)
        .eq('event_type', 'followup_used')
        .order('created_at', { ascending: false })
        .limit(20)

      const used = new Set(
        (usedEvents || [])
          .map((event: any) => event.payload?.followup)
          .filter(Boolean)
      )

      const manual = (followupEvents || []).find(
        (event: any) =>
          event.payload?.action_type === 'manual_followup' &&
          event.payload?.followup &&
          !used.has(event.payload.followup)
      )

      if (manual?.payload?.followup) {
        followupToAsk = String(manual.payload.followup)
      }
    } catch (error) {
      console.error('Follow-up fetch error:', error)
    }

    // Build conversation for OpenAI
    const messages = [
      { role: 'system', content: PROSPECT_PERSONA },
      { role: 'system', content: `Current persona state: ${persona_state}. Metrics: ${JSON.stringify(metrics)}` },
      { role: 'system', content: `Difficulty level (1-5): ${difficulty}. If 4-5, push on constraints, ask multi-part questions, and introduce curveballs earlier.` },
      ...(followupToAsk
        ? [
            {
              role: 'system',
              content: `Use this interviewer follow-up as your next question verbatim or near-verbatim: "${followupToAsk}"`
            }
          ]
        : []),
      ...(isStart
        ? [
            {
              role: 'system',
              content: `PI screening context (for first question only). Do not mention PI explicitly:\n${piContext}`
            },
            {
              role: 'system',
              content: `Score context (for first question only). Do not mention scores explicitly:\n${scoreContext}`
            }
          ]
        : []),
      ...(conversation_history || []).map((msg: any) => ({
        role: msg.speaker === 'candidate' ? 'user' : 'assistant',
        content: msg.text
      })),
      {
        role: 'user',
        content: isStart
          ? 'Start the conversation with a tailored opening question informed by the PI/scores context.'
          : message
      }
    ]

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: messages as any,
      temperature: 0.8,
      max_tokens: 200
    })

    const response = completion.choices[0].message.content || ''

    if (followupToAsk) {
      await supabaseAdmin.from('live_events').insert({
        session_id,
        event_type: 'followup_used',
        actor: 'system',
        payload: { followup: followupToAsk }
      })
    }

    // Analyze message to update metrics
    const updatedMetrics = analyzeMessage(message, response, metrics)
    const updatedPersonaState = determinePersonaState(conversationLength, updatedMetrics, persona_state)

    // Log conversation event (live_events table)
    await supabaseAdmin.from('live_events').insert({
      session_id,
      event_type: 'prospect_message',
      actor: 'system',
      payload: {
        round_id,
        round_number,
        candidate_message: message,
        prospect_response: response,
        metrics: updatedMetrics,
        difficulty
      }
    })

    return NextResponse.json({
      response,
      persona_state: updatedPersonaState,
      metrics: updatedMetrics
    })
  } catch (error: any) {
    console.error('Prospect AI error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

function analyzeMessage(candidateMessage: string, prospectResponse: string, currentMetrics: any) {
  if (!candidateMessage || candidateMessage === '__start__') {
    return { ...currentMetrics }
  }
  const metrics = { ...currentMetrics }

  // Check if candidate asked a question
  if (candidateMessage.includes('?')) {
    metrics.questionsAsked = (metrics.questionsAsked || 0) + 1
  }

  // Check if candidate quantified value (mentions numbers, %, ROI, etc.)
  const valueKeywords = /\d+%|\$\d+|ROI|return|save|increase|reduce|improve.*\d+/i
  if (valueKeywords.test(candidateMessage)) {
    metrics.valueQuantified = true
  }

  // Check if prospect raised an objection and candidate is handling it
  const objectionKeywords = /concern|worry|expensive|budget|timeline|risk|hesitant|uncertain/i
  if (objectionKeywords.test(prospectResponse.toLowerCase())) {
    // Prospect raised objection - will count as handled if candidate responds well next turn
    metrics.pendingObjection = true
  } else if (metrics.pendingObjection && candidateMessage.length > 20) {
    // Candidate responded to objection
    metrics.objectionsHandled = (metrics.objectionsHandled || 0) + 1
    metrics.pendingObjection = false
  }

  return metrics
}

function determinePersonaState(conversationLength: number, metrics: any, currentState: string) {
  // Start neutral
  if (conversationLength < 3) return 'neutral'

  // Become skeptical if not enough discovery or poor handling
  if (conversationLength >= 5 && metrics.questionsAsked < 3) {
    return 'skeptical'
  }

  // Become interested if good discovery and value demonstrated
  if (metrics.questionsAsked >= 4 && metrics.valueQuantified) {
    return 'interested'
  }

  // Become skeptical if objections poorly handled
  if (metrics.objectionsHandled < conversationLength / 4) {
    return 'skeptical'
  }

  return currentState
}

async function buildScoreContext(sessionId: string) {
  const { data: scores } = await supabaseAdmin
    .from('scores')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(25)

  if (!scores || scores.length === 0) {
    return 'No score data available.'
  }

  const latest = scores[0] as any

  if (latest.overall_score !== undefined || latest.dimension_scores) {
    const summary = {
      overall: latest.overall_score,
      confidence: latest.confidence,
      dimensions: latest.dimension_scores,
      red_flags: latest.red_flags,
      followups: latest.recommended_followups || latest.followups
    }
    return `Score summary: ${truncateJson(summary, 1200)}`
  }

  // Fallback: dimension rows
  const dimensionScores = scores
    .filter((row: any) => row.dimension && row.score !== undefined)
    .slice(0, 10)
    .map((row: any) => ({ dimension: row.dimension, score: row.score, confidence: row.confidence }))

  return `Score summary (by dimension): ${truncateJson(dimensionScores, 1200)}`
}

function truncateJson(value: any, maxLength: number) {
  const raw = JSON.stringify(value)
  if (raw.length <= maxLength) return raw
  return raw.slice(0, maxLength) + '...'
}

function computeDifficulty(
  metrics: any,
  conversationLength: number,
  candidateMessage: string,
  boost = 0
) {
  const m = metrics || {}
  let score = 1 + boost

  if (m.questionsAsked >= 3) score += 1
  if (m.valueQuantified) score += 1
  if (m.objectionsHandled >= 2) score += 1

  const strongAnswer =
    (candidateMessage?.length || 0) >= 120 &&
    (/\d+%|\$\d+|ROI|return|save|increase|reduce|improve/i.test(candidateMessage) ||
      /because|therefore|so that|as a result/i.test(candidateMessage))

  if (strongAnswer) score += 1

  if (conversationLength >= 6 && score < 3) {
    score += 1
  }

  return Math.min(5, Math.max(1, score))
}
