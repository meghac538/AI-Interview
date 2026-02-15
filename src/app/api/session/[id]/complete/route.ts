import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params

    // Get current session and scope package
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('interview_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (sessionError) throw sessionError

    const { data: scopePackage, error: scopeError } = await supabaseAdmin
      .from('interview_scope_packages')
      .select('*')
      .eq('session_id', sessionId)
      .single()

    if (scopeError) throw scopeError

    // Mark all pending/active rounds as skipped
    const updatedRoundPlan = scopePackage.round_plan.map((round: any) => {
      if (round.status === 'pending' || round.status === 'active') {
        return {
          ...round,
          status: 'skipped',
          completed_at: new Date().toISOString()
        }
      }
      return round
    })

    // Update scope package
    await supabaseAdmin
      .from('interview_scope_packages')
      .update({ round_plan: updatedRoundPlan })
      .eq('id', scopePackage.id)

    // Mark session as completed
    const { data: updatedSession, error: updateError } = await supabaseAdmin
      .from('interview_sessions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .select()
      .single()

    if (updateError) throw updateError

    // Log event
    await supabaseAdmin.from('live_events').insert({
      session_id: sessionId,
      event_type: 'session_completed_manually',
      payload: {
        completed_by: 'interviewer',
        skipped_rounds: updatedRoundPlan
          .filter((r: any) => r.status === 'skipped')
          .map((r: any) => r.round_number)
      }
    })

    return NextResponse.json({
      success: true,
      session: updatedSession,
      message: 'Session completed successfully'
    })
  } catch (error: any) {
    console.error('Session complete error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
