import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const { session_id, round_number } = await request.json()

    if (!session_id || round_number === undefined) {
      return NextResponse.json(
        { error: 'Missing session_id or round_number' },
        { status: 400 }
      )
    }

    // Get scope package
    const { data: scopePackage, error: scopeError } = await supabaseAdmin
      .from('interview_scope_packages')
      .select('*')
      .eq('session_id', session_id)
      .single()

    if (scopeError) throw scopeError

    // Update round in round_plan
    const updatedRoundPlan = scopePackage.round_plan.map((round: any) =>
      round.round_number === round_number
        ? {
            ...round,
            status: 'completed',
            completed_at: new Date().toISOString()
          }
        : round
    )

    // Update scope package
    const { error: updateError } = await supabaseAdmin
      .from('interview_scope_packages')
      .update({ round_plan: updatedRoundPlan })
      .eq('id', scopePackage.id)

    if (updateError) throw updateError

    const maxRound = Math.max(...updatedRoundPlan.map((r: any) => r.round_number))

    // Check if there are more rounds
    if (round_number < maxRound) {
      // Don't need to update session - current round is determined by round_plan status
      // The next round will be started manually
    } else {
      // All rounds complete, mark session as completed
      await supabaseAdmin
        .from('interview_sessions')
        .update({ status: 'completed' })
        .eq('id', session_id)
    }

    // Log event (live_events table)
    await supabaseAdmin.from('live_events').insert({
      session_id,
      event_type: 'round_completed',
      actor: 'system',
      payload: { round_number }
    })

    const updatedRound = updatedRoundPlan.find((r: any) => r.round_number === round_number)

    // Trigger scoring for the latest artifact in this round
    try {
      const { data: artifacts } = await supabaseAdmin
        .from('artifacts')
        .select('*')
        .eq('session_id', session_id)
        .contains('metadata', { round_number })
        .order('created_at', { ascending: false })
        .limit(1)

      const artifact = artifacts?.[0]
      if (artifact?.id) {
        const { runScoringForArtifact } = await import('@/lib/ai/score-runner')
        await runScoringForArtifact(artifact.id)
      }
    } catch (error) {
      console.error('Auto scoring error:', error)
    }

    return NextResponse.json(updatedRound)
  } catch (error: any) {
    console.error('Round complete error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
