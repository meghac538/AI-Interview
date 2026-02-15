import { NextResponse, after } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { fetchScopePackage, emitRedFlag } from '@/lib/db/helpers'

export async function POST(request: Request) {
  try {
    const { session_id, round_number } = await request.json()

    if (!session_id || round_number === undefined) {
      return NextResponse.json(
        { error: 'Missing session_id or round_number' },
        { status: 400 }
      )
    }

    const scopePackage = await fetchScopePackage(session_id)

    // Update round in round_plan
    let updatedRoundPlan = scopePackage.round_plan.map((round: any) =>
      round.round_number === round_number
        ? { ...round, status: 'completed', completed_at: new Date().toISOString() }
        : round
    )

    await supabaseAdmin
      .from('interview_scope_packages')
      .update({ round_plan: updatedRoundPlan })
      .eq('id', scopePackage.id)

    const maxRound = Math.max(...updatedRoundPlan.map((r: any) => r.round_number))

    if (round_number >= maxRound) {
      await supabaseAdmin
        .from('interview_sessions')
        .update({ status: 'completed' })
        .eq('id', session_id)
    }

    await supabaseAdmin.from('live_events').insert({
      session_id,
      event_type: 'round_completed',
      actor: 'system',
      payload: { round_number }
    })

    // Schedule scoring + adaptive difficulty to run AFTER the response is sent.
    // This keeps the round/complete response fast (~200ms) while scoring runs in background.
    after(async () => {
      try {
        const currentRound = scopePackage.round_plan.find((r: any) => r.round_number === round_number)
        const roundType = currentRound?.round_type || 'text'

        const { data: artifacts } = await supabaseAdmin
          .from('artifacts')
          .select('*')
          .eq('session_id', session_id)
          .eq('round_number', round_number)
          .order('created_at', { ascending: false })
          .limit(1)

        const artifact = artifacts?.[0]
        if (artifact?.id) {
          if (roundType !== 'voice') {
            const { runScoringForArtifact } = await import('@/lib/ai/score-runner')
            await runScoringForArtifact(artifact.id)
          }
        } else if (roundType === 'voice') {
          const { data: participationEvents } = await supabaseAdmin
            .from('live_events')
            .select('id')
            .eq('session_id', session_id)
            .eq('event_type', 'prospect_message')
            .limit(1)

          if (!participationEvents || participationEvents.length === 0) {
            await emitRedFlag(session_id, {
              flag_type: 'insufficient_response',
              severity: 'warning',
              description: 'No conversation activity detected for this round',
              auto_stop: false,
              round_number,
            })
          }
        } else {
          await emitRedFlag(session_id, {
            flag_type: 'insufficient_response',
            severity: 'warning',
            description: 'Candidate submitted no response for this round',
            auto_stop: false,
            round_number,
          })

          const { error: scoreErr } = await supabaseAdmin.from('scores').insert({
            session_id,
            round: round_number,
            overall_score: 0,
            dimension_scores: {},
            red_flags: [{ flag_type: 'insufficient_response', severity: 'warning', description: 'No response submitted' }],
            confidence: 0,
            evidence_quotes: [],
            recommendation: 'stop',
            recommended_followups: ['Ask the candidate to provide a response for this round.']
          })
          if (scoreErr) {
            await supabaseAdmin.from('scores').insert({
              session_id,
              round_number,
              overall_score: 0,
              dimension_scores: {},
              recommendation: 'stop'
            })
          }
        }
      } catch (error) {
        console.error('Auto scoring error:', error)
      }

      // Adapt next round difficulty based on this round's score
      try {
        const { data: latestScore } = await supabaseAdmin
          .from('scores')
          .select('*')
          .eq('session_id', session_id)
          .eq('round', round_number)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (latestScore) {
          const { adaptNextRound } = await import('@/lib/utils/round-adapter')
          const { updatedPlan, adaptation } = adaptNextRound(
            updatedRoundPlan,
            round_number,
            latestScore
          )

          if (adaptation) {
            await supabaseAdmin
              .from('interview_scope_packages')
              .update({ round_plan: updatedPlan })
              .eq('id', scopePackage.id)

            await supabaseAdmin.from('live_events').insert({
              session_id,
              event_type: 'difficulty_adaptation',
              actor: 'system',
              payload: adaptation
            })
          }
        }
      } catch (adaptError) {
        console.error('Adaptive difficulty error:', adaptError)
      }
    })

    const completedRound = updatedRoundPlan.find((r: any) => r.round_number === round_number)
    return NextResponse.json(completedRound)
  } catch (error: any) {
    console.error('Round complete error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
