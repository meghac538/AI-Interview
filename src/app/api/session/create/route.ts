import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getRoundPlan } from '@/lib/ai/round-plans'
import type { Track } from '@/lib/types/database'

export async function POST(request: Request) {
  try {
    const { candidate_name, role, level, track = 'sales' } = await request.json()

    // Validate inputs
    if (!candidate_name || !role || !level) {
      return NextResponse.json(
        { error: 'Missing required fields: candidate_name, role, level' },
        { status: 400 }
      )
    }

    const trackValue = track as Track
    const rounds = getRoundPlan(trackValue)

    const successCriteria = trackValue === 'implementation'
      ? 'Customer outcomes and implementation management criteria'
      : 'Standard sales criteria'

    // Step 1: Create job profile
    const { data: jobProfile, error: jobError } = await supabaseAdmin
      .from('job_profiles')
      .insert({
        job_id: `temp_${Date.now()}`,
        title: role,
        location: 'Remote',
        level_band: level.toLowerCase() as 'junior' | 'mid' | 'senior',
        track: trackValue,
        role_success_criteria: successCriteria,
        must_have_flags: [],
        disqualifiers: [],
        gating_thresholds: { proceed: 70, caution: 50, stop: 30 }
      })
      .select()
      .single()

    if (jobError) throw jobError

    // Step 2: Create candidate
    const { data: candidate, error: candidateError } = await supabaseAdmin
      .from('candidates')
      .insert({
        rippling_candidate_id: `temp_${Date.now()}`,
        name: candidate_name,
        email: `${candidate_name.toLowerCase().replace(/\s+/g, '.')}@temp.com`,
        job_id: jobProfile.job_id,
        applied_at: new Date().toISOString(),
        status: 'live_scheduled'
      })
      .select()
      .single()

    if (candidateError) throw candidateError

    // Step 3: Create session
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('interview_sessions')
      .insert({
        candidate_id: candidate.id,
        job_id: jobProfile.id,
        session_type: 'live',
        status: 'scheduled',
        scheduled_at: new Date().toISOString()
      })
      .select()
      .single()

    if (sessionError) throw sessionError

    // Step 4: Create scope package with round plan
    const { data: scopePackage, error: scopeError } = await supabaseAdmin
      .from('interview_scope_packages')
      .insert({
        session_id: session.id,
        generated_at: new Date().toISOString(),
        track: trackValue,
        round_plan: rounds,
        question_set: {},
        simulation_payloads: {},
        rubric_version: '1.0',
        models_used: ['gpt-4o'],
        approved_by: null
      })
      .select()
      .single()

    if (scopeError) throw scopeError

    // Step 5: Log session creation event
    await supabaseAdmin.from('live_events').insert({
      session_id: session.id,
      event_type: 'session_created',
      payload: {
        candidate_id: candidate.id,
        job_id: jobProfile.id,
        track: trackValue
      }
    })

    return NextResponse.json({
      session: {
        ...session,
        candidate,
        job: jobProfile,
        currentRound: 1
      },
      scopePackage,
      rounds
    })
  } catch (error: any) {
    console.error('Session creation error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
