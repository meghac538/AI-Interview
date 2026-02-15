'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Slash } from 'lucide-react'
import { useParams } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { GatePanel } from '@/components/GatePanel'
import type { RedFlagEntry } from '@/components/GatePanel'
import { RED_FLAG_TYPES } from '@/lib/constants/red-flags'
import type { RedFlagTypeKey } from '@/lib/constants/red-flags'
import { VoiceControlPanel } from '@/components/VoiceControlPanel'
import { AIAssessmentsPanel } from '@/components/AIAssessmentsPanel'
import { SessionProvider, useSession } from '@/contexts/SessionContext'
import { useVoiceAnalysis } from '@/hooks/useVoiceAnalysis'
import { SayMeter } from '@/components/voice/SayMeter'
import { SuggestionsPanel } from '@/components/voice/SuggestionsPanel'

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

// Analyze live transcript in real-time
function analyzeTranscript(transcript: TranscriptEntry[]) {
  if (!transcript || transcript.length === 0) {
    return {
      overall: 0,
      confidence: 0,
      dimensions: [],
      redFlags: [] as RedFlagEntry[],
      truthLog: [],
      followups: []
    }
  }

  const userMessages = transcript.filter(t => t.speaker === 'Candidate')
  const agentMessages = transcript.filter(t => t.speaker === 'Prospect')

  // Calculate metrics
  const avgUserLength = userMessages.reduce((sum, m) => sum + m.content.length, 0) / Math.max(userMessages.length, 1)
  const avgAgentLength = agentMessages.reduce((sum, m) => sum + m.content.length, 0) / Math.max(agentMessages.length, 1)
  const totalTurns = transcript.length
  const userTurns = userMessages.length

  // Dimension scores (0-100)
  const dimensions = []

  // Engagement: based on response length and frequency
  const engagementScore = Math.min(100, (avgUserLength / 150) * 100)
  dimensions.push({ label: 'Engagement', score: Math.round(engagementScore), max: 100 })

  // Clarity: based on sentence structure (simple heuristic)
  const clarityScore = avgUserLength > 20 && avgUserLength < 300 ? 80 : 50
  dimensions.push({ label: 'Clarity', score: clarityScore, max: 100 })

  // Turn-taking: balanced conversation
  const balanceRatio = userTurns / Math.max(totalTurns, 1)
  const turnTakingScore = Math.max(0, 100 - Math.abs(0.5 - balanceRatio) * 200)
  dimensions.push({ label: 'Turn-taking', score: Math.round(turnTakingScore), max: 100 })

  // Overall score (average of dimensions)
  const overall = Math.round(dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length)

  // Detect red flags
  const redFlags = []

  if (avgUserLength < 30) {
    redFlags.push({
      label: 'Short responses',
      detail: 'Candidate responses are too brief, lacking detail'
    })
  }

  if (userTurns < 3 && transcript.length > 6) {
    redFlags.push({
      label: 'Low engagement',
      detail: 'Candidate not participating actively in conversation'
    })
  }

  const lastUserMessage = userMessages[userMessages.length - 1]
  if (lastUserMessage && (
    lastUserMessage.content.toLowerCase().includes('i don\'t know') ||
    lastUserMessage.content.toLowerCase().includes('not sure')
  )) {
    redFlags.push({
      label: 'Uncertainty',
      detail: 'Candidate expressing uncertainty or lack of knowledge'
    })
  }

  // Generate follow-ups based on conversation
  const followups = []

  if (avgUserLength < 50) {
    followups.push('Ask for specific examples or stories')
  }

  if (redFlags.length > 0) {
    followups.push('Probe deeper on areas of concern')
  }

  if (userTurns > 0 && agentMessages.length > 0) {
    followups.push('Ask about their problem-solving approach')
  }

  // Confidence based on sample size
  const confidence = Math.min(0.9, (transcript.length / 10) * 0.3 + 0.4)

  return {
    overall,
    confidence,
    dimensions,
    redFlags: redFlags.map((r) => ({
      label: r.label,
      detail: r.detail,
      severity: 'warning' as const,
      source: 'system' as const
    })),
    truthLog: [],
    followups
  }
}

