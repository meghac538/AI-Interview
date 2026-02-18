import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import crypto from 'crypto'
import { fetchScopePackage, getActiveRoundNumber, emitRedFlag, forceStopSession } from '@/lib/db/helpers'
import { getCurveballByKey, getPersonasForTrack, CURVEBALL_LIBRARY } from '@/lib/constants/curveball-library'
import { getAIClient, mapModel } from '@/lib/ai/client'
import { requireInterviewer } from '@/lib/supabase/require-role'

// Round types where the AI handles curveballs in conversation — no need to contextualize
const CONVERSATIONAL_ROUNDS = new Set(['voice', 'voice-realtime', 'email', 'agentic'])

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
    const gate = await requireInterviewer(request)
    if (!gate.ok) return gate.response

    const { session_id, action_type, payload } = await request.json()

    if (!session_id || !action_type) {
      return NextResponse.json(
        { error: 'Missing required fields: session_id, action_type' },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()

    // For interviewer_note, use a distinct event_type so notes are easily queryable
    if (action_type === 'interviewer_note') {
      const { error: noteError } = await supabaseAdmin.from('live_events').insert({
        session_id,
        event_type: 'interviewer_note',
        actor: 'interviewer',
        payload: {
          note: payload?.note || '',
          created_at: now
        }
      })
      if (noteError) {
        console.error('Failed to save interviewer note:', noteError)
        throw noteError
      }
      return NextResponse.json({ ok: true, event_type: 'interviewer_note' })
    }

    // Generic action log for all other actions
    await supabaseAdmin.from('live_events').insert({
      session_id,
      event_type: 'interviewer_action',
      actor: 'interviewer',
      payload: {
        action_type,
        ...payload
      }
    })

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
        const currentPersona = (existingRound?.config?.persona_override || existingRound?.config?.persona || null) as string | null

        // Support custom persona text, explicit persona key, or cycle through track-aware personas
        const customText = payload?.custom_text ? String(payload.custom_text).slice(0, 1000) : null
        let nextPersona: string | null = null

        if (customText) {
          nextPersona = 'custom'
        } else if (payload?.persona) {
          nextPersona = String(payload.persona)
        } else {
          const track = existingRound?.config?.track || payload?.track || 'sales'
          const trackPersonas = getPersonasForTrack(track)
          const personaKeys = trackPersonas.map((p) => p.key)
          nextPersona = pickNextValue(personaKeys, currentPersona)
        }

        const updatedRoundPlan = roundPlan.map((round: any) => {
          if (round?.round_number !== targetRoundNumber) return round
          return {
            ...round,
            config: {
              ...(round?.config || {}),
              persona_override: nextPersona,
              custom_persona_prompt: customText || undefined,
              persona_switched_at: now
            }
          }
        })

        const nextSimulationPayloads = {
          ...simulationPayloads,
          interviewer_controls: {
            ...interviewerControls,
            persona_override: nextPersona,
            custom_persona_prompt: customText || undefined,
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

        // Support custom text curveballs
        const customText = payload?.custom_text ? String(payload.custom_text).slice(0, 500) : null

        let definition: { key: string; title: string; detail: string }

        if (customText) {
          definition = {
            key: `custom_${Date.now()}`,
            title: 'Custom constraint',
            detail: customText,
          }
        } else {
          const candidateKeys = (payload?.curveball_key ? [String(payload.curveball_key)] : configuredCurveballs).filter(Boolean)
          const fallbackKeys = CURVEBALL_LIBRARY.map((c) => c.key)
          const selectionPool = candidateKeys.length > 0 ? candidateKeys : fallbackKeys

          const nextKey =
            selectionPool.find((key) => !injectedKeys.has(key)) || selectionPool[0] || fallbackKeys[0] || 'budget_cut'

          const fromLibrary = getCurveballByKey(nextKey)
          definition = fromLibrary
            ? { key: fromLibrary.key, title: fromLibrary.title, detail: fromLibrary.detail }
            : { key: nextKey, title: nextKey.replace(/_/g, ' '), detail: 'New constraint injected by interviewer.' }
        }

        // For non-conversational rounds (text/code/mcq), contextualize library curveballs
        // so they relate to the round's actual prompt instead of being generic.
        // Skip custom curveballs — the interviewer already wrote context-specific text.
        const roundType = existingRound?.round_type || existingRound?.config?.round_type || ''
        if (!customText && !CONVERSATIONAL_ROUNDS.has(roundType) && existingRound?.prompt) {
          try {
            const ai = getAIClient()
            const contextResponse = await ai.chat.completions.create({
              model: mapModel('gpt-4o-mini'),
              temperature: 0.7,
              max_tokens: 200,
              messages: [
                {
                  role: 'system',
                  content:
                    'You are an interview design assistant. You rewrite generic curveball constraints ' +
                    'so they are specific and relevant to the interview round the candidate is working on. ' +
                    'Keep the same category/spirit of the constraint but rewrite the title and detail ' +
                    'so they directly relate to the round topic and question. ' +
                    'The candidate should immediately understand how this constraint affects their current task. ' +
                    'Output ONLY a JSON object with "title" and "detail" keys. No markdown, no explanation.'
                },
                {
                  role: 'user',
                  content:
                    `Round type: ${roundType}\n` +
                    `Round title: ${existingRound.title || 'Untitled'}\n` +
                    `Round prompt:\n${existingRound.prompt.slice(0, 600)}\n\n` +
                    `Curveball to contextualize:\nTitle: ${definition.title}\nDetail: ${definition.detail}\n\n` +
                    'Rewrite the title and detail so the constraint is specific to this round\'s topic and question.'
                }
              ]
            })

            const raw = contextResponse.choices?.[0]?.message?.content?.trim() || ''
            const parsed = JSON.parse(raw)
            if (parsed.title && parsed.detail) {
              definition = {
                ...definition,
                title: String(parsed.title).slice(0, 100),
                detail: String(parsed.detail).slice(0, 500)
              }
            }
          } catch (ctxErr) {
            // If contextualization fails, proceed with the original definition
            console.warn('Curveball contextualization failed, using original:', ctxErr)
          }
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

        // For non-conversational rounds, displaying the curveball IS the consumption.
        // Emit curveball_used immediately so the dashboard shows "Used" instead of "Pending".
        if (!CONVERSATIONAL_ROUNDS.has(roundType)) {
          const originalKey = payload?.curveball_key || payload?.curveball || definition.key
          await supabaseAdmin.from('live_events').insert({
            session_id,
            event_type: 'curveball_used',
            actor: 'system',
            payload: {
              curveball: originalKey,
              definition_key: definition.key,
              round_number: targetRoundNumber,
              source: 'auto_display'
            }
          })
        }
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
