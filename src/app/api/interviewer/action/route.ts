import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import crypto from 'crypto'
import { fetchScopePackage, getActiveRoundNumber, emitRedFlag, forceStopSession } from '@/lib/db/helpers'

type CurveballDefinition = {
  key: string
  title: string
  detail: string
}

const curveballLibrary: Record<string, CurveballDefinition> = {
  budget_cut: {
    key: 'budget_cut',
    title: 'Budget cut',
    detail: 'Finance just reduced the initiative budget by 15%. You must justify ROI and propose a credible path to fit constraints.'
  },
  security_concern: {
    key: 'security_concern',
    title: 'Security concern',
    detail: 'A security stakeholder is now involved. Expect deeper questions about data handling, compliance, and risk mitigation.'
  },
  timeline_mismatch: {
    key: 'timeline_mismatch',
    title: 'Timeline mismatch',
    detail: 'The prospect needs delivery in 6 weeks, but your standard implementation is longer. You must align expectations without overpromising.'
  },
  competitor_pressure: {
    key: 'competitor_pressure',
    title: 'Competitor pressure',
    detail: 'They are actively evaluating a competitor. You must differentiate with concrete value, proof, and a clear next step.'
  },
  cfo_pushback: {
    key: 'cfo_pushback',
    title: 'CFO pushback',
    detail: 'The CFO is pushing back on spend and risk. You must be crisp, factual, and quantify outcomes.'
  }
}

const personaSequence = ['skeptical_buyer', 'cfo_pushback', 'security_lead', 'champion'] as const

function toArray(value: unknown) {
  return Array.isArray(value) ? value : []
}

function normalizeRoundPlan(roundPlan: any) {
  return Array.isArray(roundPlan) ? roundPlan : []
}

function pickNextValue<T>(sequence: readonly T[], current: T | null) {
  if (sequence.length === 0) return null
  const index = current ? sequence.indexOf(current) : -1
  const nextIndex = index >= 0 ? (index + 1) % sequence.length : 0
  return sequence[nextIndex] ?? sequence[0]!
}

