import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabase/server'
import { fetchScopePackage, emitRedFlag } from '@/lib/db/helpers'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(request: Request) {
  try {
    const { session_id, round_number } = await request.json()

    if (!session_id || round_number === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: session_id, round_number' },
        { status: 400 }
      )
    }

    const roundNumber = Number(round_number)

    let scopePackage: any
    try {
      scopePackage = await fetchScopePackage(session_id)
    } catch {
      return NextResponse.json({ generated: false, reason: 'scope_not_found' })
    }

    const round = scopePackage.round_plan.find((r: any) => r.round_number === roundNumber)
    if (!round) {
      return NextResponse.json({ generated: false, reason: 'round_not_found' })
    }
    if (!['text', 'code'].includes(round.round_type)) {
      return NextResponse.json({ generated: false, reason: 'unsupported_round' })
    }

    const { data: artifacts } = await supabaseAdmin
      .from('artifacts')
      .select('*')
      .eq('session_id', session_id)
      .eq('round_number', roundNumber)
      .order('created_at', { ascending: false })
      .limit(1)

    const artifact = artifacts?.[0]
    if (artifact?.artifact_type === 'followup_answer') {
      return NextResponse.json({ generated: false, reason: 'latest_is_followup_answer' })
    }
    const artifactContent = artifact?.content || artifact?.metadata?.content || ''
    const contentWordCount = String(artifactContent).trim().split(/\s+/).filter(Boolean).length
    if (!artifactContent || contentWordCount < 3) {
      await emitRedFlag(session_id, {
        flag_type: 'insufficient_response',
        severity: 'warning',
        description: artifactContent
          ? 'Response too short to evaluate'
          : 'Candidate submitted no response for this round',
        auto_stop: false,
        round_number: roundNumber,
      })
      return NextResponse.json({ generated: false, reason: 'no_content' })
    }

    const { data: questionEvents } = await supabaseAdmin
      .from('live_events')
      .select('*')
      .eq('session_id', session_id)
      .eq('event_type', 'followup_question')
      .contains('payload', { round_number: roundNumber })
      .order('created_at', { ascending: false })
      .limit(50)

    const { data: answerEvents } = await supabaseAdmin
      .from('live_events')
      .select('*')
      .eq('session_id', session_id)
      .eq('event_type', 'followup_answer')
      .contains('payload', { round_number: roundNumber })
      .order('created_at', { ascending: false })
      .limit(50)

    const answered = new Set(
      (answerEvents || [])
        .map((event: any) => event.payload?.question_id)
        .filter(Boolean)
    )

    const pending = (questionEvents || []).some(
      (event: any) => event.payload?.question_id && !answered.has(event.payload.question_id)
    )

    if (pending) {
      return NextResponse.json({ generated: false, reason: 'pending_followup' })
    }

    const autoCount = (questionEvents || []).filter(
      (event: any) => event.payload?.source === 'auto'
    ).length

    if (autoCount >= 1) {
      return NextResponse.json({ generated: false, reason: 'auto_followup_already_generated' })
    }

    const { data: scores } = await supabaseAdmin
      .from('scores')
      .select('*')
      .eq('session_id', session_id)
      .order('created_at', { ascending: false })
      .limit(3)

    const latestScore = scores?.[0]

    const { data: actions } = await supabaseAdmin
      .from('live_events')
      .select('*')
      .eq('session_id', session_id)
      .eq('event_type', 'interviewer_action')
      .order('created_at', { ascending: false })
      .limit(10)

    const relevantActions = (actions || [])
      .filter((event: any) => {
        if (!['inject_curveball', 'switch_persona'].includes(event.payload?.action_type)) {
          return false
        }
        const target = event.payload?.target_round
        return target == null || Number(target) === roundNumber
      })
      .map((event: any) => ({
        action_type: event.payload?.action_type,
        curveball: event.payload?.curveball,
        persona: event.payload?.persona,
        target_round: event.payload?.target_round
      }))

    const prompt = `You are generating a single follow-up question for a live interview round.

Round context:
${JSON.stringify(
  {
    round_number: roundNumber,
    round_type: round.round_type,
    title: round.title,
    prompt: round.prompt,
    scoring_rubric: round.config?.scoring_rubric || null
  },
  null,
  2
)}

Candidate response:
${artifactContent}

Recent score context (if available):
${JSON.stringify(
  latestScore
    ? {
        overall_score: latestScore.overall_score,
        dimension_scores: latestScore.dimension_scores,
        red_flags: latestScore.red_flags
      }
    : null,
  null,
  2
)}

Interviewer controls:
${JSON.stringify(relevantActions, null, 2)}

Rules:
- Decide if a follow-up is necessary to validate weak areas or missing evidence.
- If no follow-up is needed, set should_followup=false.
- If follow-up is needed, provide exactly ONE short question (<= 20 words).
- Do not mention scores or internal controls explicitly.
- Keep tone professional and aligned to the round.

Return JSON only:
{"should_followup": true/false, "question": "..." }`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: { type: 'json_object' },
      max_tokens: 120
    })

    const result = JSON.parse(completion.choices[0].message.content || '{}')
    const shouldFollowup = Boolean(result.should_followup)
    const question = String(result.question || '').trim()

    if (!shouldFollowup || !question) {
      return NextResponse.json({ generated: false, reason: 'model_declined' })
    }

    const questionId = crypto.randomUUID()

    await supabaseAdmin.from('live_events').insert({
      session_id,
      event_type: 'followup_question',
      actor: 'system',
      payload: {
        round_number: roundNumber,
        question_id: questionId,
        question,
        source: 'auto'
      }
    })

    return NextResponse.json({ generated: true, question, question_id: questionId })
  } catch (error: any) {
    console.error('Follow-up generation error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