function buildGateData(scores: any[], events?: any[]) {
  const eventFollowups = (events || [])
    .filter((event) => event.event_type === 'followup_question')
    .map((event) => String(event.payload?.question || '').trim())
    .filter(Boolean)

  const manualFollowups = (events || [])
    .filter(
      (event) =>
        event.event_type === 'interviewer_action' &&
        event.payload?.action_type === 'manual_followup'
    )
    .map((event) => String(event.payload?.followup || '').trim())
    .filter(Boolean)

  const eventRedFlags: RedFlagEntry[] = (events || [])
    .filter((e) => e.event_type === 'red_flag_detected')
    .map((e) => ({
      label: formatFlagType(e.payload?.flag_type || 'red_flag'),
      detail: e.payload?.description,
      source: e.actor || 'system',
      severity: (e.payload?.severity || 'warning') as 'critical' | 'warning',
      auto_stop: e.payload?.auto_stop || false,
      created_at: e.created_at
    }))

  if (!scores || scores.length === 0) {
    return {
      overall: 0,
      confidence: 0,
      dimensions: [],
      redFlags: eventRedFlags,
      truthLog: [],
      followups: Array.from(new Set([...eventFollowups, ...manualFollowups]))
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
    const mergedFollowups = Array.from(
      new Set([...eventFollowups, ...manualFollowups, ...derived])
    )

    const scoreRedFlags = normalizeRedFlags(latest.red_flags)
    // Merge + deduplicate by label
    const seen = new Set<string>()
    const mergedRedFlags: RedFlagEntry[] = []
    for (const flag of [...eventRedFlags, ...scoreRedFlags]) {
      const key = `${flag.label}-${flag.source}`
      if (!seen.has(key)) {
        seen.add(key)
        mergedRedFlags.push(flag)
      }
    }

    return {
      overall: Number(latest.overall_score) || 0,
      confidence: Number(latest.confidence) || 0,
      dimensions,
      redFlags: mergedRedFlags,
      truthLog: normalizeEvidenceQuotes(
        latest.evidence_quotes || latest.evidence || latest.truth_log
      ),
      followups: mergedFollowups
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

  const followups = Array.from(
    new Set([
      ...eventFollowups,
      ...manualFollowups,
      ...deriveFollowupsFromDimensions(dimensions)
    ])
  )

  return {
    overall,
    confidence,
    dimensions,
    redFlags: [],
    truthLog: [],
    followups
  }
}

function normalizeRedFlags(redFlags: any): RedFlagEntry[] {
  if (!redFlags) return []
  if (Array.isArray(redFlags)) {
    return redFlags.map((flag) => ({
      label: flag.label || flag.flag_type || flag.type || 'Red flag',
      detail: flag.detail || flag.description,
      severity: flag.severity || 'warning',
      source: flag.source || 'system',
      auto_stop: flag.auto_stop || false,
      created_at: flag.created_at
    }))
  }
  if (typeof redFlags === 'object') {
    return Object.entries(redFlags).map(([label, detail]) => ({
      label,
      detail: typeof detail === 'string' ? detail : undefined,
      severity: 'warning' as const,
      source: 'system'
    }))
  }
  return []
}

function formatFlagType(flagType: string): string {
  const entry = RED_FLAG_TYPES[flagType as RedFlagTypeKey]
  if (entry) return entry.label
  return flagType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function normalizeEvidenceQuotes(evidence: any) {
  if (!evidence) return []
  if (Array.isArray(evidence)) {
    return evidence
      .map((item) => ({
        dimension: String(item.dimension || item.label || 'Evidence').replace(/_/g, ' '),
        quote: String(item.quote || item.evidence || item.text || '').trim(),
        line: item.line
      }))
      .filter((item) => item.quote.length > 0)
  }
  if (typeof evidence === 'object') {
    return Object.entries(evidence)
      .map(([dimension, quote]) => ({
        dimension: String(dimension || 'Evidence').replace(/_/g, ' '),
        quote: String(quote || '').trim()
      }))
      .filter((item) => item.quote.length > 0)
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
    // Handle voice-realtime transcript events
    if (event.event_type === 'voice_transcript') {
      const role = event.payload?.role
      const text = event.payload?.text
      const time = new Date(event.created_at).toLocaleTimeString()

      if (text) {
        entries.push({
          speaker: role === 'user' ? 'Candidate' : 'Prospect',
          content: text,
          time
        })
      }
    }
    // Handle legacy prospect_message events
    else if (event.event_type === 'prospect_message') {
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
    'candidate_action',
    'difficulty_adaptation',
    'red_flag_detected',
    'auto_stop_triggered',
    'session_force_stopped'
  ])

  for (const event of events || []) {
    if (!included.has(event.event_type)) continue

    const time = new Date(event.created_at).toLocaleTimeString()
    const roundNumber = event.payload?.round_number
    const detail = (() => {
      if (event.event_type === 'interviewer_action') {
        const actionType = event.payload?.action_type
        if (actionType === 'inject_curveball') {
          return `inject_curveball: ${event.payload?.curveball || 'unspecified'}`
        }
        if (actionType === 'switch_persona') {
          return `switch_persona: ${event.payload?.persona || 'unspecified'}`
        }
        if (actionType === 'escalate_difficulty') {
          return `escalate_difficulty: ${event.payload?.level || 'L3'}`
        }
        return actionType
      }
      if (event.event_type === 'candidate_action') {
        return event.payload?.message || event.payload?.action
      }
      if (event.event_type === 'difficulty_adaptation') {
        const p = event.payload || {}
        return `Round ${p.round_adapted}: ${p.from_difficulty} → ${p.to_difficulty} (scored ${p.trigger_score})`
      }
      if (event.event_type === 'red_flag_detected') {
        const p = event.payload || {}
        return `${formatFlagType(p.flag_type || 'flag')} [${p.severity || 'warning'}] — ${event.actor || 'system'}`
      }
      if (event.event_type === 'auto_stop_triggered') {
        return event.payload?.reason || 'Critical red flag triggered auto-stop'
      }
      if (event.event_type === 'session_force_stopped') {
        return event.payload?.reason || 'Session force stopped'
      }
      if (event.event_type === 'round_started' || event.event_type === 'round_completed') {
        return undefined
      }
      if (event.event_type === 'scoring_completed') {
        return `Round ${roundNumber} • ${event.payload?.dimensions || 0} dimensions`
      }
      if (event.event_type === 'artifact_submitted') {
        const t = event.payload?.artifact_type
        return t ? `${t} (Round ${roundNumber})` : `Round ${roundNumber}`
      }
      return event.payload?.artifact_type || event.payload?.action || undefined
    })()

    const label =
      event.event_type === 'round_started'
        ? `Round ${roundNumber} started`
        : event.event_type === 'round_completed'
          ? `Round ${roundNumber} completed`
          : event.event_type === 'candidate_action'
            ? 'Candidate message'
            : event.event_type === 'difficulty_adaptation'
              ? 'Difficulty auto-adjusted'
              : event.event_type === 'red_flag_detected'
                ? 'Red flag detected'
                : event.event_type === 'auto_stop_triggered'
                  ? 'Auto-stop triggered'
                  : event.event_type === 'session_force_stopped'
                    ? 'Session force stopped'
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
  const [localFollowups, setLocalFollowups] = useState<
    Array<{ id: string; question: string; round_number?: number; created_at: string }>
  >([])
  const [serverFollowups, setServerFollowups] = useState<
    Array<{
      id: string
      question: string
      round_number?: number | null
      source?: string
      answered?: boolean
      answer?: string
    }>
  >([])
  const [showNotes, setShowNotes] = useState(false)
  const [showFollowups, setShowFollowups] = useState(false)
  const [showControls, setShowControls] = useState(false)
  const [curveball, setCurveball] = useState('budget_cut')
  const [persona, setPersona] = useState('skeptical')
  const [escalationLevel, setEscalationLevel] = useState('L3')
  const [flagType, setFlagType] = useState<string>('custom')
  const [flagDescription, setFlagDescription] = useState('')
  const [flagSeverity, setFlagSeverity] = useState<'warning' | 'critical'>('warning')

  const voiceActiveRound = (rounds || []).find((round) => round.status === 'active')
  const isVoiceRealtimeActive = voiceActiveRound?.round_type === 'voice-realtime'

  const analytics = useVoiceAnalysis({
    sessionId: session?.id || '',
    enabled: session?.status === 'live' && isVoiceRealtimeActive
  })

  const transcript = useMemo(() => buildTranscript(events as any[]), [events])

  const gateData = useMemo(() => {
    if (session?.status === 'live' && isVoiceRealtimeActive && transcript && transcript.length > 0) {
      return analyzeTranscript(transcript)
    }
    return buildGateData(scores as any[], events as any[])
  }, [session?.status, isVoiceRealtimeActive, transcript, scores, events])
  const actionLog = useMemo(() => buildActionLog(events as any[]), [events])
  const noAnswerFlag = useMemo(() => {
    return gateData.redFlags.some((flag) =>
      ['insufficient_response', 'no_evidence'].includes(flag.label)
    )
  }, [gateData.redFlags])
  const autoStopTriggered = useMemo(() => {
    return (events || []).some(
      (e: any) =>
        e.event_type === 'auto_stop_triggered' ||
        e.event_type === 'session_force_stopped' ||
        (e.event_type === 'red_flag_detected' &&
          e.payload?.auto_stop === true &&
          e.payload?.severity === 'critical')
    )
  }, [events])
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
  const followupThread = useMemo(() => {
    const questions = (events || [])
      .filter((event: any) => event.event_type === 'followup_question')
      .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

    const answers = (events || [])
      .filter((event: any) => event.event_type === 'followup_answer')
      .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

    const answerMap = new Map<string, string>()
    for (const answer of answers) {
      if (answer.payload?.question_id) {
        answerMap.set(answer.payload.question_id, answer.payload?.answer || '')
      }
    }

    const manualQuestions = (events || [])
      .filter(
        (event: any) =>
          event.event_type === 'interviewer_action' &&
          event.payload?.action_type === 'manual_followup' &&
          event.payload?.followup
      )
      .map((event: any) => ({
        id: event.payload?.question_id || `manual-${event.id}`,
        question: event.payload?.followup || '',
        round_number: event.payload?.round_number ?? event.payload?.target_round,
        source: 'manual',
        created_at: event.created_at
      }))

    const localQuestions = localFollowups.map((item) => ({
      id: item.id,
      question: item.question,
      round_number: item.round_number,
      source: 'manual',
      created_at: item.created_at
    }))

    const serverQuestions = serverFollowups.map((item) => ({
      id: item.id,
      question: item.question,
      round_number: item.round_number,
      source: item.source || 'manual',
      created_at: new Date().toISOString()
    }))

    const questionItems = [
      ...questions.map((question: any) => ({
        id: question.payload?.question_id,
        question: question.payload?.question || '',
        round_number: question.payload?.round_number,
        source: question.payload?.source || 'auto',
        created_at: question.created_at
      })),
      ...manualQuestions,
      ...localQuestions,
      ...serverQuestions
    ]
      .filter((item) => item.question)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

    const deduped = new Map<string, any>()
    for (const item of questionItems) {
      const key = item.id || `${item.question}-${item.created_at}`
      if (!deduped.has(key)) {
        deduped.set(key, item)
      }
    }

    return Array.from(deduped.values()).map((question: any) => ({
      id: question.id,
      question: question.question,
      round_number: question.round_number,
      source: question.source,
      answered: question.id ? answerMap.has(question.id) : false,
      answer: question.id ? answerMap.get(question.id) : undefined
    }))
  }, [events, localFollowups, serverFollowups])

  useEffect(() => {
    if (!session?.id) return
    const loadThread = async () => {
      try {
        const response = await fetch('/api/followup/thread', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({ session_id: session.id })
        })
        if (response.ok) {
          const data = await response.json()
          if (Array.isArray(data?.thread)) {
            setServerFollowups(data.thread)
          }
        }
      } catch {
        // Best-effort sync on refresh.
      }
    }
    loadThread()
  }, [session?.id])
  const mergedGateFollowups = useMemo(() => {
    const local = localFollowups.map((item) => item.question).filter(Boolean)
    return Array.from(new Set([...(gateData.followups || []), ...local]))
  }, [gateData.followups, localFollowups])

  if (!session) return null

  const candidateName = (session as any).candidate?.name || 'Candidate'
  const jobTitle = (session as any).job?.title || 'Role'
  const jobLevel = (session as any).job?.level_band || 'mid'
  const jobLevelLabel =
    jobLevel === 'junior' ? 'Junior' : jobLevel === 'senior' ? 'Senior' : 'Mid'
  const totalRounds = roundTimeline.length
  const completedRounds = roundTimeline.filter((r) => r.status === 'completed').length
  const roundProgress = totalRounds ? (completedRounds / totalRounds) * 100 : 0
  const activeRound = roundTimeline.find((r) => r.status === 'active')
  const pendingRound = roundTimeline.find((r) => r.status === 'pending')
  const currentRoundLabel = activeRound
    ? `Round ${activeRound.round_number} • ${activeRound.title.replace(/^Round\s*\d+\s*:?\s*/i, '')}`
    : pendingRound
      ? `Next round • ${pendingRound.title}`
      : null
  const candidateInsights = (session as any).candidate_insights || {}
  const resumeSkills = Array.isArray(candidateInsights.resume_skills)
    ? candidateInsights.resume_skills.filter(Boolean).slice(0, 3)
    : []
  const insightLine = [
    candidateInsights.interview_level ? `Interview level ${candidateInsights.interview_level}` : null,
    typeof candidateInsights.pi_score_overall === 'number'
      ? `PI ${candidateInsights.pi_score_overall}`
      : null,
    resumeSkills.length ? `Skills: ${resumeSkills.join(', ')}` : null
  ]
    .filter(Boolean)
    .join(' • ')
  const targetRoundNumber =
    (rounds || []).find((round) => round.status === 'active')?.round_number ??
    (rounds || []).find((round) => round.status === 'pending')?.round_number ??
    (rounds || [])[0]?.round_number ??
    null

  const isCallInProgress = !!voiceActiveRound && isVoiceRealtimeActive

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

  const escalateDifficulty = async (level?: string) => {
    await sendAction('escalate_difficulty', {
      target_round: null,
      level: level || 'L3'
    })
  }

  const endRound = async () => {
    const activeRound = (rounds || []).find((round) => round.status === 'active')
    if (!activeRound) return
    await sendAction('end_round', { round_number: activeRound.round_number })
    await fetch('/api/round/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: session.id,
        round_number: activeRound.round_number
      })
    })
  }

  const injectCurveball = async (curveball: string) => {
    await sendAction('inject_curveball', {
      curveball,
      target_round: null
    })
  }

  const switchPersona = async (persona: string) => {
    await sendAction('switch_persona', {
      persona,
      target_round: null
    })
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#eef6ff_0%,#f7f7fb_35%,#fefefe_100%)] px-4 py-8 sm:px-6">
      <div className="mx-auto grid w-full max-w-6xl gap-5 lg:grid-cols-[1.1fr,1fr]">
        <section className="space-y-6">
          <Card className="bg-white/90">
            <CardHeader className="space-y-1 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge tone="sky" className="text-[11px] flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    {session.status}
                  </Badge>
                  {session.status === 'live' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        if (!confirm('Complete this session? All pending rounds will be skipped.')) {
                          return
                        }
                        try {
                          const response = await fetch(`/api/session/${session.id}/complete`, {
                            method: 'POST'
                          })
                          const result = await response.json()
                          if (result.success) {
                            alert('Session completed! Refresh to see updated status.')
                            window.location.reload()
                          } else {
                            alert('Failed to complete session: ' + result.error)
                          }
                        } catch (err) {
                          console.error('Failed to complete session:', err)
                          alert('Error completing session')
                        }
                      }}
                    >
                      Complete Session
                    </Button>
                  )}
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-ink-900">{candidateName}</h1>
                <p className="mt-1 text-sm text-ink-600">
                  {jobTitle} • {jobLevelLabel}
                </p>
                {insightLine && (
                  <p className="mt-2 text-xs text-ink-400">{insightLine}</p>
                )}
                {currentRoundLabel && (
                  <p className="mt-2 text-xs text-ink-500">{currentRoundLabel}</p>
                )}
                {totalRounds > 0 && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between text-xs text-ink-500">
                      <span>Round progress</span>
                      <span>{completedRounds}/{totalRounds}</span>
                    </div>
                    <Progress value={roundProgress} />
                  </div>
                )}
              </div>
            </CardHeader>
          </Card>

          {autoStopTriggered && (
            <div className="rounded-2xl border-2 border-red-400 bg-red-50 px-5 py-4 animate-pulse">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <div>
                  <p className="font-semibold text-red-800">Session Auto-Stopped</p>
                  <p className="text-sm text-red-600">
                    A critical red flag triggered automatic session termination.
                  </p>
                </div>
              </div>
            </div>
          )}

          <Card className="animate-rise-in bg-white/90">
            <CardHeader className="space-y-1">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Transcript</h2>
                <Badge tone="neutral" className="text-[11px]">Live</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {noAnswerFlag && (
                <div className="rounded-2xl border border-signal-200 bg-signal-100 px-4 py-3 text-sm text-signal-800">
                  Candidate responses are too short to evaluate. Marked as insufficient response.
                </div>
              )}
              {transcript.length === 0 && (
                <div className="rounded-2xl bg-ink-50 px-4 py-3 text-sm text-ink-500">
                  Waiting for conversation.
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
              <h3 className="text-base font-semibold">Action Log</h3>
            </CardHeader>
            <CardContent className="space-y-2">
              {actionLog.length === 0 && (
                <div className="rounded-2xl bg-ink-50 px-4 py-3 text-sm text-ink-500">
                  No actions yet.
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
          {/* Voice-Realtime Controls (only show when voice call is active) */}
          {isVoiceRealtimeActive && (
            <>
              <VoiceControlPanel
                sessionId={session.id}
                isCallActive={isCallInProgress}
              />
              <AIAssessmentsPanel sessionId={session.id} />

              {/* Say Meter - Performance Health Indicator */}
              {analytics.sayMeter && (
                <SayMeter
                  score={analytics.sayMeter.score}
                  factors={analytics.sayMeter.factors}
                  summary={analytics.sayMeter.meter_reasoning}
                  loading={analytics.loading}
                />
              )}

              {/* Dynamic AI Suggestions */}
              <SuggestionsPanel
                suggestions={analytics.suggestions}
                loading={analytics.loading}
                onDismiss={analytics.dismissSuggestion}
                onApply={(suggestion) => {
                  console.log('Apply suggestion:', suggestion)
                  // Could inject into AI prompt or show to interviewer
                }}
              />
            </>
          )}

          {/* Debug Controls (show when no scores or for manual trigger) */}
          {scores.length === 0 && (
            <Card className="bg-amber-50/90 border-amber-200">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-amber-900">No Scores Yet</h4>
                    <p className="text-xs text-amber-700 mt-1">
                      Scores generate automatically when rounds complete. Or trigger manually:
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={async () => {
                      try {
                        const response = await fetch('/api/score/trigger', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            session_id: session.id,
                            round_number: 1
                          })
                        })
                        const result = await response.json()
                        console.log('Scoring triggered:', result)
                        alert('Scoring triggered! Check Gate Panel in a few seconds.')
                      } catch (err) {
                        console.error('Failed to trigger scoring:', err)
                        alert('Failed to trigger scoring. Check console.')
                      }
                    }}
                  >
                    Trigger Scoring
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <GatePanel
            overall={gateData.overall}
            confidence={gateData.confidence}
            dimensions={gateData.dimensions}
            redFlags={gateData.redFlags}
            truthLog={gateData.truthLog}
            followups={mergedGateFollowups}
          />
          <Card className="bg-white/90">
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">Live Controls</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowControls((prev) => !prev)}>
                  {showControls ? 'Hide' : 'Show'}
                </Button>
              </div>
            </CardHeader>
            {showControls && (
              <CardContent className="space-y-4">
                <div className="grid gap-4 rounded-2xl border border-ink-100 bg-white px-4 py-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-500">
                        Curveball
                      </label>
                      <div className="flex items-center gap-2">
                        <Select value={curveball} onChange={(e) => setCurveball(e.target.value)}>
                          <option value="budget_cut">Budget cut</option>
                          <option value="security_concern">Security concern</option>
                          <option value="timeline_mismatch">Timeline mismatch</option>
                          <option value="competitor_pressure">Competitor pressure</option>
                        </Select>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => injectCurveball(curveball)}
                        >
                          Inject
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-500">
                        Persona
                      </label>
                      <div className="flex items-center gap-2">
                        <Select value={persona} onChange={(e) => setPersona(e.target.value)}>
                          <option value="neutral">Neutral</option>
                          <option value="skeptical">Skeptical</option>
                          <option value="interested">Interested</option>
                        </Select>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => switchPersona(persona)}
                        >
                          Switch
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-500">
                        Difficulty
                      </label>
                      <div className="flex items-center gap-2">
                        <Select
                          value={escalationLevel}
                          onChange={(e) => setEscalationLevel(e.target.value)}
                        >
                          <option value="L1">L1</option>
                          <option value="L2">L2</option>
                          <option value="L3">L3</option>
                        </Select>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => escalateDifficulty(escalationLevel)}
                        >
                          Escalate
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-500">
                        Round Control
                      </label>
                      <Button variant="outline" size="sm" className="w-full" onClick={endRound}>
                        End round
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-500">
                        Gate Decision
                      </label>
                      <Button variant="secondary" size="sm" className="w-full" onClick={() => sendDecision('proceed')}>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Proceed
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-red-700">
                    Flag Red Flag
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-[10px] text-ink-500">Type</label>
                      <Select value={flagType} onChange={(e) => setFlagType(e.target.value)}>
                        {Object.entries(RED_FLAG_TYPES).map(([key, val]) => (
                          <option key={key} value={key}>{val.label}</option>
                        ))}
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-ink-500">Severity</label>
                      <Select value={flagSeverity} onChange={(e) => setFlagSeverity(e.target.value as 'warning' | 'critical')}>
                        <option value="warning">Warning</option>
                        <option value="critical">Critical (auto-stop)</option>
                      </Select>
                    </div>
                  </div>
                  <input
                    type="text"
                    className="w-full rounded-2xl border border-ink-100 bg-white px-3 py-2 text-sm text-ink-700"
                    placeholder="Description (optional)..."
                    value={flagDescription}
                    onChange={(e) => setFlagDescription(e.target.value)}
                  />
                  <Button
                    variant="danger"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      sendAction('flag_red_flag', {
                        flag_type: flagType,
                        description: flagDescription || RED_FLAG_TYPES[flagType as RedFlagTypeKey]?.description || '',
                        severity: flagSeverity
                      })
                      setFlagDescription('')
                    }}
                  >
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    Flag
                  </Button>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-signal-200 bg-signal-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-signal-900">Stop interview</p>
                    <p className="text-xs text-signal-700">Ends the session immediately.</p>
                  </div>
                  <Button variant="danger" size="sm" onClick={() => sendDecision('stop')}>
                    <Slash className="mr-2 h-4 w-4" />
                    Stop
                  </Button>
                </div>
                <p className="text-[11px] text-ink-400">Applies to next response</p>
              </CardContent>
            )}
          </Card>
          <Card className="bg-white/90">
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">Interviewer Notes</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowNotes((prev) => !prev)}>
                  {showNotes ? 'Hide' : 'Show'}
                </Button>
              </div>
            </CardHeader>
            {showNotes && (
              <CardContent>
                <textarea
                  rows={6}
                  className="w-full rounded-2xl border border-ink-100 bg-white px-4 py-3 text-sm"
                  placeholder="Notes for final recommendation..."
                />
              </CardContent>
            )}
          </Card>
          <Card className="bg-white/90">
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">Follow-up Thread</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowFollowups((prev) => !prev)}>
                  {showFollowups ? 'Hide' : 'Show'}
                </Button>
              </div>
            </CardHeader>
            {showFollowups && (
              <CardContent className="space-y-4">
              <div className="space-y-3 rounded-2xl border border-ink-100 bg-white px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-500">
                  Add Follow-up
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    className="flex-1 rounded-2xl border border-ink-100 bg-white px-3 py-2 text-sm text-ink-700"
                    placeholder="Add a follow-up question..."
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        const value = (event.currentTarget.value || '').trim()
                        if (!value) return
                        const optimisticId = `local-${Date.now()}`
                        setLocalFollowups((prev) => {
                          if (prev.some((item) => item.question === value)) return prev
                          return [
                            ...prev,
                            {
                              id: optimisticId,
                              question: value,
                              round_number: targetRoundNumber ?? undefined,
                              created_at: new Date().toISOString()
                            }
                          ]
                        })
                        sendAction('manual_followup', {
                          followup: value,
                          round_number: targetRoundNumber ?? null,
                          target_round: targetRoundNumber ?? null
                        })
                        event.currentTarget.value = ''
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(event) => {
                      const input = (event.currentTarget
                        .previousElementSibling as HTMLInputElement | null)
                      const value = (input?.value || '').trim()
                      if (!value) return
                      const optimisticId = `local-${Date.now()}`
                      setLocalFollowups((prev) => {
                        if (prev.some((item) => item.question === value)) return prev
                        return [
                          ...prev,
                          {
                            id: optimisticId,
                            question: value,
                            round_number: targetRoundNumber ?? undefined,
                            created_at: new Date().toISOString()
                          }
                        ]
                      })
                      sendAction('manual_followup', {
                        followup: value,
                        round_number: targetRoundNumber ?? null,
                        target_round: targetRoundNumber ?? null
                      })
                      if (input) input.value = ''
                    }}
                  >
                    Add
                  </Button>
                </div>
                {mergedGateFollowups.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-500">
                      Suggestions
                    </div>
                    <ul className="space-y-2 text-sm text-ink-700">
                      {mergedGateFollowups.map((item) => (
                        <li
                          key={item}
                          className="flex items-center justify-between gap-3 rounded-2xl bg-ink-50 px-3 py-2"
                        >
                          <span>{item}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const optimisticId = `local-${Date.now()}`
                              setLocalFollowups((prev) => {
                                if (prev.some((row) => row.question === item)) return prev
                                return [
                                  ...prev,
                                  {
                                    id: optimisticId,
                                    question: item,
                                    round_number: targetRoundNumber ?? undefined,
                                    created_at: new Date().toISOString()
                                  }
                                ]
                              })
                              sendAction('manual_followup', {
                                followup: item,
                                round_number: targetRoundNumber ?? null,
                                target_round: targetRoundNumber ?? null
                              })
                            }}
                          >
                            Ask now
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              {followupThread.length === 0 && (
                <div className="rounded-2xl bg-ink-50 px-4 py-3 text-sm text-ink-500">
                  No follow-ups yet.
                </div>
              )}
              {followupThread.map((item) => (
                <div key={item.id} className="rounded-2xl bg-ink-50 px-4 py-3 text-sm">
                  <div className="flex items-center justify-between text-xs text-ink-500">
                    <span>Round {item.round_number ?? '-'}</span>
                    <span>{item.source === 'manual' ? 'Manual' : 'Auto'}</span>
                  </div>
                  <p className="mt-2 font-semibold text-ink-900">Q: {item.question}</p>
                  {item.answered ? (
                    <p className="mt-2 text-ink-700">A: {item.answer}</p>
                  ) : (
                    <p className="mt-2 text-ink-500">Awaiting response.</p>
                  )}
                </div>
              ))}
              </CardContent>
            )}
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
