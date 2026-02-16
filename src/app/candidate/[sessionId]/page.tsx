"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useParams } from "next/navigation"
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  ShieldCheck,
  Sparkles,
  TimerReset,
  Workflow
} from "lucide-react"
import { SessionProvider, useSession } from "@/contexts/SessionContext"
import { TaskSurface } from "@/components/TaskSurface"
import { SidekickPanel } from "@/components/SidekickPanel"
import { RoleFlowHub } from "@/components/role-flow-hub"
import { ThemeToggle } from "@/components/theme-toggle"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

function AutoStopOverlay() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <div className="text-center space-y-4">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
        <p className="text-lg font-semibold">Session Ending</p>
        <p className="text-sm text-muted-foreground">Please wait while we wrap up...</p>
      </div>
    </div>
  )
}

function SessionCompleteOverlay({ candidateName, roleName }: { candidateName: string; roleName: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <Card className="mx-4 max-w-lg text-center">
        <CardHeader className="space-y-4 pb-2">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          </div>
          <CardTitle className="text-2xl">Session Complete</CardTitle>
          <CardDescription className="text-base">
            Thank you, {candidateName}. Your assessment for <span className="font-medium text-foreground">{roleName}</span> has been submitted successfully.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
            All your responses have been auto-saved and submitted for evaluation. You will receive feedback from the hiring team.
          </div>
          <p className="text-xs text-muted-foreground">You may now close this window.</p>
        </CardContent>
      </Card>
    </div>
  )
}

