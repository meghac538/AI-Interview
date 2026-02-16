'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, Slash } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
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
  Sparkles
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
import { getCurveballsForTrack, getPersonasForTrack, getCurveballByKey, getPersonaDisplayName } from '@/lib/constants/curveball-library'
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
  // Collect follow-ups from followup_question events (canonical source for both auto + manual)
  const eventFollowups = (events || [])
    .filter((event) => event.event_type === 'followup_question')
    .map((event) => String(event.payload?.question || '').trim())
    .filter(Boolean)

  // Legacy: also collect from interviewer_action events (for old data before migration)
  const manualFollowups = (events || [])
    .filter(
      (event) =>
        event.event_type === 'interviewer_action' &&
        event.payload?.action_type === 'manual_followup'
    )
    .map((event) => String(event.payload?.followup || '').trim())
    .filter((text) => text && !eventFollowups.includes(text))

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
    'session_force_stopped',
    'curveball_used',
    'persona_used'
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
      if (event.event_type === 'curveball_used') {
        return `AI consumed curveball: ${event.payload?.curveball || 'unknown'}`
      }
      if (event.event_type === 'persona_used') {
        return `AI applied persona: ${event.payload?.persona || 'unknown'}`
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
                    : event.event_type === 'curveball_used'
                      ? 'Curveball consumed'
                      : event.event_type === 'persona_used'
                        ? 'Persona applied'
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
  const router = useRouter()
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
  const [noteSavedToast, setNoteSavedToast] = useState(false)
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
  const [showControls, setShowControls] = useState(true)
  const [sendingAction, setSendingAction] = useState<string | null>(null)
  const [curveball, setCurveball] = useState('')
  const [customCurveball, setCustomCurveball] = useState('')
  const [aiCurveballSuggestions, setAiCurveballSuggestions] = useState<Array<{
    id: string; title: string; detail: string; rationale: string;
    priority: string; source_evidence: string
  }>>([])
  const [curveballSuggestionsLoading, setCurveballSuggestionsLoading] = useState(false)
  const [curveballSuggestionsContext, setCurveballSuggestionsContext] = useState('')
  const [scorecardOpening, setScorecardOpening] = useState(false)
  const [sessionStatusLoading, setSessionStatusLoading] = useState<string | null>(null)
  const [persona, setPersona] = useState('')
  const [customPersona, setCustomPersona] = useState('')
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

  // Extract expected dimensions from current round's scoring rubric
  const currentRoundRubric = useMemo(() => {
    // Try active round first, then fall back to most recent completed round, then last round
    const activeRound = rounds?.find((r: any) => r.status === 'active')
    const completedRounds = rounds?.filter((r: any) => r.status === 'completed') || []
    const mostRecentCompleted = completedRounds.length > 0
      ? completedRounds.reduce((latest: any, current: any) =>
          current.round_number > latest.round_number ? current : latest
        )
      : null
    const targetRound = activeRound || mostRecentCompleted || rounds?.[rounds.length - 1]

    if (!targetRound) {
      return { expectedDimensions: [], roundNumber: undefined }
    }

    const rubricDimensions = targetRound.config?.scoring_rubric?.dimensions
    if (!Array.isArray(rubricDimensions)) {
      return { expectedDimensions: [], roundNumber: targetRound.round_number }
    }

    return {
      expectedDimensions: rubricDimensions.map((d: any) => ({
        name: d.name || '',
        description: d.description || '',
        maxScore: d.maxScore || 20
      })),
      roundNumber: targetRound.round_number
    }
  }, [rounds])

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
        round_type: round.round_type,
        title: round.title,
        status: round.status || 'pending',
        startedAt,
        endsAt,
        durationMinutes: round.duration_minutes
      }
    })
  }, [rounds])
  const followupThread = useMemo(() => {
    // Single canonical source: followup_question events (covers both auto + manual)
    const questions = (events || [])
      .filter((event: any) => event.event_type === 'followup_question')
      .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

    const answers = (events || [])
      .filter((event: any) => event.event_type === 'followup_answer')
      .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

    // Map answers by question_id AND by question text (fallback for UUID mismatches
    // when candidate picks a different UUID than what interviewer dedup selected)
    const answerByIdMap = new Map<string, string>()
    const answerByTextMap = new Map<string, string>()
    for (const answer of answers) {
      const ans = answer.payload?.answer || ''
      if (answer.payload?.question_id) {
        answerByIdMap.set(answer.payload.question_id, ans)
      }
      const qText = String(answer.payload?.question || '').toLowerCase().trim()
      if (qText) {
        answerByTextMap.set(qText, ans)
      }
    }

    const questionItems = [
      ...questions.map((question: any) => ({
        id: question.payload?.question_id,
        question: question.payload?.question || '',
        round_number: question.payload?.round_number,
        source: question.payload?.source || 'auto',
        created_at: question.created_at
      })),
      ...localFollowups.map((item) => ({
        id: item.id,
        question: item.question,
        round_number: item.round_number,
        source: 'manual',
        created_at: item.created_at
      })),
      ...serverFollowups.map((item) => ({
        id: item.id,
        question: item.question,
        round_number: item.round_number,
        source: item.source || 'manual',
        created_at: new Date().toISOString()
      }))
    ]
      .filter((item) => item.question)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

    // Deduplicate by ID first, then by question text as fallback
    const seenIds = new Set<string>()
    const seenTexts = new Set<string>()
    const deduped: typeof questionItems = []

    for (const item of questionItems) {
      if (item.id && seenIds.has(item.id)) continue
      const textKey = item.question.toLowerCase().trim()
      if (seenTexts.has(textKey)) continue
      if (item.id) seenIds.add(item.id)
      seenTexts.add(textKey)
      deduped.push(item)
    }

    // Third fallback: server-side answered status from /api/followup/thread
    const serverAnswerByIdMap = new Map<string, string>()
    const serverAnswerByTextMap = new Map<string, string>()
    for (const item of serverFollowups) {
      if (item.answered) {
        const ans = item.answer || ''
        if (item.id) serverAnswerByIdMap.set(item.id, ans)
        const sText = item.question.toLowerCase().trim()
        if (sText) serverAnswerByTextMap.set(sText, ans)
      }
    }

    return deduped.map((question) => {
      const textKey = question.question.toLowerCase().trim()
      const answeredById = question.id ? answerByIdMap.has(question.id) : false
      const answeredByText = answerByTextMap.has(textKey)
      const answeredByServer = question.id
        ? serverAnswerByIdMap.has(question.id) || serverAnswerByTextMap.has(textKey)
        : serverAnswerByTextMap.has(textKey)
      const isAnswered = answeredById || answeredByText || answeredByServer
      return {
        id: question.id,
        question: question.question,
        round_number: question.round_number,
        source: question.source,
        answered: isAnswered,
        answer: answeredById
          ? answerByIdMap.get(question.id!)
          : answeredByText
            ? answerByTextMap.get(textKey)
            : answeredByServer
              ? (serverAnswerByIdMap.get(question.id!) || serverAnswerByTextMap.get(textKey))
              : undefined
      }
    })
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
    // Poll server thread every 30s as a safety net — real-time events handle live updates
    const interval = setInterval(loadThread, 30000)
    return () => clearInterval(interval)
  }, [session?.id])
  // Prune localFollowups once the same question text appears in real-time events
  useEffect(() => {
    if (!events || events.length === 0 || localFollowups.length === 0) return
    const eventQuestions = new Set(
      (events as any[])
        .filter((e) => e.event_type === 'followup_question')
        .map((e) => String(e.payload?.question || '').toLowerCase().trim())
        .filter(Boolean)
    )
    if (eventQuestions.size === 0) return
    setLocalFollowups((prev) => {
      const pruned = prev.filter((item) => !eventQuestions.has(item.question.toLowerCase().trim()))
      return pruned.length === prev.length ? prev : pruned
    })
  }, [events, localFollowups.length])

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
    setSendingAction(action_type)
    // Show immediate optimistic feedback
    setActionNotice({ kind: 'success', message: `Sending: ${action_type.replace(/_/g, ' ')}...` })
    try {
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
      // Non-blocking refresh — real-time subscriptions handle live updates
      refresh().catch(() => {})
      return { ok: true, data }
    } finally {
      setSendingAction(null)
    }
  }

  const sendDecision = async (decision: 'proceed' | 'caution' | 'stop') => {
    setSendingAction(`gate_${decision}`)
    setActionNotice({ kind: 'success', message: `Applying decision: ${decision}...` })

    try {
      // Fire gate_decision event (non-blocking — don't wait for full round-trip)
      const actionPromise = fetch('/api/interviewer/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.id,
          action_type: 'gate_decision',
          payload: { decision }
        })
      }).catch(() => {})

      if (decision === 'caution') {
        await actionPromise
        setActionNotice({ kind: 'success', message: 'Caution noted.' })
        refresh().catch(() => {})
        return
      }

      if (decision === 'stop') {
        // Fire both in parallel
        await Promise.all([
          actionPromise,
          fetch(`/api/session/${session.id}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'aborted', reason: 'interviewer_stop' })
          }).catch(() => {})
        ])
        setActionNotice({ kind: 'success', message: 'Session stopped.' })
        refresh().catch(() => {})
        return
      }

      // Proceed: complete active round and start next
      const activeRound = (rounds || []).find((round) => round.status === 'active')
      const nextRound = (rounds || []).find((round) => round.status === 'pending')

      // Don't block UI — fire round transitions and let real-time handle updates
      void (async () => {
        try {
          await actionPromise
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
          refresh().catch(() => {})
        } catch {
          // Errors handled by real-time fallback
        }
      })()

      setActionNotice({ kind: 'success', message: 'Proceeding to next round.' })
    } finally {
      setSendingAction(null)
    }
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
      refresh().catch(() => {})
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
    setSendingAction('end_round')
    setActionNotice({ kind: 'success', message: 'Ending round...' })
    // Fire both requests in parallel, don't block UI
    Promise.all([
      fetch('/api/interviewer/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.id,
          action_type: 'end_round',
          payload: { round_number: activeRound.round_number }
        })
      }).catch(() => {}),
      fetch('/api/round/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.id,
          round_number: activeRound.round_number
        })
      }).catch(() => {})
    ]).then(() => {
      setActionNotice({ kind: 'success', message: 'Round ended.' })
      refresh().catch(() => {})
    }).finally(() => {
      setSendingAction(null)
    })
  }

  const injectCurveball = async (curveballKey: string) => {
    await sendAction('inject_curveball', {
      curveball: curveballKey,
      curveball_key: curveballKey,
      target_round: null,
    })
  }

  const injectCustomCurveball = async (text: string) => {
    if (!text.trim()) return
    await sendAction('inject_curveball', {
      curveball_key: 'custom',
      custom_text: text.trim(),
      target_round: null,
    })
    setCustomCurveball('')
  }

  const fetchCurveballSuggestions = async () => {
    if (!session) return
    const activeRound = (rounds || []).find((r) => r.status === 'active')
    if (!activeRound || activeRound.round_type !== 'text') return
    setCurveballSuggestionsLoading(true)
    setCurveballSuggestionsContext('')
    try {
      const res = await fetch('/api/ai/curveball-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.id,
          round_number: activeRound.round_number
        })
      })
      const data = await res.json()
      setAiCurveballSuggestions(data.suggestions || [])
      setCurveballSuggestionsContext(data.context_summary || data.error || '')
    } catch {
      setAiCurveballSuggestions([])
      setCurveballSuggestionsContext('Network error — could not reach server.')
    } finally {
      setCurveballSuggestionsLoading(false)
    }
  }

  const approveAiCurveball = async (suggestion: typeof aiCurveballSuggestions[0]) => {
    await sendAction('inject_curveball', {
      curveball_key: `ai_suggested_${Date.now()}`,
      custom_text: suggestion.detail,
      target_round: null,
    })
    // Clear all suggestions after injecting one
    setAiCurveballSuggestions([])
    setCurveballSuggestionsContext('')
  }

  const dismissAiCurveball = (suggestionId: string) => {
    setAiCurveballSuggestions((prev) => prev.filter((s) => s.id !== suggestionId))
  }

  const switchPersona = async (personaKey: string) => {
    await sendAction('switch_persona', {
      persona: personaKey,
      target_round: null,
      track: roleTrack,
    })
  }

  const switchCustomPersona = async (text: string) => {
    if (!text.trim()) return
    await sendAction('switch_persona', {
      persona: 'custom',
      custom_text: text.trim(),
      target_round: null,
      track: roleTrack,
    })
    setCustomPersona('')
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
    setSessionStatusLoading(status)
    try {
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
      refresh().catch(() => {})
    } finally {
      setSessionStatusLoading(null)
    }
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
            <Button
              size="sm"
              variant="secondary"
              disabled={scorecardOpening}
              onClick={() => {
                setScorecardOpening(true)
                router.push(`/scorecard/${session.id}`)
              }}
            >
              {scorecardOpening
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <FileText className="mr-2 h-4 w-4" />}
              {scorecardOpening ? 'Loading...' : 'Score Card'}
            </Button>
            <Button size="sm" variant="outline" disabled={sessionStatusLoading !== null} onClick={() => void setSessionStatus('completed', 'interviewer_complete')}>
              {sessionStatusLoading === 'completed' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {sessionStatusLoading === 'completed' ? 'Completing...' : 'Mark Completed'}
            </Button>
            <Button size="sm" variant="destructive" disabled={sessionStatusLoading !== null} onClick={() => void setSessionStatus('aborted', 'interviewer_abort')}>
              {sessionStatusLoading === 'aborted' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {sessionStatusLoading === 'aborted' ? 'Aborting...' : 'Abort Session'}
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
                track={roleTrack}
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
            loading={!!sendingAction}
            expectedDimensions={currentRoundRubric.expectedDimensions}
            currentRoundNumber={currentRoundRubric.roundNumber}
            onDecision={sendDecision}
            onAction={(action) => {
              if (action === 'escalate') {
                void sendAction('escalate_difficulty')
              }
            }}
            onAddFollowup={async (followup) => {
              const lower = followup.toLowerCase().trim()
              const alreadySent = followupThread.some(
                (q) => q.question.toLowerCase().trim() === lower
              ) || localFollowups.some(
                (q) => q.question.toLowerCase().trim() === lower
              )
              if (alreadySent) return
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
                {/* Curveball + Persona + Difficulty */}
                <div className="grid gap-4 rounded-lg border p-4">
                  <div className="grid gap-4">
                    {/* Track-aware curveball dropdown */}
                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Curveball
                      </label>
                      <div className="flex items-center gap-2">
                        <Select value={curveball} onValueChange={setCurveball}>
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Select curveball..." />
                          </SelectTrigger>
                          <SelectContent>
                            {getCurveballsForTrack(roleTrack).map((cb) => (
                              <SelectItem key={cb.key} value={cb.key}>{cb.title}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button variant="outline" size="sm" disabled={!curveball || !!sendingAction} onClick={() => injectCurveball(curveball)}>
                          Inject
                        </Button>
                      </div>
                      {/* Custom curveball */}
                      <div className="flex items-center gap-2">
                        <Input
                          className="h-8 text-xs"
                          placeholder="Custom curveball text..."
                          value={customCurveball}
                          onChange={(e) => setCustomCurveball(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && customCurveball.trim()) {
                              injectCustomCurveball(customCurveball)
                            }
                          }}
                        />
                        <Button variant="outline" size="sm" disabled={!customCurveball.trim() || !!sendingAction} onClick={() => injectCustomCurveball(customCurveball)}>
                          Custom
                        </Button>
                      </div>
                      {/* Consumption feedback */}
                      {(() => {
                        const injected = (events || []).filter((e: any) =>
                          e.event_type === 'interviewer_action' &&
                          e.payload?.action_type === 'inject_curveball' &&
                          (e.payload?.curveball || e.payload?.curveball_key || e.payload?.custom_text)
                        ).slice(0, 5)
                        const consumed = new Set(
                          (events || []).filter((e: any) => e.event_type === 'curveball_used')
                            .map((e: any) => e.payload?.curveball).filter(Boolean)
                        )
                        if (injected.length === 0) return null
                        return (
                          <div className="space-y-1 mt-1">
                            {injected.map((e: any, i: number) => {
                              const key = e.payload?.curveball || e.payload?.curveball_key || 'custom'
                              const isCustom = !!e.payload?.custom_text
                              const label = isCustom
                                ? (e.payload?.custom_text?.slice(0, 40) || 'Custom')
                                : (getCurveballByKey(key)?.title || key)
                              const isConsumed = consumed.has(key)
                              return (
                                <div key={e.id || i} className="flex items-center gap-1.5 text-[10px]">
                                  {isConsumed ? (
                                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                  ) : (
                                    <Clock3 className="h-3 w-3 text-amber-500" />
                                  )}
                                  <span className={isConsumed ? 'text-muted-foreground' : 'text-foreground'}>
                                    {label.replace(/_/g, ' ')}
                                  </span>
                                  <Badge variant={isConsumed ? 'secondary' : 'outline'} className="h-4 px-1 text-[9px]">
                                    {isConsumed ? 'Used' : 'Pending'}
                                  </Badge>
                                </div>
                              )
                            })}
                          </div>
                        )
                      })()}

                      {/* AI Curveball Suggestions — text rounds only */}
                      {(() => {
                        const isTextRound = activeRound?.round_type === 'text'
                        return (
                          <div className="mt-3 space-y-2 border-t border-dashed pt-3">
                            <div className="flex items-center justify-between">
                              <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                <Sparkles className="h-3 w-3" />
                                AI Suggestions
                              </label>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 px-2 text-[10px]"
                                disabled={curveballSuggestionsLoading || !isTextRound || session?.status !== 'live'}
                                onClick={fetchCurveballSuggestions}
                              >
                                {curveballSuggestionsLoading ? (
                                  <><Loader2 className="mr-1 h-3 w-3 animate-spin" />Analyzing...</>
                                ) : (
                                  'Suggest'
                                )}
                              </Button>
                            </div>

                            {!isTextRound && (
                              <p className="text-[10px] text-muted-foreground">
                                AI suggestions available for text rounds only.
                              </p>
                            )}

                            {curveballSuggestionsContext && (
                              <p className="text-[10px] text-muted-foreground">
                                {curveballSuggestionsContext}
                              </p>
                            )}

                            {isTextRound && aiCurveballSuggestions.length === 0 && !curveballSuggestionsLoading && !curveballSuggestionsContext && (
                              <p className="text-[10px] text-muted-foreground">
                                Click &ldquo;Suggest&rdquo; to analyze candidate&apos;s response and get targeted curveball ideas.
                              </p>
                            )}

                            {aiCurveballSuggestions.map((suggestion) => (
                              <div key={suggestion.id} className="space-y-1.5 rounded-lg border p-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-medium">{suggestion.title}</span>
                                  <Badge
                                    variant={suggestion.priority === 'high' ? 'destructive' : 'secondary'}
                                    className="h-4 px-1.5 text-[9px]"
                                  >
                                    {suggestion.priority}
                                  </Badge>
                                </div>
                                <p className="text-xs text-foreground">{suggestion.detail}</p>
                                <p className="text-[10px] italic text-muted-foreground">
                                  Why: {suggestion.rationale}
                                </p>
                                {suggestion.source_evidence && (
                                  <p className="text-[10px] text-muted-foreground">
                                    Based on: &ldquo;{suggestion.source_evidence.slice(0, 100)}&rdquo;
                                  </p>
                                )}
                                <div className="flex gap-2 pt-1">
                                  <Button
                                    size="sm"
                                    variant="default"
                                    className="h-6 px-2 text-[10px]"
                                    disabled={!!sendingAction}
                                    onClick={() => approveAiCurveball(suggestion)}
                                  >
                                    Inject
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 px-2 text-[10px]"
                                    onClick={() => dismissAiCurveball(suggestion.id)}
                                  >
                                    Dismiss
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      })()}
                    </div>

                    {/* Track-aware persona dropdown — only for conversational rounds */}
                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Persona
                      </label>
                      {activeRound && ['voice', 'voice-realtime', 'email', 'agentic'].includes(activeRound.round_type) ? (
                        <>
                          <div className="flex items-center gap-2">
                            <Select value={persona} onValueChange={setPersona}>
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder="Select persona..." />
                              </SelectTrigger>
                              <SelectContent>
                                {getPersonasForTrack(roleTrack).map((p) => (
                                  <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button variant="outline" size="sm" disabled={!persona || !!sendingAction} onClick={() => switchPersona(persona)}>
                              Switch
                            </Button>
                          </div>
                          {/* Custom persona */}
                          <div className="flex items-center gap-2">
                            <Input
                              className="h-8 text-xs"
                              placeholder="Custom persona description..."
                              value={customPersona}
                              onChange={(e) => setCustomPersona(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && customPersona.trim()) {
                                  switchCustomPersona(customPersona)
                                }
                              }}
                            />
                            <Button variant="outline" size="sm" disabled={!customPersona.trim() || !!sendingAction} onClick={() => switchCustomPersona(customPersona)}>
                              Custom
                            </Button>
                          </div>
                          {/* Persona consumption feedback */}
                          {(() => {
                            const switched = (events || []).filter((e: any) =>
                              e.event_type === 'interviewer_action' &&
                              e.payload?.action_type === 'switch_persona' &&
                              (e.payload?.persona || e.payload?.custom_text)
                            ).slice(0, 3)
                            const used = new Set(
                              (events || []).filter((e: any) => e.event_type === 'persona_used')
                                .map((e: any) => e.payload?.persona).filter(Boolean)
                            )
                            if (switched.length === 0) return null
                            return (
                              <div className="space-y-1 mt-1">
                                {switched.map((e: any, i: number) => {
                                  const key = e.payload?.persona || ''
                                  const isCustomPersona = !!e.payload?.custom_text
                                  const isUsed = used.has(key) || (isCustomPersona && used.has('custom'))
                                  const personaLabel = isCustomPersona
                                    ? (e.payload?.custom_text?.slice(0, 40) || 'Custom')
                                    : (getPersonaDisplayName(key) || key.replace(/_/g, ' ') || 'Unknown')
                                  return (
                                    <div key={e.id || i} className="flex items-center gap-1.5 text-[10px]">
                                      {isUsed ? (
                                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                      ) : (
                                        <Clock3 className="h-3 w-3 text-amber-500" />
                                      )}
                                      <span className={isUsed ? 'text-muted-foreground' : 'text-foreground'}>
                                        {personaLabel}
                                      </span>
                                      <Badge variant={isUsed ? 'secondary' : 'outline'} className="h-4 px-1 text-[9px]">
                                        {isUsed ? 'Applied' : 'Pending'}
                                      </Badge>
                                    </div>
                                  )
                                })}
                              </div>
                            )
                          })()}
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">
                          Persona controls only apply to conversational rounds (voice, email, agentic). The current round is text-based.
                        </p>
                      )}
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
                        <Button variant="outline" size="sm" disabled={!!sendingAction} onClick={() => escalateDifficulty(escalationLevel)}>
                          Escalate
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Round Control
                      </label>
                      <Button variant="outline" size="sm" className="w-full" disabled={!!sendingAction} onClick={endRound}>
                        End round
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Gate Decision
                      </label>
                      <Button variant="secondary" size="sm" className="w-full" disabled={!!sendingAction} onClick={() => sendDecision('proceed')}>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Proceed
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Red Flag Section */}
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
                    disabled={!!sendingAction}
                    onClick={() => {
                      sendAction('flag_red_flag', {
                        flag_type: flagType,
                        description: flagDescription || RED_FLAG_TYPES[flagType as RedFlagTypeKey]?.description || '',
                        severity: flagSeverity
                      })
                      setFlagDescription('')
                    }}
                  >
                    {sendingAction === 'flag_red_flag' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <AlertTriangle className="mr-2 h-4 w-4" />}
                    {sendingAction === 'flag_red_flag' ? 'Flagging...' : 'Flag'}
                  </Button>
                </div>

                {/* Stop Interview */}
                <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-destructive">Stop interview</p>
                    <p className="text-xs text-destructive/80">Ends the session immediately.</p>
                  </div>
                  <Button variant="destructive" size="sm" disabled={!!sendingAction} onClick={() => sendDecision('stop')}>
                    <Slash className="mr-2 h-4 w-4" />
                    Stop
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">Applies to next response</p>
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Interviewer Notes</CardTitle>
                  <CardDescription className="text-xs mt-0.5">Saved to session action logs when submitted.</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowNotes((prev) => !prev)}>
                  {showNotes ? 'Hide' : 'Show'}
                </Button>
              </div>
            </CardHeader>
            {showNotes && (<CardContent className="space-y-3">
              <Textarea
                rows={6}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Capture context for final recommendation, concern areas, and decision rationale..."
              />
              <Button
                variant="secondary"
                disabled={!!sendingAction || !notes.trim()}
                onClick={async () => {
                  if (!notes.trim()) return
                  const result = await sendAction('interviewer_note', { note: notes })
                  if (result?.ok) {
                    setNotes('')
                    setNoteSavedToast(true)
                    setTimeout(() => setNoteSavedToast(false), 2500)
                  }
                }}
              >
                {sendingAction === 'interviewer_note' ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}
                {sendingAction === 'interviewer_note' ? 'Saving...' : 'Save Note'}
              </Button>
              <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                <ShieldAlert className="mb-2 h-4 w-4" />
                All interviewer actions, notes, and magic-link events are logged for audit and post-assessment review.
              </div>
              {noteSavedToast && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400 animate-in fade-in slide-in-from-top-1 duration-200">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Note saved successfully.
                </div>
              )}
            </CardContent>
            )}
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
                          const lowerValue = value.toLowerCase()
                          const alreadySent = followupThread.some(
                            (q) => q.question.toLowerCase().trim() === lowerValue
                          ) || localFollowups.some(
                            (q) => q.question.toLowerCase().trim() === lowerValue
                          )
                          if (alreadySent) return
                          const optimisticId = `local-${Date.now()}`
                          setLocalFollowups((prev) => [
                            ...prev,
                            {
                              id: optimisticId,
                              question: value,
                              round_number: targetRoundNumber ?? undefined,
                              created_at: new Date().toISOString()
                            }
                          ])
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
                      disabled={sendingAction === 'manual_followup'}
                      onClick={(event) => {
                        const input = (event.currentTarget
                          .previousElementSibling as HTMLInputElement | null)
                        const value = (input?.value || '').trim()
                        if (!value) return
                        const lowerValue = value.toLowerCase()
                        const alreadySent = followupThread.some(
                          (q) => q.question.toLowerCase().trim() === lowerValue
                        ) || localFollowups.some(
                          (q) => q.question.toLowerCase().trim() === lowerValue
                        )
                        if (alreadySent) return
                        const optimisticId = `local-${Date.now()}`
                        setLocalFollowups((prev) => [
                          ...prev,
                          {
                            id: optimisticId,
                            question: value,
                            round_number: targetRoundNumber ?? undefined,
                            created_at: new Date().toISOString()
                          }
                        ])
                        sendAction('manual_followup', {
                          followup: value,
                          round_number: targetRoundNumber ?? null,
                          target_round: targetRoundNumber ?? null
                        })
                        if (input) input.value = ''
                      }}
                    >
                      {sendingAction === 'manual_followup' ? (
                        <>
                          <span className="mr-1 inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          Sending...
                        </>
                      ) : (
                        'Add'
                      )}
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
                              disabled={!!sendingAction}
                              onClick={() => {
                                const lowerItem = item.toLowerCase().trim()
                                const alreadySent = followupThread.some(
                                  (q) => q.question.toLowerCase().trim() === lowerItem
                                ) || localFollowups.some(
                                  (q) => q.question.toLowerCase().trim() === lowerItem
                                )
                                if (alreadySent) return
                                const optimisticId = `local-${Date.now()}`
                                setLocalFollowups((prev) => [
                                  ...prev,
                                  {
                                    id: optimisticId,
                                    question: item,
                                    round_number: targetRoundNumber ?? undefined,
                                    created_at: new Date().toISOString()
                                  }
                                ])
                                sendAction('manual_followup', {
                                  followup: item,
                                  round_number: targetRoundNumber ?? null,
                                  target_round: targetRoundNumber ?? null
                                })
                              }}
                            >
                              {sendingAction === 'manual_followup' ? (
                                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                              ) : (
                                'Ask now'
                              )}
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
