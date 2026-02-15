'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, Slash } from 'lucide-react'
import { useParams } from 'next/navigation'
import {
  ArrowLeft,
  BadgeCheck,
  Clock3,
  Copy,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  ShieldAlert,
  Sparkles,
  Wand2
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { GatePanel } from '@/components/GatePanel'
import { ContributionGraph } from '@/components/ui/smoothui/contribution-graph'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { SessionProvider, useSession } from '@/contexts/SessionContext'
import { getRoleWidgetTemplate, normalizeRoleWidgetConfig, roleWidgetFamilies } from '@/lib/role-widget-templates'
import { ThemeToggle } from '@/components/theme-toggle'
import { Progress } from '@/components/ui/progress'
import type { RedFlagEntry } from '@/components/GatePanel'
import { RED_FLAG_TYPES } from '@/lib/constants/red-flags'
import type { RedFlagTypeKey } from '@/lib/constants/red-flags'
import { VoiceControlPanel } from '@/components/VoiceControlPanel'
import { AIAssessmentsPanel } from '@/components/AIAssessmentsPanel'
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

  const dimensionRows = scores.filter((row: any) => row.dimension && row.score !== undefined).slice(0, 10)

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
    'magic_link_issued',
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

function resolveResumeUrl(artifacts: any[]) {
  for (const artifact of artifacts || []) {
    const metadata = artifact?.metadata || {}
    const candidateUrl =
      metadata.resume_url || metadata.pdf_url || metadata.file_url || metadata.document_url || artifact?.url

    if (typeof candidateUrl === 'string' && candidateUrl.toLowerCase().includes('.pdf')) {
      return candidateUrl
    }
  }

  return null
}

function InterviewerView() {
  const { session, scopePackage, scores, events, rounds, artifacts, refresh } = useSession()
  const [notes, setNotes] = useState('')
  const [magicLink, setMagicLink] = useState<string | null>(null)
  const [sendLinkState, setSendLinkState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [sendLinkError, setSendLinkError] = useState<string | null>(null)
  const [widgetRoleFamily, setWidgetRoleFamily] = useState<string>('sales')
  const [widgetConfigText, setWidgetConfigText] = useState('')
  const [widgetConfigState, setWidgetConfigState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [widgetConfigError, setWidgetConfigError] = useState<string | null>(null)
  const [actionNotice, setActionNotice] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)
  const [resumePreview, setResumePreview] = useState<{
    signedUrl: string
    filename: string | null
    storagePath: string | null
  } | null>(null)
  const [resumePreviewState, setResumePreviewState] = useState<'idle' | 'loading' | 'ready' | 'missing' | 'error'>(
    'idle'
  )
  const [resumePreviewError, setResumePreviewError] = useState<string | null>(null)
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
  const resumeUrl = useMemo(() => resolveResumeUrl(artifacts as any[]), [artifacts])
  const activityData = useMemo(() => {
    const dailyCounts = new Map<string, number>()

    for (const event of (events as any[]) || []) {
      const date = new Date(event.created_at).toISOString().slice(0, 10)
      dailyCounts.set(date, (dailyCounts.get(date) || 0) + 1)
    }

    return [...dailyCounts.entries()].map(([date, count]) => ({
      date,
      count,
      level: Math.min(4, Math.floor(count / 2))
    }))
  }, [events])
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

  // Derive role track even when session is temporarily null so hooks stay stable.
  const roleTrack = (session as any)?.job?.track || 'sales'

  // Important: keep hooks unconditional. The session is null on initial render; returning early
  // before calling `useEffect` changes hook order once session loads, causing React warnings.
  useEffect(() => {
    const configured = (scopePackage as any)?.simulation_payloads?.role_widget_config
    const roleFamily = configured?.role_family || roleTrack
    const lanes = normalizeRoleWidgetConfig(configured?.lanes)
    const resolved = lanes.length > 0 ? lanes : getRoleWidgetTemplate(roleFamily)
    setWidgetRoleFamily(roleFamily)
    setWidgetConfigText(JSON.stringify(resolved, null, 2))
  }, [scopePackage, roleTrack])

  useEffect(() => {
    if (!actionNotice) return
    const timeout = setTimeout(() => setActionNotice(null), 2600)
    return () => clearTimeout(timeout)
  }, [actionNotice])

  const fetchResumePreview = async (sessionId: string) => {
    setResumePreviewState('loading')
    setResumePreviewError(null)
    try {
      const response = await fetch(`/api/session/${sessionId}/resume`)
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to load resume preview.')
      }

      if (data?.signed_url) {
        setResumePreview({
          signedUrl: data.signed_url,
          filename: data?.filename ?? null,
          storagePath: data?.storage_path ?? null
        })
        setResumePreviewState('ready')
        return
      }

      setResumePreview(null)
      setResumePreviewState('missing')
    } catch (error: any) {
      setResumePreview(null)
      setResumePreviewState('error')
      setResumePreviewError(error?.message || 'Failed to load resume preview.')
    }
  }

  useEffect(() => {
    if (!session?.id) return
    void fetchResumePreview(session.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id])

  if (!session) return null

  const candidateName = (session as any).candidate?.name || 'Candidate'
  const candidateEmail = (session as any).candidate?.email || ''
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
    const response = await fetch('/api/interviewer/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: session.id,
        action_type,
        payload
      })
    })

    let data: any = null
    try {
      data = await response.json()
    } catch {
      data = null
    }

    if (!response.ok) {
      setActionNotice({ kind: 'error', message: data?.error || `Action failed: ${action_type}` })
      return { ok: false, data }
    }

    setActionNotice({ kind: 'success', message: `Action applied: ${action_type.replace(/_/g, ' ')}` })
    await refresh()
    return { ok: true, data }
  }

  const sendDecision = async (decision: 'proceed' | 'caution' | 'stop') => {
    await sendAction('gate_decision', { decision })

    if (decision === 'caution') {
      await refresh()
      return
    }

    if (decision === 'stop') {
      await fetch(`/api/session/${session.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'aborted', reason: 'interviewer_stop' })
      })
      await refresh()
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

    await refresh()
  }

  const sendCandidateLink = async () => {
    setSendLinkState('sending')
    setSendLinkError(null)

    try {
      const response = await fetch('/api/interviewer/send-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: session.id })
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate candidate access link.')
      }

      setMagicLink(data.action_link)
      setSendLinkState('sent')
      await refresh()
    } catch (error: any) {
      setSendLinkState('error')
      setSendLinkError(error?.message || 'Failed to send candidate link.')
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

  const copyMagicLink = async () => {
    if (!magicLink) return
    await navigator.clipboard.writeText(magicLink)
  }

  const loadRoleWidgetTemplate = () => {
    const template = getRoleWidgetTemplate(widgetRoleFamily)
    setWidgetConfigText(JSON.stringify(template, null, 2))
    setWidgetConfigState('idle')
    setWidgetConfigError(null)
  }

  const saveRoleWidgetConfig = async () => {
    if (!widgetConfigText.trim()) return
    setWidgetConfigState('saving')
    setWidgetConfigError(null)

    try {
      const parsed = JSON.parse(widgetConfigText)
      const normalized = normalizeRoleWidgetConfig(parsed)
      if (normalized.length === 0) {
        throw new Error('Widget config requires at least one lane with steps.')
      }

      await sendAction('role_widget_config', {
        role_family: widgetRoleFamily,
        lanes: normalized
      })

      setWidgetConfigText(JSON.stringify(normalized, null, 2))
      setWidgetConfigState('saved')
    } catch (error: any) {
      setWidgetConfigState('error')
      setWidgetConfigError(error?.message || 'Invalid widget config JSON.')
    }
  }

  const statusVariant =
    session.status === 'live' ? 'default' : session.status === 'completed' ? 'secondary' : 'outline'

  const setSessionStatus = async (status: 'completed' | 'aborted', reason?: string) => {
    const response = await fetch(`/api/session/${session.id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, reason: reason || null })
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      setActionNotice({ kind: 'error', message: data?.error || 'Failed to update session status.' })
      return
    }

    setActionNotice({ kind: 'success', message: `Session marked ${status}.` })
    await refresh()
  }

  const resolvedResumeUrl = resumePreview?.signedUrl || resumeUrl

  return (
    <main className="surface-grid min-h-screen px-4 py-8 md:px-8">
      <div className="mx-auto w-full max-w-7xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/interviewer">
                <ArrowLeft className="h-4 w-4" />
                Sessions
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/">Home</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin">Admin</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/about-oneorigin">About</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a href="https://www.oneorigin.us/" target="_blank" rel="noreferrer">
                Website
              </a>
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => void setSessionStatus('completed', 'interviewer_complete')}>
              Mark Completed
            </Button>
            <Button size="sm" variant="destructive" onClick={() => void setSessionStatus('aborted', 'interviewer_abort')}>
              Abort Session
            </Button>
            <ThemeToggle />
          </div>
        </header>

        <div className="grid w-full gap-6 lg:grid-cols-[1.15fr,1fr]">
        <section className="space-y-6">
          <Card>
            <CardHeader className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Interviewer Console</p>
                  <h1 className="text-2xl font-semibold">{candidateName}</h1>
                </div>
                <Badge variant={statusVariant} className="capitalize">
                  {session.status}
                </Badge>
              </div>
              <CardDescription>
                {jobTitle} | Level {jobLevel} | {candidateEmail || 'No candidate email on file'}
              </CardDescription>
              {insightLine && (
                <p className="text-xs text-muted-foreground">{insightLine}</p>
              )}
              {currentRoundLabel && (
                <p className="text-xs text-muted-foreground">{currentRoundLabel}</p>
              )}
              {totalRounds > 0 && (
                <div className="mt-2 space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Round progress</span>
                    <span>{completedRounds}/{totalRounds}</span>
                  </div>
                  <Progress value={roundProgress} />
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={sendCandidateLink} disabled={sendLinkState === 'sending'}>
                  {sendLinkState === 'sending' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Link2 className="h-4 w-4" />
                  )}
                  Send Candidate Link
                </Button>
                <Button size="sm" variant="outline" onClick={() => sendAction('inject_curveball')}>
                  <Sparkles className="h-4 w-4" />
                  Inject Curveball
                </Button>
                <Button size="sm" variant="outline" onClick={() => sendAction('switch_persona')}>
                  <Wand2 className="h-4 w-4" />
                  Switch Persona
                </Button>
                <Button size="sm" variant="outline" onClick={() => sendAction('end_round')}>
                  <Clock3 className="h-4 w-4" />
                  End Round
                </Button>
              </div>

              {actionNotice && (
                <div
                  className={
                    actionNotice.kind === 'error'
                      ? 'rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive'
                      : 'rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300'
                  }
                >
                  {actionNotice.message}
                </div>
              )}

              {sendLinkState === 'error' && (
                <p className="text-sm text-destructive">{sendLinkError || 'Unable to generate candidate link.'}</p>
              )}

              {magicLink && (
                <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Live magic link generated and logged.</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input value={magicLink} readOnly className="font-mono text-xs" />
                    <Button size="sm" variant="outline" onClick={copyMagicLink}>
                      <Copy className="h-4 w-4" />
                      Copy
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <a href={magicLink} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4" />
                        Open
                      </a>
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {autoStopTriggered && (
            <div className="rounded-lg border-2 border-destructive/40 bg-destructive/10 px-5 py-4 animate-pulse">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <div>
                  <p className="font-semibold text-destructive">Session Auto-Stopped</p>
                  <p className="text-sm text-destructive/80">
                    A critical red flag triggered automatic session termination.
                  </p>
                </div>
              </div>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Live Transcript</CardTitle>
              <CardDescription>Conversation and candidate statements in chronological order.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {transcript.length === 0 && (
                <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                  Transcript will populate after the conversation starts.
                </div>
              )}
              {transcript.map((entry, index) => (
                <div key={`${entry.time}-${index}`} className="rounded-lg border bg-muted/20 p-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{entry.speaker}</span>
                    <span>{entry.time}</span>
                  </div>
                  <p className="mt-2 text-sm">{entry.content}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Round Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {roundTimeline.length === 0 && (
                <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                  No rounds are loaded for this session.
                </div>
              )}
              {roundTimeline.map((round) => {
                const roundStatusVariant =
                  round.status === 'active' ? 'default' : round.status === 'completed' ? 'secondary' : 'outline'

                return (
                  <div key={round.round_number} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">
                        Round {round.round_number}: {round.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {round.startedAt
                          ? `${round.startedAt.toLocaleTimeString()} to ${round.endsAt?.toLocaleTimeString()}`
                          : `Duration: ${round.durationMinutes} min`}
                      </p>
                    </div>
                    <Badge variant={roundStatusVariant}>{round.status}</Badge>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Candidate Action Log</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {actionLog.length === 0 && <p className="text-sm text-muted-foreground">Waiting for actions...</p>}
              {actionLog.map((entry, index) => (
                <div key={`${entry.time}-${index}`} className="grid grid-cols-[1fr,1fr,auto] items-center gap-2 text-sm">
                  <span>{entry.action}</span>
                  <span className="truncate text-muted-foreground">{entry.detail || '-'}</span>
                  <span className="text-xs text-muted-foreground">{entry.time}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Hiring Manager Activity Map</CardTitle>
              <CardDescription>Heatmap view of session event intensity.</CardDescription>
            </CardHeader>
            <CardContent>
              <ContributionGraph data={activityData} showLegend year={new Date().getFullYear()} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-primary" />
                Quick Resume View
              </CardTitle>
              <CardDescription>
                Preview the uploaded resume PDF for this candidate. No hardcoded resume content is shown.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-muted-foreground">
                  {resumePreviewState === 'loading'
                    ? 'Loading resume preview...'
                    : resumePreviewState === 'ready'
                      ? resumePreview?.filename || 'Resume PDF'
                      : resumePreviewState === 'missing'
                        ? 'No resume uploaded for this candidate.'
                        : resumePreviewState === 'error'
                          ? resumePreviewError || 'Unable to load resume preview.'
                          : ''}
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => void fetchResumePreview(session.id)}>
                    Refresh
                  </Button>
                  {resolvedResumeUrl && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={resolvedResumeUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4" />
                        Open
                      </a>
                    </Button>
                  )}
                </div>
              </div>

              <div className="mt-3 overflow-hidden rounded-lg border">
                {resolvedResumeUrl ? (
                  <iframe src={resolvedResumeUrl} title="Candidate resume preview" className="h-[640px] w-full" />
                ) : (
                  <div className="flex h-[240px] items-center justify-center bg-muted/20 p-6 text-sm text-muted-foreground">
                    Resume PDF not available yet. Upload a resume to the `resumes` storage bucket and set
                    `candidates.resume_storage_path`, or attach a PDF artifact to this session.
                  </div>
                )}
              </div>
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

              {analytics.sayMeter && (
                <SayMeter
                  score={analytics.sayMeter.score}
                  factors={analytics.sayMeter.factors}
                  summary={analytics.sayMeter.meter_reasoning}
                  loading={analytics.loading}
                />
              )}

              <SuggestionsPanel
                suggestions={analytics.suggestions}
                loading={analytics.loading}
                onDismiss={analytics.dismissSuggestion}
                onApply={(suggestion) => {
                  console.log('Apply suggestion:', suggestion)
                }}
              />
            </>
          )}

          {scores.length === 0 && (
            <Card className="border-amber-200 bg-amber-50/90 dark:bg-amber-950/30">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-300">No Scores Yet</h4>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Role Widget Configuration</CardTitle>
              <CardDescription>
                Hiring manager configurable flows for candidate-side role widgets. Saved config streams live to candidate view.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Role family</p>
                <Select value={widgetRoleFamily} onValueChange={setWidgetRoleFamily}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role family" />
                  </SelectTrigger>
                  <SelectContent>
                    {roleWidgetFamilies.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={loadRoleWidgetTemplate}>
                  Load Recommended Template
                </Button>
                <Button size="sm" onClick={saveRoleWidgetConfig} disabled={widgetConfigState === 'saving'}>
                  {widgetConfigState === 'saving' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Save Role Widget Config
                </Button>
              </div>

              <Textarea
                rows={12}
                value={widgetConfigText}
                onChange={(event) => setWidgetConfigText(event.target.value)}
                placeholder='[{"id":"lane-1","title":"Lane","subtitle":"flow","steps":[{"id":"step-1","label":"Task","eta":"06s"}]}]'
                className="font-mono text-xs"
              />

              {widgetConfigState === 'saved' && (
                <p className="text-xs text-emerald-600">Role widget configuration saved.</p>
              )}
              {widgetConfigError && (
                <p className="text-xs text-destructive">{widgetConfigError}</p>
              )}
            </CardContent>
          </Card>

          <GatePanel
            overall={gateData.overall}
            confidence={gateData.confidence}
            dimensions={gateData.dimensions}
            redFlags={gateData.redFlags}
            truthLog={gateData.truthLog}
            followups={mergedGateFollowups}
            onDecision={sendDecision}
            onAction={(action) => {
              if (action === 'escalate') {
                void sendAction('escalate_difficulty')
              }
            }}
            onAddFollowup={async (followup) => {
              await sendAction('manual_followup', { followup })
            }}
          />

          <Card>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Live Controls</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowControls((prev) => !prev)}>
                  {showControls ? 'Hide' : 'Show'}
                </Button>
              </div>
            </CardHeader>
            {showControls && (
              <CardContent className="space-y-4">
                <div className="grid gap-4 rounded-lg border p-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Curveball
                      </label>
                      <div className="flex items-center gap-2">
                        <Select value={curveball} onValueChange={setCurveball}>
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="budget_cut">Budget cut</SelectItem>
                            <SelectItem value="security_concern">Security concern</SelectItem>
                            <SelectItem value="timeline_mismatch">Timeline mismatch</SelectItem>
                            <SelectItem value="competitor_pressure">Competitor pressure</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button variant="outline" size="sm" onClick={() => injectCurveball(curveball)}>
                          Inject
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Persona
                      </label>
                      <div className="flex items-center gap-2">
                        <Select value={persona} onValueChange={setPersona}>
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="neutral">Neutral</SelectItem>
                            <SelectItem value="skeptical">Skeptical</SelectItem>
                            <SelectItem value="interested">Interested</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button variant="outline" size="sm" onClick={() => switchPersona(persona)}>
                          Switch
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Difficulty
                      </label>
                      <div className="flex items-center gap-2">
                        <Select value={escalationLevel} onValueChange={setEscalationLevel}>
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="L1">L1</SelectItem>
                            <SelectItem value="L2">L2</SelectItem>
                            <SelectItem value="L3">L3</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button variant="outline" size="sm" onClick={() => escalateDifficulty(escalationLevel)}>
                          Escalate
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Round Control
                      </label>
                      <Button variant="outline" size="sm" className="w-full" onClick={endRound}>
                        End round
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Gate Decision
                      </label>
                      <Button variant="secondary" size="sm" className="w-full" onClick={() => sendDecision('proceed')}>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Proceed
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 px-4 py-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-red-700 dark:text-red-400">
                    Flag Red Flag
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground">Type</label>
                      <Select value={flagType} onValueChange={setFlagType}>
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(RED_FLAG_TYPES).map(([key, val]) => (
                            <SelectItem key={key} value={key}>{val.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground">Severity</label>
                      <Select value={flagSeverity} onValueChange={(v) => setFlagSeverity(v as 'warning' | 'critical')}>
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="warning">Warning</SelectItem>
                          <SelectItem value="critical">Critical (auto-stop)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Input
                    placeholder="Description (optional)..."
                    value={flagDescription}
                    onChange={(e) => setFlagDescription(e.target.value)}
                  />
                  <Button
                    variant="destructive"
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

                <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-destructive">Stop interview</p>
                    <p className="text-xs text-destructive/80">Ends the session immediately.</p>
                  </div>
                  <Button variant="destructive" size="sm" onClick={() => sendDecision('stop')}>
                    <Slash className="mr-2 h-4 w-4" />
                    Stop
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">Applies to next response</p>
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Interviewer Notes</CardTitle>
              <CardDescription>Saved to session action logs when submitted.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                rows={6}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Capture context for final recommendation, concern areas, and decision rationale..."
              />
              <Button
                variant="secondary"
                onClick={async () => {
                  if (!notes.trim()) return
                  await sendAction('interviewer_note', { note: notes })
                  setNotes('')
                }}
              >
                <BadgeCheck className="h-4 w-4" />
                Save Note
              </Button>
              <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                <ShieldAlert className="mb-2 h-4 w-4" />
                All interviewer actions, notes, and magic-link events are logged for audit and post-assessment review.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Follow-up Thread</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowFollowups((prev) => !prev)}>
                  {showFollowups ? 'Hide' : 'Show'}
                </Button>
              </div>
            </CardHeader>
            {showFollowups && (
              <CardContent className="space-y-4">
                <div className="space-y-3 rounded-lg border p-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Add Follow-up
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
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
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        Suggestions
                      </div>
                      <ul className="space-y-2 text-sm">
                        {mergedGateFollowups.map((item) => (
                          <li
                            key={item}
                            className="flex items-center justify-between gap-3 rounded-lg bg-muted/30 px-3 py-2"
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
                  <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                    No follow-ups yet.
                  </div>
                )}
                {followupThread.map((item) => (
                  <div key={item.id} className="rounded-lg border bg-muted/20 p-3 text-sm">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Round {item.round_number ?? '-'}</span>
                      <span>{item.source === 'manual' ? 'Manual' : 'Auto'}</span>
                    </div>
                    <p className="mt-2 font-semibold">Q: {item.question}</p>
                    {item.answered ? (
                      <p className="mt-2 text-muted-foreground">A: {item.answer}</p>
                    ) : (
                      <p className="mt-2 text-muted-foreground">Awaiting response.</p>
                    )}
                  </div>
                ))}
              </CardContent>
            )}
          </Card>
        </aside>
        </div>
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
