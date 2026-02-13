import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params

    // Get session (interview_sessions table)
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('interview_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (sessionError) throw sessionError

    // Get candidate data
    const { data: candidate } = await supabaseAdmin
      .from('candidates')
      .select('*')
      .eq('id', session.candidate_id)
      .single()

    // Get job profile data
    const { data: jobProfile } = await supabaseAdmin
      .from('job_profiles')
      .select('*')
      .eq('id', session.job_id)
      .single()

    // Get scope package (contains round_plan)
    const { data: scopePackage, error: scopeError } = await supabaseAdmin
      .from('interview_scope_packages')
      .select('*')
      .eq('session_id', sessionId)
      .single()

    if (scopeError) throw scopeError

    // Get rounds from scope package
    const rounds = scopePackage?.round_plan || []

    // Get recent events (live_events table)
    const { data: events } = await supabaseAdmin
      .from('live_events')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(20)

    // Get current scores
    const { data: scores } = await supabaseAdmin
      .from('scores')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })

    return NextResponse.json({
      session: {
        ...session,
        candidate, // Add populated candidate
        job: jobProfile // Add populated job profile
      },
      scopePackage,
      rounds,
      events,
      scores
    })
  } catch (error: any) {
    console.error('Session fetch error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params
    const updates = await request.json()

    const { data, error } = await supabaseAdmin
      .from('interview_sessions')
      .update(updates)
      .eq('id', sessionId)
      .select()
      .single()

    if (error) throw error

    // Log update event (live_events table)
    await supabaseAdmin.from('live_events').insert({
      session_id: sessionId,
      event_type: 'session_updated',
      actor: 'system',
      payload: updates
    })

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Session update error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
