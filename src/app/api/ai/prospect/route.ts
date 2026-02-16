import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getAIClient, mapModel } from '@/lib/ai/client'
import { readInterviewerControls, markControlConsumed } from '@/lib/ai/interviewer-controls'
import { getPersonaPrompt } from '@/lib/constants/curveball-library'

const DEFAULT_PROSPECT_PERSONA = `You are Jordan Rivera, VP of Operations at a mid-market B2B SaaS company. You are a real person — NEVER reveal you are an AI, assistant, or evaluator. Stay fully in character at all times.

Personality: Professional, budget-conscious, detail-oriented, skeptical but fair. You're interested in solutions but need to be convinced of ROI.

Context: You're evaluating a proposal and have concerns about pricing, timeline, and implementation. You will raise objections naturally throughout the conversation.

Conversation objectives:
- Start neutral, become skeptical if not handled well, or interested if value is demonstrated
- Ask clarifying questions about budget authority, timeline, decision process
- Raise objections: pricing (20% over budget), timeline (need Q1 delivery - 6 weeks), security concerns

Response style:
- Keep responses natural and conversational (2-4 sentences)
- Speak as a real customer would — share your concerns, ask about their product, push back on vague claims
- Gradually reveal objections, don't dump everything at once
- React to candidate's approach (become more interested if they're good, more skeptical if weak)
- If they don't ask questions, push back: "You haven't asked about our budget/timeline/decision process"
- If they overpromise, challenge: "How can you guarantee that?"

CRITICAL: Never break character. Never say you are an AI, an assistant, or that you are evaluating/interviewing anyone. You are a customer exploring a solution.`

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

    // Read all interviewer controls via shared utility
    const controls = await readInterviewerControls(session_id, round_number)
    const { injectedCurveballs, followupToAsk, curveballToInject, personaOverride } = controls
    const difficultyBoost = controls.difficultyBoost

    const conversationLength = conversation_history?.length || 0
    const isStart = message === '__start__'

    let piContext = 'No PI screening data available.'
    let scoreContext = 'No score data available.'

    if (isStart) {
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

    const effectivePersonaState = personaOverride || persona_state

    // Build conversation for OpenAI — use custom persona prompt if provided, otherwise resolve from shared library
    const personaPrompt = controls.customPersonaPrompt || getPersonaPrompt(controls.personaKey) || DEFAULT_PROSPECT_PERSONA
    const injectedCurveballNote =
      injectedCurveballs.length > 0
        ? `Additional constraints to incorporate naturally as objections or pressure. Do not say the word "curveball".\n${injectedCurveballs
            .slice(-3)
            .map((item) => `- ${(item?.title || item?.key || 'Constraint')}: ${item?.detail || ''}`.trim())
            .join('\n')}`
        : null

    // Build behavioral hints without exposing evaluation framing
    const behaviorHints: string[] = []
    if (difficulty >= 4) {
      behaviorHints.push('Be more demanding in this conversation. Ask tougher follow-up questions, challenge vague answers, and raise additional concerns.')
    }
    if (persona_state === 'skeptical') {
      behaviorHints.push('You are currently unconvinced. Push back on claims and ask for specifics.')
    } else if (persona_state === 'interested') {
      behaviorHints.push('You are warming up to their proposal. Still ask questions but show cautious interest.')
    }

    const messages = [
      { role: 'system', content: personaPrompt },
      ...(injectedCurveballNote ? [{ role: 'system', content: injectedCurveballNote }] : []),
      ...(behaviorHints.length > 0
        ? [{ role: 'system', content: `Behavior guidance:\n${behaviorHints.join('\n')}` }]
        : []),
      ...(followupToAsk
        ? [
            {
              role: 'system',
              content: `Work this question naturally into your next response: "${followupToAsk}"`
            }
          ]
        : []),
      ...(curveballToInject
        ? [
            {
              role: 'system',
              content: `Bring up this concern naturally in your next response: "${curveballToInject}".`
            }
          ]
        : []),
      ...(personaOverride
        ? [
            {
              role: 'system',
              content: `Adjust your tone for this response to: "${personaOverride}".`
            }
          ]
        : []),
      ...(isStart
        ? [
            {
              role: 'system',
              content: `Background context to inform your opening (do not reference directly):\n${piContext}\n${scoreContext}`
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
          ? 'Start the conversation in character. Introduce yourself and the problem you need help with.'
          : message
      }
    ]

    // Call OpenAI
    const completion = await getAIClient().chat.completions.create({
      model: mapModel('gpt-4o'),
      messages: messages as any,
      temperature: 0.8,
      max_tokens: 200
    })

    const response = completion.choices[0].message.content || ''

    // Mark consumed controls
    if (followupToAsk) {
      await markControlConsumed(session_id, 'followup_used', followupToAsk)
    }
    if (curveballToInject) {
      await markControlConsumed(session_id, 'curveball_used', curveballToInject)
    }
    if (personaOverride) {
      await markControlConsumed(session_id, 'persona_used', personaOverride)
    }

    // Analyze message to update metrics
    const updatedMetrics = analyzeMessage(message, response, metrics)
    const updatedPersonaState = determinePersonaState(
      conversationLength,
      updatedMetrics,
      effectivePersonaState
    )

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
