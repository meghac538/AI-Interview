import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { requireInterviewer } from '@/lib/supabase/require-role'

export async function GET(request: Request) {
  try {
    const gate = await requireInterviewer(request)
    if (!gate.ok) return gate.response

    const { data: sessions, error } = await supabaseAdmin
      .from('interview_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) throw error

    const candidateIds = Array.from(
      new Set(sessions.map((s: any) => s.candidate_id).filter(Boolean))
    )
    const jobIds = Array.from(new Set(sessions.map((s: any) => s.job_id).filter(Boolean)))

    const [{ data: candidates }, { data: jobs }] = await Promise.all([
      candidateIds.length
        ? supabaseAdmin.from('candidates').select('*').in('id', candidateIds)
        : Promise.resolve({ data: [] }),
      jobIds.length
        ? supabaseAdmin.from('job_profiles').select('*').in('id', jobIds)
        : Promise.resolve({ data: [] })
    ])

    const candidateMap = new Map((candidates || []).map((c: any) => [c.id, c]))
    const jobMap = new Map((jobs || []).map((j: any) => [j.id, j]))

    const results = sessions.map((session: any) => ({
      ...session,
      candidate: candidateMap.get(session.candidate_id) || null,
      job: jobMap.get(session.job_id) || null
    }))

    return NextResponse.json({ sessions: results })
  } catch (error: any) {
    console.error('Interviewer sessions error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
