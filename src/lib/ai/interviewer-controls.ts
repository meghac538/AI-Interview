import { supabaseAdmin } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InterviewerControls {
  personaKey: string
  customPersonaPrompt: string | null
  injectedCurveballs: Array<{ key?: string; title?: string; detail?: string }>
  difficultyBoost: number
  followupToAsk: string | null
  curveballToInject: string | null
  personaOverride: string | null
}

// ---------------------------------------------------------------------------
// Read all interviewer controls for a given session + round
// ---------------------------------------------------------------------------

export async function readInterviewerControls(
  sessionId: string,
  roundNumber: number,
  defaultPersona: string = 'skeptical_buyer'
): Promise<InterviewerControls> {
  let personaKey = defaultPersona
  let customPersonaPrompt: string | null = null
  let injectedCurveballs: InterviewerControls['injectedCurveballs'] = []
  let difficultyBoost = 0

  // ── 1. Read scope package (round config + simulation_payloads) ────────
  try {
    const { data: scopePackage } = await supabaseAdmin
      .from('interview_scope_packages')
      .select('round_plan,simulation_payloads')
      .eq('session_id', sessionId)
      .single()

    const roundPlan = Array.isArray((scopePackage as any)?.round_plan)
      ? (scopePackage as any).round_plan
      : []
    const currentRound =
      roundPlan.find((r: any) => r?.round_number === roundNumber) || null
    const controls =
      (scopePackage as any)?.simulation_payloads?.interviewer_controls || {}

    personaKey = String(
      currentRound?.config?.persona_override ||
        currentRound?.config?.persona ||
        controls?.persona_override ||
        personaKey
    )

    // Read custom persona prompt from round config or global controls
    customPersonaPrompt = String(
      currentRound?.config?.custom_persona_prompt ||
        controls?.custom_persona_prompt ||
        ''
    ) || null

    injectedCurveballs = Array.isArray(currentRound?.config?.injected_curveballs)
      ? currentRound.config.injected_curveballs
      : []

    if (controls?.difficulty_boost) {
      difficultyBoost = 1
    }
  } catch {
    // Non-blocking: conversation must still work even if scope metadata is unavailable.
  }

  // ── 2. Check live_events for difficulty escalation ────────────────────
  try {
    const { data: actions } = await supabaseAdmin
      .from('live_events')
      .select('*')
      .eq('session_id', sessionId)
      .eq('event_type', 'interviewer_action')
      .order('created_at', { ascending: false })
      .limit(25)

    const match = (actions || []).find(
      (event: any) =>
        event.payload?.action_type === 'escalate_difficulty' &&
        (event.payload?.target_round === roundNumber ||
          event.payload?.target_round == null)
    )

    if (match) {
      difficultyBoost = 1
    }
  } catch {
    // ignore
  }

  // ── 3. Read unconsumed followups, curveballs, persona switches ────────
  let followupToAsk: string | null = null
  let curveballToInject: string | null = null
  let personaOverride: string | null = null

  try {
    const { data: followupEvents } = await supabaseAdmin
      .from('live_events')
      .select('*')
      .eq('session_id', sessionId)
      .eq('event_type', 'interviewer_action')
      .order('created_at', { ascending: false })
      .limit(10)

    // ── Followups ──
    const { data: usedEvents } = await supabaseAdmin
      .from('live_events')
      .select('*')
      .eq('session_id', sessionId)
      .eq('event_type', 'followup_used')
      .order('created_at', { ascending: false })
      .limit(20)

    const usedFollowups = new Set(
      (usedEvents || [])
        .map((e: any) => e.payload?.followup)
        .filter(Boolean)
    )

    const manual = (followupEvents || []).find(
      (event: any) =>
        event.payload?.action_type === 'manual_followup' &&
        event.payload?.followup &&
        (event.payload?.target_round === roundNumber ||
          event.payload?.target_round == null) &&
        !usedFollowups.has(event.payload.followup)
    )

    if (manual?.payload?.followup) {
      followupToAsk = String(manual.payload.followup)
    }

    // ── Curveballs ──
    const { data: curveballUsedEvents } = await supabaseAdmin
      .from('live_events')
      .select('*')
      .eq('session_id', sessionId)
      .eq('event_type', 'curveball_used')
      .order('created_at', { ascending: false })
      .limit(20)

    const usedCurveballs = new Set(
      (curveballUsedEvents || [])
        .map((e: any) => e.payload?.curveball)
        .filter(Boolean)
    )

    const curveballEvent = (followupEvents || []).find(
      (event: any) =>
        event.payload?.action_type === 'inject_curveball' &&
        event.payload?.curveball &&
        (event.payload?.target_round === roundNumber ||
          event.payload?.target_round == null) &&
        !usedCurveballs.has(event.payload.curveball)
    )

    if (curveballEvent?.payload?.curveball) {
      curveballToInject = String(curveballEvent.payload.curveball)
    }

    // ── Persona switches ──
    const { data: personaUsedEvents } = await supabaseAdmin
      .from('live_events')
      .select('*')
      .eq('session_id', sessionId)
      .eq('event_type', 'persona_used')
      .order('created_at', { ascending: false })
      .limit(20)

    const usedPersonas = new Set(
      (personaUsedEvents || [])
        .map((e: any) => e.payload?.persona)
        .filter(Boolean)
    )

    const personaEvent = (followupEvents || []).find(
      (event: any) =>
        event.payload?.action_type === 'switch_persona' &&
        event.payload?.persona &&
        (event.payload?.target_round === roundNumber ||
          event.payload?.target_round == null) &&
        !usedPersonas.has(event.payload.persona)
    )

    if (personaEvent?.payload?.persona) {
      personaOverride = String(personaEvent.payload.persona)
    }
  } catch (error) {
    console.error('Interviewer controls fetch error:', error)
  }

  return {
    personaKey,
    customPersonaPrompt,
    injectedCurveballs,
    difficultyBoost,
    followupToAsk,
    curveballToInject,
    personaOverride,
  }
}

// ---------------------------------------------------------------------------
// Mark a control as consumed (logs to live_events)
// ---------------------------------------------------------------------------

export async function markControlConsumed(
  sessionId: string,
  type: 'curveball_used' | 'persona_used' | 'followup_used',
  value: string
): Promise<void> {
  const payloadKey =
    type === 'curveball_used'
      ? 'curveball'
      : type === 'persona_used'
        ? 'persona'
        : 'followup'

  await supabaseAdmin.from('live_events').insert({
    session_id: sessionId,
    event_type: type,
    actor: 'system',
    payload: { [payloadKey]: value },
  })
}
