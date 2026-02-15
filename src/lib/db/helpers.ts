import { supabaseAdmin } from '@/lib/supabase/server'

// ─── Scope Package ──────────────────────────────────────────

export async function fetchScopePackage(sessionId: string) {
  const { data, error } = await supabaseAdmin
    .from('interview_scope_packages')
    .select('*')
    .eq('session_id', sessionId)
    .single()

  if (error) throw error
  return data
}

export function getActiveRoundNumber(roundPlan: any[]): number | null {
  const active = roundPlan.find((r: any) => r.status === 'active')
  const pending = roundPlan.find((r: any) => r.status === 'pending')
  return active?.round_number ?? pending?.round_number ?? roundPlan[0]?.round_number ?? null
}

// ─── Red Flags ──────────────────────────────────────────────

export async function emitRedFlag(
  sessionId: string,
  opts: {
    flag_type: string
    severity: 'warning' | 'critical'
    description: string
    auto_stop: boolean
    round_number: number | null
    actor?: string
    evidence?: any[]
  }
) {
  await supabaseAdmin.from('live_events').insert({
    session_id: sessionId,
    event_type: 'red_flag_detected',
    actor: opts.actor || 'system',
    payload: {
      flag_type: opts.flag_type,
      severity: opts.severity,
      description: opts.description,
      auto_stop: opts.auto_stop,
      round_number: opts.round_number,
      ...(opts.evidence?.length ? { evidence: opts.evidence } : {}),
    },
  })
}

// ─── Force Stop ─────────────────────────────────────────────

export async function forceStopSession(
  sessionId: string,
  reason: string,
  actor: string = 'system'
) {
  const pkg = await fetchScopePackage(sessionId)
  const roundPlan = (pkg.round_plan || []) as Array<Record<string, any>>

  for (const round of roundPlan) {
    if (round.status === 'active' || round.status === 'pending') {
      round.status = 'skipped'
      round.completed_at = new Date().toISOString()
    }
  }

  await supabaseAdmin
    .from('interview_scope_packages')
    .update({ round_plan: roundPlan })
    .eq('id', pkg.id)

  await supabaseAdmin
    .from('interview_sessions')
    .update({ status: 'aborted' })
    .eq('id', sessionId)

  await supabaseAdmin.from('live_events').insert({
    session_id: sessionId,
    event_type: 'session_force_stopped',
    actor,
    payload: { reason },
  })
}

// ─── PI Screening Helpers ───────────────────────────────────

export function extractResumeSkills(resumeAnalysis: any): string[] {
  if (!resumeAnalysis) return []
  if (Array.isArray(resumeAnalysis.skills)) return resumeAnalysis.skills
  if (Array.isArray(resumeAnalysis.top_skills)) return resumeAnalysis.top_skills
  if (Array.isArray(resumeAnalysis.primary_skills)) return resumeAnalysis.primary_skills
  if (resumeAnalysis.skills && typeof resumeAnalysis.skills === 'object') {
    const buckets = Object.values(resumeAnalysis.skills)
    return (buckets as any[]).flat().filter(Boolean)
  }
  return []
}

export function computeInterviewLevel(
  levelBand: string | undefined,
  piScoreOverall: number | null | undefined,
  experienceYearsMax?: number | null
): string {
  const normalized = typeof levelBand === 'string' ? levelBand.toLowerCase() : ''

  let baseLevel: string
  if (normalized === 'junior') {
    baseLevel = 'L1'
  } else if (normalized === 'senior') {
    baseLevel = 'L3'
  } else {
    baseLevel = 'L2'
  }

  if (normalized !== 'junior' && normalized !== 'senior' && typeof experienceYearsMax === 'number') {
    if (experienceYearsMax <= 2) baseLevel = 'L1'
    else if (experienceYearsMax >= 6) baseLevel = 'L3'
  }

  let interviewLevel = baseLevel
  if (typeof piScoreOverall === 'number') {
    if (piScoreOverall >= 80) interviewLevel = 'L3'
    else if (piScoreOverall <= 55) interviewLevel = 'L1'
  }

  return interviewLevel
}

// ─── Followup Queries ───────────────────────────────────────

export async function fetchFollowupEvents(sessionId: string, limit = 200) {
  const [{ data: questions }, { data: answers }, { data: manualActions }] =
    await Promise.all([
      supabaseAdmin
        .from('live_events')
        .select('*')
        .eq('session_id', sessionId)
        .eq('event_type', 'followup_question')
        .order('created_at', { ascending: false })
        .limit(limit),
      supabaseAdmin
        .from('live_events')
        .select('*')
        .eq('session_id', sessionId)
        .eq('event_type', 'followup_answer')
        .order('created_at', { ascending: false })
        .limit(limit),
      supabaseAdmin
        .from('live_events')
        .select('*')
        .eq('session_id', sessionId)
        .eq('event_type', 'interviewer_action')
        .order('created_at', { ascending: false })
        .limit(limit),
    ])

  const manualQuestions = (manualActions || [])
    .filter(
      (event: any) =>
        event.payload?.action_type === 'manual_followup' && event.payload?.followup
    )
    .map((event: any) => ({
      ...event,
      event_type: 'followup_question' as const,
      payload: {
        question_id: event.payload?.question_id,
        question: event.payload?.followup,
        round_number:
          event.payload?.round_number ?? event.payload?.target_round ?? null,
        source: 'manual',
      },
    }))

  return {
    questions: questions || [],
    answers: answers || [],
    manualQuestions,
    combined: [...(questions || []), ...manualQuestions],
  }
}
