'use client'

import { useMemo } from 'react'
import { useParams } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { GatePanel } from '@/components/GatePanel'
import { SessionProvider, useSession } from '@/contexts/SessionContext'

type TranscriptEntry = {
  speaker: string
  content: string
  time: string
}

type ActionEntry = {
  action: string
  detail?: string
  time: string
}

function buildGateData(scores: any[]) {
  if (!scores || scores.length === 0) {
    return {
      overall: 0,
      confidence: 0,
      dimensions: [],
      redFlags: [],
      followups: []
    }
  }

  const latest = scores[0] as any

  if (latest.overall_score !== undefined || latest.dimension_scores) {
    const dimensionScores = latest.dimension_scores || {}
    const dimensions = Object.entries(dimensionScores).map(([label, score]) => ({
      label,
      score: Number(score) || 0,
      max: 100
    }))

    const followups = normalizeFollowups(latest.recommended_followups || latest.followups)
    const derived = followups.length === 0 ? deriveFollowupsFromDimensions(dimensions) : followups

    return {
      overall: Number(latest.overall_score) || 0,
      confidence: Number(latest.confidence) || 0,
      dimensions,
      redFlags: normalizeRedFlags(latest.red_flags),
      followups: derived
    }
  }

  const dimensionRows = scores
    .filter((row: any) => row.dimension && row.score !== undefined)
    .slice(0, 10)

  const maxPerDimension = 30
  const avgScore =
    dimensionRows.reduce((acc: number, row: any) => acc + Number(row.score || 0), 0) /
    Math.max(1, dimensionRows.length)
  const overall = Math.round((avgScore / maxPerDimension) * 100)
  const confidence =
    dimensionRows.reduce((acc: number, row: any) => acc + Number(row.confidence || 0), 0) /
    Math.max(1, dimensionRows.length)

  const dimensions = dimensionRows.map((row: any) => ({
    label: String(row.dimension || '').replace(/_/g, ' '),
    score: Number(row.score) || 0,
    max: maxPerDimension
  }))

  const followups = deriveFollowupsFromDimensions(dimensions)

  return {
    overall,
    confidence,
    dimensions,
    redFlags: [],
    followups
  }
}

function normalizeRedFlags(redFlags: any) {
  if (!redFlags) return []
  if (Array.isArray(redFlags)) {
    return redFlags.map((flag) => ({
      label: flag.label || flag.type || 'Red flag',
      detail: flag.detail || flag.description
    }))
  }
  if (typeof redFlags === 'object') {
    return Object.entries(redFlags).map(([label, detail]) => ({
      label,
      detail: typeof detail === 'string' ? detail : undefined
    }))
  }
  return []
}

function normalizeFollowups(followups: any) {
  if (!followups) return []
  if (Array.isArray(followups)) return followups.map(String)
  if (typeof followups === 'string') return [followups]
  return []
}

function deriveFollowupsFromDimensions(
  dimensions: Array<{ label: string; score: number; max?: number }>
) {
  return dimensions
    .filter((dimension) => dimension.score < 15)
    .slice(0, 4)
    .map((dimension) => `Probe ${dimension.label} with a targeted follow-up.`)
}

function buildTranscript(events: any[]) {
  const entries: TranscriptEntry[] = []

  for (const event of events || []) {
    if (event.event_type === 'prospect_message') {
      const candidateMessage = event.payload?.candidate_message
      const prospectResponse = event.payload?.prospect_response
      const time = new Date(event.created_at).toLocaleTimeString()

      if (candidateMessage && candidateMessage !== '__start__') {
        entries.push({
          speaker: 'Candidate',
          content: candidateMessage,
          time
        })
      }

      if (prospectResponse) {
        entries.push({
          speaker: 'Prospect',
          content: prospectResponse,
          time
        })
      }
    }
  }

  return entries.reverse()
}