function CandidateWorkspace() {
  const { session, scopePackage, rounds, currentRound, events, loading } = useSession()
  const [timeLeft, setTimeLeft] = useState(0)
  const [endAt, setEndAt] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const autoSubmitFired = useRef(false)
  const handleSubmitRef = useRef<(auto?: boolean) => Promise<void>>(() => Promise.resolve())
  const [followupAnswer, setFollowupAnswer] = useState('')
  const [followupGateRound, setFollowupGateRound] = useState<number | null>(null)
  const [forcedFollowupId, setForcedFollowupId] = useState<string | null>(null)
  const [forcedFollowupQuestion, setForcedFollowupQuestion] = useState<string | null>(null)
  const [serverFollowups, setServerFollowups] = useState<
    Array<{ id: string; question: string; round_number?: number | null; source?: string; answered?: boolean; answer?: string }>
  >([])
  const [localFollowups, setLocalFollowups] = useState<
    Array<{ question_id: string; question: string; round_number: number }>
  >([])
  const [localAnswers, setLocalAnswers] = useState<
    Array<{ question_id: string; question: string; answer: string; round_number: number }>
  >([])
  const [submittingFollowup, setSubmittingFollowup] = useState(false)

  const followupThread = useMemo(() => {
    if (!currentRound) return []

    // Single canonical source: followup_question events (covers both auto + manual)
    const questions = (events || [])
      .filter(
        (event) =>
          event.event_type === 'followup_question' &&
          (event.payload?.round_number == null ||
            Number(event.payload?.round_number) === currentRound.round_number)
      )
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

    const answers = (events || [])
      .filter(
        (event) =>
          event.event_type === 'followup_answer' &&
          (event.payload?.round_number == null ||
            Number(event.payload?.round_number) === currentRound.round_number)
      )
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

    // Optimistic local questions (shown before real-time events arrive)
    const localQuestions = localFollowups
      .filter((item) => Number(item.round_number) === currentRound.round_number)
      .map((item) => ({
        payload: {
          question_id: item.question_id,
          question: item.question
        },
        created_at: new Date().toISOString()
      }))

    // Server questions (loaded on mount for page reloads)
    const serverQuestions = serverFollowups
      .filter(
        (item) =>
          item.round_number == null ||
          Number(item.round_number) === currentRound.round_number
      )
      .map((item) => ({
        payload: {
          question_id: item.id,
          question: item.question
        },
        created_at: new Date().toISOString()
      }))

    const localAnswerEvents = localAnswers
      .filter((item) => Number(item.round_number) === currentRound.round_number)
      .map((item) => ({
        payload: {
          question_id: item.question_id,
          question: item.question,
          answer: item.answer
        },
        created_at: new Date().toISOString()
      }))

    // Deduplicate by question_id first, then by question text as fallback
    // (multiple submissions of the same text create different UUIDs)
    const seenIds = new Set<string>()
    const seenTexts = new Set<string>()
    const allQuestions: Array<{ payload?: Record<string, any>; created_at: string; [key: string]: any }> = []
    for (const item of [...localQuestions, ...serverQuestions, ...questions]) {
      const id = item.payload?.question_id
      if (id && seenIds.has(id)) continue
      const textKey = (item.payload?.question || '').toLowerCase().trim()
      if (textKey && seenTexts.has(textKey)) continue
      if (id) seenIds.add(id)
      if (textKey) seenTexts.add(textKey)
      allQuestions.push(item)
    }

    const allAnswers = [...answers, ...localAnswerEvents]

    // Dual answer matching: by question_id (UUID) AND by question text
    // This handles UUID mismatches when dedup picks a different ID than what the answer references
    const answerByIdMap = new Map<string, string>()
    const answerByTextMap = new Map<string, string>()
    for (const answer of allAnswers) {
      const ans = answer.payload?.answer || ''
      if (answer.payload?.question_id) {
        answerByIdMap.set(answer.payload.question_id, ans)
      }
      const qText = String(answer.payload?.question || '').toLowerCase().trim()
      if (qText) {
        answerByTextMap.set(qText, ans)
      }
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

    return allQuestions.map((question) => {
      const questionText =
        forcedFollowupId &&
        forcedFollowupQuestion &&
        question.payload?.question_id === forcedFollowupId
          ? forcedFollowupQuestion
          : question.payload?.question || ''
      const textKey = questionText.toLowerCase().trim()
      const qId = question.payload?.question_id
      const answeredById = qId ? answerByIdMap.has(qId) : false
      const answeredByText = answerByTextMap.has(textKey)
      const answeredByServer = qId
        ? serverAnswerByIdMap.has(qId) || serverAnswerByTextMap.has(textKey)
        : serverAnswerByTextMap.has(textKey)
      const isAnswered = answeredById || answeredByText || answeredByServer
      return {
        id: qId,
        question: questionText,
        answered: isAnswered,
        answer: answeredById
          ? answerByIdMap.get(qId!)
          : answeredByText
            ? answerByTextMap.get(textKey)
            : answeredByServer
              ? (serverAnswerByIdMap.get(qId!) || serverAnswerByTextMap.get(textKey))
              : undefined
      }
    })
  }, [
    events,
    currentRound,
    localFollowups,
    localAnswers,
    forcedFollowupId,
    forcedFollowupQuestion,
    serverFollowups
  ])

  const autoStopTriggered = useMemo(() => {
    return (events || []).some(
      (e: any) =>
        e.event_type === 'auto_stop_triggered' ||
        e.event_type === 'session_force_stopped'
    )
  }, [events])

  const cautionCount = useMemo(() => {
    return (events || []).filter(
      (e: any) => e.event_type === 'red_flag_detected'
    ).length
  }, [events])

  const pendingFollowup =
    (forcedFollowupId
      ? followupThread.find((item) => item.id === forcedFollowupId && !item.answered)
      : null) ||
    followupThread.find((item) => item.id && !item.answered)
  const hasPendingFollowups = Boolean(pendingFollowup)
  const showFollowups =
    Boolean(followupGateRound && currentRound?.round_number === followupGateRound) ||
    hasPendingFollowups

  // Load follow-up thread with periodic refresh
  useEffect(() => {
    if (!session?.id) return
    const loadThread = async () => {
      try {
        const response = await fetch('/api/followup/thread', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: session.id })
        })
        if (response.ok) {
          const data = await response.json()
          if (Array.isArray(data?.thread)) {
            setServerFollowups(data.thread)
          }
        }
      } catch {
        // Best-effort sync.
      }
    }
    loadThread()
    const interval = setInterval(loadThread, 15000)
    return () => clearInterval(interval)
  }, [session?.id])

  // Prune localFollowups once the same question_id appears in real-time events
  useEffect(() => {
    if (!events || events.length === 0 || localFollowups.length === 0) return
    const eventQuestionIds = new Set(
      events
        .filter((e) => e.event_type === 'followup_question')
        .map((e) => e.payload?.question_id)
        .filter(Boolean)
    )
    if (eventQuestionIds.size === 0) return
    setLocalFollowups((prev) => {
      const pruned = prev.filter((item) => !eventQuestionIds.has(item.question_id))
      return pruned.length === prev.length ? prev : pruned
    })
  }, [events, localFollowups.length])

  // Auto-start first round
  useEffect(() => {
    const autoStartRound = async () => {
      if (
        session?.status === "scheduled" &&
        currentRound?.status === "pending" &&
        currentRound.round_number === 1
      ) {
        const response = await fetch("/api/round/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: session.id, round_number: 1 })
        })

        if (response.ok) {
          const updatedRound = await response.json()
          const durationMinutes = Number(updatedRound?.duration_minutes || currentRound.duration_minutes || 0)
          const startedAt = updatedRound?.started_at
            ? new Date(updatedRound.started_at).getTime()
            : Date.now()

          const nextEndAt = startedAt + durationMinutes * 60 * 1000
          setEndAt(nextEndAt)
          setTimeLeft(Math.max(0, Math.ceil((nextEndAt - Date.now()) / 1000)))
          autoSubmitFired.current = false
        }
      }
    }

    void autoStartRound()
  }, [session?.id, session?.status, currentRound?.round_number, currentRound?.status, currentRound?.duration_minutes])

  // Sync timer with active round
  useEffect(() => {
    if (currentRound?.status === "active") {
      const durationMinutes = Number(currentRound.duration_minutes || 0)
      const startedAt = currentRound.started_at
        ? new Date(currentRound.started_at).getTime()
        : Date.now()
      const nextEndAt = startedAt + durationMinutes * 60 * 1000
      setEndAt(nextEndAt)
      setTimeLeft(Math.max(0, Math.ceil((nextEndAt - Date.now()) / 1000)))
      autoSubmitFired.current = false
    }
  }, [currentRound?.round_number, currentRound?.status, currentRound?.duration_minutes, currentRound?.started_at])

  // Timer countdown — uses ref to always call the latest handleSubmit
  useEffect(() => {
    if (!endAt) return

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000))
      setTimeLeft(remaining)
      if (remaining === 0 && !autoSubmitFired.current) {
        autoSubmitFired.current = true
        void handleSubmitRef.current(true)
      }
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [endAt])

  const handleSubmit = async (auto = false) => {
    if (!session || !currentRound || submitting) return

    // Auto-submit bypasses follow-up gating
    if (auto) {
      setSubmitting(true)

      try {
        // Dispatch auto-save event so round UIs can do a final non-draft save
        window.dispatchEvent(
          new CustomEvent('round-auto-save', {
            detail: { session_id: session.id, round_number: currentRound.round_number }
          })
        )
        // Brief wait for round UIs to fire their save requests
        await new Promise((resolve) => setTimeout(resolve, 500))

        const completeRes = await fetch("/api/round/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: session.id,
            round_number: currentRound.round_number
          })
        })

        if (!completeRes.ok) {
          console.error('Round complete failed:', completeRes.status, await completeRes.text().catch(() => ''))
        }

        const nextRound = rounds.find((round) => round.round_number === currentRound.round_number + 1)
        if (nextRound) {
          const startRes = await fetch("/api/round/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              session_id: session.id,
              round_number: nextRound.round_number
            })
          })

          if (startRes.ok) {
            const startedRound = await startRes.json()
            // Set the timer for the new round immediately (don't wait for real-time)
            const durationMinutes = Number(startedRound?.duration_minutes || nextRound.duration_minutes || 0)
            const startedAt = startedRound?.started_at
              ? new Date(startedRound.started_at).getTime()
              : Date.now()
            const nextEndAt = startedAt + durationMinutes * 60 * 1000
            setEndAt(nextEndAt)
            setTimeLeft(Math.max(0, Math.ceil((nextEndAt - Date.now()) / 1000)))
            autoSubmitFired.current = false
          } else {
            console.error('Round start failed:', startRes.status, await startRes.text().catch(() => ''))
          }
        }
        // If no next round, session is marked 'completed' by the round/complete API
      } catch (err) {
        console.error('Auto-submit error:', err)
        // Allow retry on failure
        autoSubmitFired.current = false
      } finally {
        setSubmitting(false)
        setTimeLeft(0)
      }
      return
    }

    // Show loading state immediately
    setSubmitting(true)

    try {
      // Only gate on followups that already exist locally (from real-time events).
      // Don't make blocking API calls that slow down submit.
      if (hasPendingFollowups) return

      // Auto-save candidate response before completing the round
      window.dispatchEvent(
        new CustomEvent('round-auto-save', {
          detail: { session_id: session.id, round_number: currentRound.round_number }
        })
      )
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Complete current round
      await fetch("/api/round/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: session.id,
          round_number: currentRound.round_number
        })
      })

      const nextRound = rounds.find((round) => round.round_number === currentRound.round_number + 1)

      if (nextRound) {
        const startRes = await fetch("/api/round/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: session.id,
            round_number: nextRound.round_number
          })
        })

        if (startRes.ok) {
          const startedRound = await startRes.json()
          const durationMinutes = Number(startedRound?.duration_minutes || nextRound.duration_minutes || 0)
          const startedAt = startedRound?.started_at
            ? new Date(startedRound.started_at).getTime()
            : Date.now()
          const nextEndAt = startedAt + durationMinutes * 60 * 1000
          setEndAt(nextEndAt)
          setTimeLeft(Math.max(0, Math.ceil((nextEndAt - Date.now()) / 1000)))
          autoSubmitFired.current = false
        }
      }
      // If no next round, session is marked 'completed' by the round/complete API
    } catch (err) {
      console.error('Submit error:', err)
    } finally {
      setSubmitting(false)
    }
  }

  // Keep ref in sync so the timer always calls the latest version
  handleSubmitRef.current = handleSubmit

  const submitFollowupAnswer = async () => {
    if (!pendingFollowup || !session || !currentRound) return
    if (!followupAnswer.trim() || submittingFollowup) return

    setSubmittingFollowup(true)
    const answerText = followupAnswer.trim()

    try {
    // Create followup_answer event via dedicated endpoint (bypasses artifacts table)
    await fetch('/api/followup/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: session.id,
        round_number: currentRound.round_number,
        question_id: pendingFollowup.id,
        question: pendingFollowup.question,
        answer: answerText
      })
    })

    // Also try artifact submission (best-effort, may fail if schema is missing columns)
    fetch('/api/artifact/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: session.id,
        round_number: currentRound.round_number,
        artifact_type: 'followup_answer',
        content: answerText,
        metadata: {
          question_id: pendingFollowup.id,
          question: pendingFollowup.question
        }
      })
    }).catch(() => {})

    if (pendingFollowup?.id && pendingFollowup.question) {
      setLocalAnswers((prev) => [
        ...prev,
        {
          question_id: pendingFollowup.id,
          question: pendingFollowup.question,
          answer: answerText,
          round_number: currentRound.round_number
        }
      ])
    }
    if (forcedFollowupId && pendingFollowup?.id === forcedFollowupId) {
      setForcedFollowupId(null)
      setForcedFollowupQuestion(null)
    }
    setFollowupAnswer('')
    } finally {
      setSubmittingFollowup(false)
    }
  }

  const formattedTime = useMemo(() => {
    const minutes = Math.floor(timeLeft / 60)
    const seconds = timeLeft % 60
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }, [timeLeft])

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CircleDashed className="h-4 w-4 animate-spin" />
          Loading candidate workspace...
        </div>
      </main>
    )
  }

  if (!session || !currentRound) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>Session unavailable</CardTitle>
            <CardDescription>
              No active session was found. Return to candidate login and re-enter using your invite email.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    )
  }

  if (autoStopTriggered) {
    return <AutoStopOverlay />
  }

  const candidateName = (session as any).candidate?.name || "Candidate"
  const roleName = (session as any).job?.title || "Assessment"

  // Session completed — show completion screen
  if (session.status === 'completed' || session.status === 'aborted') {
    return <SessionCompleteOverlay candidateName={candidateName} roleName={roleName} />
  }

  const currentRoundNumber = currentRound.round_number || 1
  const progress = ((currentRoundNumber - 1) / Math.max(rounds.length, 1)) * 100
  const roleTrack = (session as any).job?.track || "sales"
  const configuredRoleWidgets = (scopePackage as any)?.simulation_payloads?.role_widget_config?.lanes
  const configuredRoleFamily = (scopePackage as any)?.simulation_payloads?.role_widget_config?.role_family || roleTrack

  return (
    <main className="surface-grid min-h-screen px-5 py-8 md:px-10 md:py-10">
      <div className="mx-auto max-w-[1880px] space-y-7">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">OneOrigin Candidate Workspace</p>
            <h1 className="text-4xl font-semibold leading-tight tracking-[-0.01em] md:text-5xl">{roleName}</h1>
            <p className="text-sm tracking-[0.01em] text-muted-foreground">{candidateName}</p>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="capitalize">{session.status}</Badge>
            <ThemeToggle />
          </div>
        </header>

        {/* Caution banner — visible when any red flag is detected */}
        {cautionCount > 0 && !autoStopTriggered && (
          <div className="flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">Caution noted</p>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                The interviewer has noted a concern with your response. Please review your answer carefully and ensure accuracy.
              </p>
            </div>
          </div>
        )}

        <div className="grid gap-7 xl:grid-cols-[360px_minmax(0,1fr)] 2xl:gap-10">
          <aside className="order-2 xl:order-none">
            <RoleFlowHub lanes={configuredRoleWidgets} roleFamily={configuredRoleFamily} />
          </aside>

          <section className="order-1 xl:order-none">
            <Card className="glass-surface relative overflow-hidden rounded-[28px] border-0 bg-transparent shadow-none">
              <div className="glass-glow" aria-hidden="true" />

              <CardHeader className="relative z-10 space-y-6 p-7 md:p-10">
                <div className="flex flex-wrap items-start justify-between gap-6">
                  <div className="space-y-3">
                    <CardDescription className="uppercase tracking-[0.2em]">Center Canvas</CardDescription>
                    <CardTitle className="text-3xl leading-[1.1] tracking-tight md:text-5xl">
                      Round {String(currentRoundNumber).padStart(2, "0")}
                      <span className="text-muted-foreground"> / {String(rounds.length).padStart(2, "0")}</span>
                    </CardTitle>
                    <p className="max-w-3xl text-sm leading-7 tracking-[0.01em] text-muted-foreground md:text-base">
                      {currentRound.title}
                    </p>
                  </div>

                  <div className="grid w-full gap-3 sm:w-auto sm:grid-cols-2">
                    <div className="rounded-2xl border border-border/60 bg-background/40 px-5 py-4 text-right backdrop-blur">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Progress</p>
                      <p className="text-4xl font-bold leading-none tracking-tight">{Math.round(progress)}%</p>
                    </div>

                    <div className="rounded-2xl border border-border/60 bg-primary/10 px-5 py-4 text-right backdrop-blur">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Time</p>
                      <p className="text-4xl font-bold leading-none tracking-tight text-primary md:text-5xl">{formattedTime}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Live session completion</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} />
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-border/60 bg-background/35 p-4 backdrop-blur">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Flow</p>
                    <p className="mt-1 flex items-center gap-1 text-sm font-medium">
                      <Workflow className="h-4 w-4 text-primary" /> Agentic widgets active
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-background/35 p-4 backdrop-blur">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Integrity</p>
                    <p className="mt-1 flex items-center gap-1 text-sm font-medium">
                      <ShieldCheck className="h-4 w-4 text-emerald-500" /> Policy tracking on
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-background/35 p-4 backdrop-blur">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Assist</p>
                    <p className="mt-1 flex items-center gap-1 text-sm font-medium">
                      <Sparkles className="h-4 w-4 text-amber-500" /> Astra ready at edge
                    </p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="relative z-10 px-7 pb-6 md:px-10">
                <div className="rounded-2xl border border-border/60 bg-background/35 p-6 backdrop-blur md:p-8">
                  {/* Follow-up thread */}
                  {showFollowups && followupThread.length > 0 && (
                    <div className="mb-6 space-y-3 rounded-2xl border p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        Follow-up Thread
                      </div>
                      <div className="space-y-3 text-sm">
                        {followupThread.map((item) => (
                          <div key={item.id} className="rounded-2xl bg-muted/30 px-4 py-3">
                            <p className="font-semibold">Q: {item.question}</p>
                            {item.answered ? (
                              <p className="mt-2 text-muted-foreground">A: {item.answer}</p>
                            ) : (
                              <p className="mt-2 text-muted-foreground">Awaiting your response.</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pending follow-up answer */}
                  {showFollowups && hasPendingFollowups && (
                    <div className="mb-6 space-y-3 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-4">
                      <div className="text-sm font-semibold">Answer the follow-up</div>
                      <p className="text-sm text-muted-foreground">{pendingFollowup?.question}</p>
                      <Textarea
                        rows={5}
                        placeholder="Write your response to the follow-up question..."
                        value={followupAnswer}
                        onChange={(e) => setFollowupAnswer(e.target.value)}
                      />
                      <div className="flex items-center gap-3">
                        <Button
                          size="sm"
                          onClick={submitFollowupAnswer}
                          disabled={!followupAnswer.trim() || submittingFollowup}
                          className={cn(
                            (!followupAnswer.trim() && !submittingFollowup)
                              ? 'opacity-40 cursor-not-allowed'
                              : ''
                          )}
                        >
                          {submittingFollowup ? (
                            <>
                              <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                              Submitting...
                            </>
                          ) : (
                            'Submit follow-up'
                          )}
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          You must answer follow-ups before proceeding.
                        </span>
                      </div>
                    </div>
                  )}

                  <TaskSurface round={currentRound} events={events} />
                </div>
              </CardContent>

              <CardFooter className="relative z-10 flex flex-wrap items-center justify-between gap-3 px-7 pb-7 md:px-10 md:pb-10">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <TimerReset className="h-4 w-4" />
                  Responses are evaluated live and auto-submitted when timer expires.
                </div>

                <Button
                  onClick={() => handleSubmit(false)}
                  disabled={submitting || hasPendingFollowups}
                  size="lg"
                  className={cn(
                    "min-w-44 rounded-2xl",
                    hasPendingFollowups && !submitting && "opacity-40 cursor-not-allowed"
                  )}
                >
                  {submitting ? (
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {submitting ? "Submitting..." : "Submit & Next"}
                </Button>
              </CardFooter>

              <div className="glass-highlight" aria-hidden="true" />
              <div className="glass-inner-shadow" aria-hidden="true" />
            </Card>
          </section>
        </div>
      </div>

      <SidekickPanel role={roleName} />
    </main>
  )
}

export default function CandidatePage() {
  const params = useParams()
  const sessionId = params.sessionId as string

  return (
    <SessionProvider sessionId={sessionId}>
      <CandidateWorkspace />
    </SessionProvider>
  )
}
