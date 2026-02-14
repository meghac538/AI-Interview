'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { SessionProvider, useSession } from '@/contexts/SessionContext'
import { TaskSurface } from '@/components/TaskSurface'
import { SidekickPanel } from '@/components/SidekickPanel'
import { AlarmClock, ChevronRight, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

function CandidateView() {
  const { session, rounds, currentRound, scopePackage, loading } = useSession()
  const [timeLeft, setTimeLeft] = useState(0)
  const [endAt, setEndAt] = useState<number | null>(null)
  const autoSubmitFired = useRef(false)
  const router = useRouter()

  // Auto-start Round 1 if session is scheduled
  useEffect(() => {
    const autoStartRound = async () => {
      if (
        session?.status === 'scheduled' &&
        currentRound?.status === 'pending' &&
        currentRound.round_number === 1
      ) {
        const response = await fetch('/api/round/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: session.id,
            round_number: 1
          })
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
    autoStartRound()
  }, [session?.id, session?.status, currentRound?.status, currentRound?.round_number, currentRound?.duration_minutes])

  // Initialize timer when round starts
  useEffect(() => {
    if (currentRound?.status === 'active') {
      const durationMinutes = Number(currentRound.duration_minutes || 0)
      const startedAt = currentRound.started_at
        ? new Date(currentRound.started_at).getTime()
        : Date.now()
      const nextEndAt = startedAt + durationMinutes * 60 * 1000
      setEndAt(nextEndAt)
      setTimeLeft(Math.max(0, Math.ceil((nextEndAt - Date.now()) / 1000)))
      autoSubmitFired.current = false
    }
  }, [currentRound?.round_number, currentRound?.status, currentRound?.started_at, currentRound?.duration_minutes])

  // Countdown timer
  useEffect(() => {
    if (!endAt) return

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000))
      setTimeLeft(remaining)
      if (remaining === 0 && currentRound && !autoSubmitFired.current) {
        autoSubmitFired.current = true
        handleAutoSubmit()
      }
    }

    tick()
    const timer = setInterval(tick, 1000)

    return () => clearInterval(timer)
  }, [endAt, currentRound?.round_number])

  const handleAutoSubmit = async () => {
    if (!currentRound || !session) return
    // Complete round when time expires
    await fetch(`/api/round/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: session.id,
        round_number: currentRound.round_number
      })
    })
  }

  const handleSubmit = async () => {
    if (!currentRound || !session) return

    // Complete current round
    await fetch(`/api/round/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: session.id,
        round_number: currentRound.round_number
      })
    })

    // Check if there's a next round
    const nextRound = rounds.find(r => r.round_number === currentRound.round_number + 1)
    if (nextRound) {
      // Start next round
      await fetch(`/api/round/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.id,
          round_number: nextRound.round_number
        })
      })
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-skywash-600 mx-auto" />
          <p className="mt-4 text-sm text-ink-500">Loading session...</p>
        </div>
      </div>
    )
  }

  if (!session || !currentRound) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold text-ink-900">Session not found</p>
          <p className="mt-2 text-sm text-ink-500">This session may not exist or has ended.</p>
        </div>
      </div>
    )
  }

  if (session.status === 'completed' || session.status === 'aborted') {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold text-ink-900">Session Complete</p>
          <p className="mt-2 text-sm text-ink-500">Thank you for participating. You may now close this window.</p>
        </div>
      </div>
    )
  }

  // Calculate current round number from active round
  const currentRoundNumber = currentRound?.round_number || 1
  const progress = ((currentRoundNumber - 1) / rounds.length) * 100

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const track = scopePackage?.track || 'sales'

  const formatRoundType = (roundType?: string) => {
    if (!roundType) return 'ROUND'
    if (roundType === 'voice') return 'LIVE CONVERSATION'
    if (roundType === 'multi_channel') return 'MULTI-CHANNEL'
    return roundType.toUpperCase()
  }

  // Get candidate and job info from session (added by API)
  const candidateName = (session as any).candidate?.name || 'Candidate'
  const jobTitle = (session as any).job?.title || 'Position'
  const jobLevel = (session as any).job?.level_band || 'mid'

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#eef6ff_0%,#f7f7fb_35%,#fefefe_100%)] px-6 py-10">
      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[2fr,1fr]">
        <section className="space-y-6">
          {/* Header */}
          <header className="rounded-3xl border border-ink-100 bg-white/90 px-6 py-4 shadow-panel backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="font-display text-xl text-ink-900">{jobTitle}</h1>
                  <Badge tone="sky">{session.status}</Badge>
                </div>
                <p className="mt-0.5 text-xs text-ink-400">
                  {candidateName} • Level {jobLevel}
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <AlarmClock className="h-4 w-4 text-skywash-600" />
                <span className="font-semibold tabular-nums text-lg text-ink-900">{formatTime(timeLeft)}</span>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <span className="text-[11px] text-ink-400 shrink-0">
                Round {currentRoundNumber}/{rounds.length}
              </span>
              <Progress value={progress} className="flex-1" />
            </div>
          </header>

          {/* Task Surface */}
          <Card className="animate-rise-in border-ink-100 bg-white/90 shadow-panel">
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-ink-400">
                  <Sparkles className="h-3.5 w-3.5 text-skywash-500" />
                  Round Brief
                </div>
                <h2 className="font-display text-xl text-ink-900">{currentRound.title}</h2>
                <p className="text-sm leading-relaxed text-ink-500">{currentRound.prompt}</p>
              </div>
              <TaskSurface round={currentRound} />
              <div className="flex items-center justify-between">
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={session.status !== 'live'}
                >
                  Submit & Next
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
                <span className="text-[11px] text-ink-400">
                  Auto-submits when timer expires
                </span>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Sidebar */}
        <aside className="space-y-6">
          <SidekickPanel role={jobTitle} track={track} />

          {/* Session Status */}
          <Card className="border-ink-100 bg-white/90 shadow-panel">
            <CardContent className="divide-y divide-ink-100/60">
              <div className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-ink-600">Session Status</span>
                <span className="font-semibold capitalize">{session.status}</span>
              </div>
              <div className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-ink-600">Round Type</span>
                <span className="text-ink-500 uppercase">{formatRoundType(currentRound.round_type)}</span>
              </div>
              <div className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-ink-600">Duration</span>
                <span className="text-ink-500">{currentRound.duration_minutes} min</span>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  )
}

export default function CandidatePage() {
  const params = useParams()
  const sessionId = params.sessionId as string

  return (
    <SessionProvider sessionId={sessionId}>
      <CandidateView />
    </SessionProvider>
  )
}