function buildActionLog(events: any[]) {
  const actions: ActionEntry[] = []
  const included = new Set([
    'round_started',
    'round_completed',
    'artifact_submitted',
    'scoring_completed',
    'interviewer_action',
    'candidate_action'
  ])

  for (const event of events || []) {
    if (!included.has(event.event_type)) continue

    const time = new Date(event.created_at).toLocaleTimeString()
    const roundNumber = event.payload?.round_number
    const detail =
      event.event_type === 'interviewer_action'
        ? event.payload?.action_type
        : event.event_type === 'candidate_action'
          ? event.payload?.message || event.payload?.action
          : event.payload?.artifact_type || event.payload?.action || roundNumber

    const label =
      event.event_type === 'round_started'
        ? `Round ${roundNumber} started`
        : event.event_type === 'round_completed'
          ? `Round ${roundNumber} completed`
          : event.event_type === 'candidate_action'
            ? 'Candidate message'
            : event.event_type.replace(/_/g, ' ')

    actions.push({
      action: label,
      detail: detail ? String(detail) : undefined,
      time
    })
  }

  return actions
}

function InterviewerView() {
  const { session, scores, events, rounds } = useSession()

  const gateData = useMemo(() => buildGateData(scores as any[]), [scores])
  const transcript = useMemo(() => buildTranscript(events as any[]), [events])
  const actionLog = useMemo(() => buildActionLog(events as any[]), [events])
  const noAnswerFlag = useMemo(() => {
    return gateData.redFlags.some((flag) =>
      ['insufficient_response', 'no_evidence'].includes(flag.label)
    )
  }, [gateData.redFlags])
  const roundTimeline = useMemo(() => {
    return (rounds || []).map((round) => {
      const startedAt = round.started_at ? new Date(round.started_at) : null
      const durationMs = (round.duration_minutes || 0) * 60 * 1000
      const endsAt = startedAt ? new Date(startedAt.getTime() + durationMs) : null
      return {
        round_number: round.round_number,
        title: round.title,
        status: round.status || 'pending',
        startedAt,
        endsAt,
        durationMinutes: round.duration_minutes
      }
    })
  }, [rounds])

  if (!session) return null

  const candidateName = (session as any).candidate?.name || 'Candidate'
  const jobTitle = (session as any).job?.title || 'Role'
  const jobLevel = (session as any).job?.level_band || 'mid'

  const sendAction = async (action_type: string, payload?: Record<string, any>) => {
    await fetch('/api/interviewer/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: session.id,
        action_type,
        payload
      })
    })
  }

  const sendDecision = async (decision: 'proceed' | 'stop') => {
    await sendAction('gate_decision', { decision })
    if (decision === 'stop') {
      await fetch(`/api/session/${session.id}/terminate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'interviewer_stop' })
      })
      return
    }

    const activeRound = (rounds || []).find((round) => round.status === 'active')
    const nextRound = (rounds || []).find((round) => round.status === 'pending')

    if (activeRound) {
      await fetch('/api/round/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.id,
          round_number: activeRound.round_number
        })
      })
    }

    if (nextRound) {
      await fetch('/api/round/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.id,
          round_number: nextRound.round_number
        })
      })
    }
  }

  const escalateDifficulty = async () => {
    const nextRound = (rounds || []).find((round) => round.status === 'pending')
    await sendAction('escalate_difficulty', {
      target_round: nextRound?.round_number ?? null
    })
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#eef6ff_0%,#f7f7fb_35%,#fefefe_100%)] px-6 py-10">
      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1.1fr,1fr]">
        <section className="space-y-6">
          <Card className="bg-white/90">
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-500">
                  Live Interview
                </p>
                <Badge tone="sky">{session.status}</Badge>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-ink-900">{candidateName}</h1>
                <p className="text-sm text-ink-500">
                  {jobTitle} • Level {jobLevel}
                </p>
              </div>
            </CardHeader>
          </Card>

          <Card className="animate-rise-in bg-white/90">
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Live Transcript</h2>
                <Badge tone="sky">Monitoring</Badge>
              </div>
              <p className="text-sm text-ink-500">
                Real-time conversation and candidate responses.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {noAnswerFlag && (
                <div className="rounded-2xl border border-signal-200 bg-signal-100 px-4 py-3 text-sm text-signal-800">
                  Candidate responses are too short to evaluate. Marked as insufficient response.
                </div>
              )}
              {transcript.length === 0 && (
                <div className="rounded-2xl bg-ink-50 px-4 py-3 text-sm text-ink-500">
                  Transcript will populate once the conversation starts.
                </div>
              )}
              {transcript.map((entry, index) => (
                <div key={`${entry.time}-${index}`} className="rounded-2xl bg-ink-100 px-4 py-3">
                  <div className="flex items-center justify-between text-xs text-ink-500">
                    <span>{entry.speaker}</span>
                    <span>{entry.time}</span>
                  </div>
                  <p className="mt-2 text-sm text-ink-800">{entry.content}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-white/90">
            <CardHeader>
              <h3 className="text-base font-semibold">Round Timeline</h3>
            </CardHeader>
            <CardContent className="space-y-3">
              {roundTimeline.length === 0 && (
                <div className="rounded-2xl bg-ink-50 px-4 py-3 text-sm text-ink-500">
                  Round timeline will appear once the scope package is loaded.
                </div>
              )}
              {roundTimeline.map((round) => (
                <div
                  key={round.round_number}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-ink-100 bg-white px-4 py-3 text-sm"
                >
                  <div>
                    <div className="font-semibold text-ink-900">
                      Round {round.round_number}: {round.title}
                    </div>
                    <div className="text-xs text-ink-500">
                      {round.startedAt
                        ? `${round.startedAt.toLocaleTimeString()} → ${round.endsAt?.toLocaleTimeString()}`
                        : `Duration: ${round.durationMinutes} min`}
                    </div>
                  </div>
                  <Badge tone={round.status === 'active' ? 'sky' : round.status === 'completed' ? 'emerald' : 'ink'}>
                    {round.status}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-white/90">
            <CardHeader>
              <h3 className="text-base font-semibold">Candidate Action Log</h3>
            </CardHeader>
            <CardContent className="space-y-2">
              {actionLog.length === 0 && (
                <div className="rounded-2xl bg-ink-50 px-4 py-3 text-sm text-ink-500">
                  Waiting for candidate actions.
                </div>
              )}
              {actionLog.map((entry, index) => (
                <div key={`${entry.time}-${index}`} className="flex items-center justify-between text-sm">
                  <span className="text-ink-700">{entry.action}</span>
                  <span className="text-xs text-ink-500">{entry.detail}</span>
                  <span className="text-xs text-ink-400">{entry.time}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <aside className="space-y-6">
          <GatePanel
            overall={gateData.overall}
            confidence={gateData.confidence}
            dimensions={gateData.dimensions}
            redFlags={gateData.redFlags}
            followups={gateData.followups}
            onDecision={sendDecision}
            onAction={(action) => {
              if (action === 'escalate') {
                escalateDifficulty()
              }
            }}
            onAddFollowup={async (followup) => {
              await sendAction('manual_followup', { followup })
            }}
          />
          <Card className="bg-white/90">
            <CardHeader>
              <h3 className="text-base font-semibold">Interviewer Notes</h3>
            </CardHeader>
            <CardContent>
              <textarea
                rows={6}
                className="w-full rounded-2xl border border-ink-100 bg-white px-4 py-3 text-sm"
                placeholder="Capture context for the final recommendation..."
              />
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  )
}

export default function InterviewerSessionPage() {
  const params = useParams()
  const sessionId = params.sessionId as string

  return (
    <SessionProvider sessionId={sessionId}>
      <InterviewerView />
    </SessionProvider>
  )
}
