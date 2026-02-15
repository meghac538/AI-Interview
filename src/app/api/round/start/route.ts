import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { fetchScopePackage } from '@/lib/db/helpers'

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
    const updatedRoundPlan = scopePackage.round_plan.map((round: any) =>
      round.round_number === round_number
        ? {
            ...round,
            status: 'active',
            started_at: new Date().toISOString()
          }
        : round
    )

    // Update scope package
    const { error: updateError } = await supabaseAdmin
      .from('interview_scope_packages')
      .update({ round_plan: updatedRoundPlan })
      .eq('id', scopePackage.id)

    if (updateError) throw updateError

    // Update session status to live if not already
    await supabaseAdmin
      .from('interview_sessions')
      .update({ status: 'live' })
      .eq('id', session_id)
      .eq('status', 'scheduled')

    // Log event (live_events table)
    await supabaseAdmin.from('live_events').insert({
      session_id,
      event_type: 'round_started',
      actor: 'system',
      payload: { round_number }
    })

    const updatedRound = updatedRoundPlan.find((r: any) => r.round_number === round_number)
    return NextResponse.json(updatedRound)
  } catch (error: any) {
    console.error('Round start error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