export async function POST(request: Request) {
  try {
    const { session_id, action_type, payload } = await request.json()

    if (!session_id || !action_type) {
      return NextResponse.json(
        { error: 'Missing required fields: session_id, action_type' },
        { status: 400 }
      )
    }

    await supabaseAdmin.from('live_events').insert({
      session_id,
      event_type: 'interviewer_action',
      actor: 'interviewer',
      payload: {
        action_type,
        ...payload
      }
    })

    const now = new Date().toISOString()

    // Controls that materially affect the live session should update the scope package/round plan
    // so candidate UI and AI endpoints can react deterministically.
    if (
      action_type === 'inject_curveball' ||
      action_type === 'switch_persona' ||
      action_type === 'end_round' ||
      action_type === 'escalate_difficulty'
    ) {
      const { data: scopePackage, error: scopeError } = await supabaseAdmin
        .from('interview_scope_packages')
        .select('id,round_plan,simulation_payloads')
        .eq('session_id', session_id)
        .single()

      if (scopeError) throw scopeError

      const roundPlan = normalizeRoundPlan(scopePackage?.round_plan)
      const simulationPayloads = scopePackage?.simulation_payloads || {}
      const interviewerControls = (simulationPayloads as any)?.interviewer_controls || {}

      const activeRound = roundPlan.find((round: any) => round?.status === 'active') || null
      const pendingRound = roundPlan.find((round: any) => round?.status === 'pending') || null
      const targetRoundNumber =
        payload?.target_round ?? activeRound?.round_number ?? pendingRound?.round_number ?? null

      if (action_type === 'escalate_difficulty') {
        const nextSimulationPayloads = {
          ...simulationPayloads,
          interviewer_controls: {
            ...interviewerControls,
            difficulty_boost: 1,
            difficulty_boosted_at: now
          }
        }

        const { error: updateScopeError } = await supabaseAdmin
          .from('interview_scope_packages')
          .update({ simulation_payloads: nextSimulationPayloads })
          .eq('id', scopePackage.id)

        if (updateScopeError) throw updateScopeError
      }

      if (action_type === 'switch_persona' && targetRoundNumber != null) {
        const existingRound = roundPlan.find((round: any) => round?.round_number === targetRoundNumber) || null
        const currentPersona = (existingRound?.config?.persona_override || existingRound?.config?.persona || null) as
          | (typeof personaSequence)[number]
          | null

        const nextPersona = pickNextValue(personaSequence, currentPersona)

        const updatedRoundPlan = roundPlan.map((round: any) => {
          if (round?.round_number !== targetRoundNumber) return round
          return {
            ...round,
            config: {
              ...(round?.config || {}),
              persona_override: nextPersona,
              persona_switched_at: now
            }
          }
        })

        const nextSimulationPayloads = {
          ...simulationPayloads,
          interviewer_controls: {
            ...interviewerControls,
            persona_override: nextPersona,
            persona_switched_at: now
          }
        }

        const { error: updateScopeError } = await supabaseAdmin
          .from('interview_scope_packages')
          .update({
            round_plan: updatedRoundPlan,
            simulation_payloads: nextSimulationPayloads
          })
          .eq('id', scopePackage.id)

        if (updateScopeError) throw updateScopeError
      }

      if (action_type === 'inject_curveball' && targetRoundNumber != null) {
        const existingRound = roundPlan.find((round: any) => round?.round_number === targetRoundNumber) || null
        const configuredCurveballs = toArray(existingRound?.config?.curveballs).map(String)
        const existingInjected = toArray(existingRound?.config?.injected_curveballs)

        const injectedKeys = new Set(
          existingInjected
            .map((item: any) => (typeof item === 'string' ? item : item?.key))
            .filter(Boolean)
        )

        const candidateKeys = (payload?.curveball_key ? [String(payload.curveball_key)] : configuredCurveballs).filter(Boolean)
        const fallbackKeys = Object.keys(curveballLibrary)
        const selectionPool = candidateKeys.length > 0 ? candidateKeys : fallbackKeys

        const nextKey =
          selectionPool.find((key) => !injectedKeys.has(key)) || selectionPool[0] || fallbackKeys[0] || 'budget_cut'

        const definition = curveballLibrary[nextKey] || {
          key: nextKey,
          title: nextKey.replace(/_/g, ' '),
          detail: 'New constraint injected by interviewer.'
        }

        const nextInjected = [
          ...existingInjected,
          {
            ...definition,
            injected_at: now,
            injected_by: 'interviewer'
          }
        ]

        const updatedRoundPlan = roundPlan.map((round: any) => {
          if (round?.round_number !== targetRoundNumber) return round
          return {
            ...round,
            config: {
              ...(round?.config || {}),
              injected_curveballs: nextInjected
            }
          }
        })

        const nextSimulationPayloads = {
          ...simulationPayloads,
          interviewer_controls: {
            ...interviewerControls,
            last_curveball: {
              ...definition,
              round_number: targetRoundNumber,
              injected_at: now
            }
          }
        }

        const { error: updateScopeError } = await supabaseAdmin
          .from('interview_scope_packages')
          .update({
            round_plan: updatedRoundPlan,
            simulation_payloads: nextSimulationPayloads
          })
          .eq('id', scopePackage.id)

        if (updateScopeError) throw updateScopeError
      }

      if (action_type === 'end_round') {
        const roundPlanForEnd = normalizeRoundPlan(scopePackage?.round_plan)
        const active = roundPlanForEnd.find((round: any) => round?.status === 'active') || null

        if (active?.round_number == null) {
          return NextResponse.json({ ok: true, applied: { action_type, note: 'No active round to end.' } })
        }

        const activeRoundNumber = active.round_number

        let nextRoundToStart: any = null
        const nextRoundCandidate = roundPlanForEnd
          .filter((round: any) => round?.round_number > activeRoundNumber && round?.status === 'pending')
          .sort((a: any, b: any) => Number(a.round_number || 0) - Number(b.round_number || 0))[0]

        const updatedRoundPlan = roundPlanForEnd.map((round: any) => {
          if (round?.round_number === activeRoundNumber) {
            return {
              ...round,
              status: 'completed',
              completed_at: now
            }
          }
          if (nextRoundCandidate && round?.round_number === nextRoundCandidate.round_number) {
            nextRoundToStart = round
            return {
              ...round,
              status: 'active',
              started_at: now
            }
          }
          return round
        })

        const { error: updateScopeError } = await supabaseAdmin
          .from('interview_scope_packages')
          .update({ round_plan: updatedRoundPlan })
          .eq('id', scopePackage.id)

        if (updateScopeError) throw updateScopeError

        // Session status updates
        if (nextRoundCandidate) {
          await supabaseAdmin
            .from('interview_sessions')
            .update({ status: 'live' })
            .eq('id', session_id)
        } else {
          await supabaseAdmin
            .from('interview_sessions')
            .update({ status: 'completed' })
            .eq('id', session_id)
        }

        // Log round boundary events for audit + UI timelines.
        await supabaseAdmin.from('live_events').insert([
          {
            session_id,
            event_type: 'round_completed',
            actor: 'interviewer',
            payload: { round_number: activeRoundNumber, ended_by: 'interviewer', ended_at: now }
          },
          ...(nextRoundCandidate
            ? [
                {
                  session_id,
                  event_type: 'round_started',
                  actor: 'interviewer',
                  payload: { round_number: nextRoundCandidate.round_number, started_by: 'interviewer', started_at: now }
                }
              ]
            : [])
        ])
      }
    }

    if (action_type === 'role_widget_config') {
      const { data: scopePackage, error: scopeError } = await supabaseAdmin
        .from('interview_scope_packages')
        .select('id,simulation_payloads')
        .eq('session_id', session_id)
        .single()

      if (scopeError) throw scopeError

      const simulationPayloads = scopePackage?.simulation_payloads || {}
      const nextSimulationPayloads = {
        ...simulationPayloads,
        role_widget_config: {
          role_family: payload?.role_family || null,
          lanes: Array.isArray(payload?.lanes) ? payload.lanes : []
        }
      }

      const { error: updateScopeError } = await supabaseAdmin
        .from('interview_scope_packages')
        .update({ simulation_payloads: nextSimulationPayloads })
        .eq('id', scopePackage.id)

      if (updateScopeError) throw updateScopeError
    }

    if (action_type === 'manual_followup' && payload?.followup) {
      let roundNumber = payload?.round_number ?? payload?.target_round ?? null

      if (!roundNumber) {
        try {
          const scopePackage = await fetchScopePackage(session_id)
          roundNumber = getActiveRoundNumber(scopePackage?.round_plan || [])
        } catch { /* proceed without round number */ }
      }

      const questionId = crypto.randomUUID()

      // Always create a single followup_question event (no separate interviewer_action
      // for manual follow-ups — the followup_question event is the canonical source)
      await supabaseAdmin.from('live_events').insert({
        session_id,
        event_type: 'followup_question',
        actor: 'interviewer',
        payload: {
          round_number: roundNumber,
          question_id: questionId,
          question: payload.followup,
          source: 'manual'
        }
      })

      const { data: scores } = await supabaseAdmin
        .from('scores')
        .select('*')
        .eq('session_id', session_id)
        .order('created_at', { ascending: false })
        .limit(1)

      const latest = scores?.[0]
      if (latest) {
        const existing = Array.isArray(latest.recommended_followups)
          ? latest.recommended_followups
          : []
        const updated = [...existing, String(payload.followup)]

        await supabaseAdmin
          .from('scores')
          .update({ recommended_followups: updated })
          .eq('id', latest.id)
      }
    }

    if (action_type !== 'manual_followup') {
      await supabaseAdmin.from('live_events').insert({
        session_id,
        event_type: 'interviewer_action',
        actor: 'interviewer',
        payload: {
          action_type,
          ...payload
        }
      })
    }

    if (action_type === 'escalate_difficulty') {
      const roundNumber = payload?.round_number ?? payload?.target_round ?? null
      if (roundNumber) {
        await supabaseAdmin.from('live_events').insert({
          session_id,
          event_type: 'difficulty_escalation',
          actor: 'interviewer',
          payload: {
            round_number: roundNumber,
            level: payload?.level || 'L3',
            source: payload?.source || 'interviewer'
          }
        })
      }
    }

    // Flag red flag: interviewer manually flags a concern
    if (action_type === 'flag_red_flag') {
      const { flag_type, description, severity } = payload || {}
      let roundNumber = payload?.round_number ?? null

      if (!roundNumber) {
        try {
          const scopePackage = await fetchScopePackage(session_id)
          roundNumber = getActiveRoundNumber(scopePackage?.round_plan || [])
        } catch { /* proceed without round number */ }
      }

      await emitRedFlag(session_id, {
        flag_type: flag_type || 'custom',
        severity: severity || 'warning',
        description: description || 'Flagged by interviewer',
        auto_stop: severity === 'critical',
        round_number: roundNumber,
        actor: 'interviewer',
      })

      if (severity === 'critical') {
        await forceStopSession(
          session_id,
          `Critical red flag: ${description || flag_type || 'interviewer observation'}`,
          'interviewer'
        )
      }
    }

    // Override score: interviewer can correct the AI-generated score
    if (action_type === 'override_score') {
      const { round, overall_score, dimension_scores, recommendation, reason } = payload || {}
      if (typeof round === 'number') {
        // Fetch latest score for this round
        const { data: scores } = await supabaseAdmin
          .from('scores')
          .select('*')
          .eq('session_id', session_id)
          .eq('round', round)
          .order('created_at', { ascending: false })
          .limit(1)

        const latest = scores?.[0]
        if (latest) {
          const updates: Record<string, any> = {
            overridden_by: 'interviewer',
            override_reason: reason || 'Interviewer override'
          }
          if (typeof overall_score === 'number') updates.overall_score = overall_score
          if (dimension_scores) updates.dimension_scores = dimension_scores
          if (recommendation) updates.recommendation = recommendation

          await supabaseAdmin
            .from('scores')
            .update(updates)
            .eq('id', latest.id)

          await supabaseAdmin.from('live_events').insert({
            session_id,
            event_type: 'score_override',
            actor: 'interviewer',
            payload: {
              round,
              previous_score: latest.overall_score,
              new_score: overall_score ?? latest.overall_score,
              previous_recommendation: latest.recommendation,
              new_recommendation: recommendation ?? latest.recommendation,
              reason: reason || 'Interviewer override'
            }
          })
        }
      }
    }

    // Override recommendation: quick action to change proceed/caution/stop
    if (action_type === 'override_recommendation') {
      const { round, recommendation, reason } = payload || {}
      if (typeof round === 'number' && recommendation) {
        const { data: scores } = await supabaseAdmin
          .from('scores')
          .select('*')
          .eq('session_id', session_id)
          .eq('round', round)
          .order('created_at', { ascending: false })
          .limit(1)

        const latest = scores?.[0]
        if (latest) {
          await supabaseAdmin
            .from('scores')
            .update({ recommendation })
            .eq('id', latest.id)

          await supabaseAdmin.from('live_events').insert({
            session_id,
            event_type: 'recommendation_override',
            actor: 'interviewer',
            payload: {
              round,
              previous: latest.recommendation,
              new: recommendation,
              reason: reason || 'Interviewer override'
            }
          })
        }
      }
    }

    // Force advance: skip current round and start next
    if (action_type === 'force_advance') {
      try {
        const scopePackage = await fetchScopePackage(session_id)
        const roundPlan = (scopePackage.round_plan || []) as Array<Record<string, any>>
        const activeIndex = roundPlan.findIndex((r: any) => r.status === 'active')

        if (activeIndex >= 0) {
          roundPlan[activeIndex].status = 'completed'
          roundPlan[activeIndex].completed_at = new Date().toISOString()

          const nextIndex = roundPlan.findIndex((r: any, i: number) => i > activeIndex && r.status === 'pending')
          if (nextIndex >= 0) {
            roundPlan[nextIndex].status = 'active'
            roundPlan[nextIndex].started_at = new Date().toISOString()
          }

          await supabaseAdmin
            .from('interview_scope_packages')
            .update({ round_plan: roundPlan })
            .eq('id', scopePackage.id)

          await supabaseAdmin.from('live_events').insert({
            session_id,
            event_type: 'round_force_advanced',
            actor: 'interviewer',
            payload: {
              skipped_round: roundPlan[activeIndex].round_number,
              next_round: nextIndex >= 0 ? roundPlan[nextIndex].round_number : null,
              reason: payload?.reason || 'Interviewer force advance'
            }
          })
        }
      } catch (e) {
        console.error('Force advance error:', e)
      }
    }

    // Force stop: end the entire session immediately
    if (action_type === 'force_stop') {
      await forceStopSession(
        session_id,
        payload?.reason || 'Interviewer force stop',
        'interviewer'
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('Interviewer action error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
