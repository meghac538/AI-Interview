import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { Artifact, InterviewSession, Round, Score, Event, InterviewScopePackage } from '@/lib/types/database'

export function useRealtimeSession(sessionId: string) {
  const [session, setSession] = useState<InterviewSession | null>(null)
  const [scopePackage, setScopePackage] = useState<InterviewScopePackage | null>(null)
  const [rounds, setRounds] = useState<Round[]>([])
  const [scores, setScores] = useState<Score[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [assessments, setAssessments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const refreshInFlight = useRef(false)

  const refresh = useCallback(async () => {
    if (!sessionId) return
    // Skip if a refresh is already in progress to prevent pile-up
    if (refreshInFlight.current) return
    refreshInFlight.current = true
    try {
      const response = await fetch(`/api/session/${sessionId}`, { cache: 'no-store' })
      if (response.ok) {
        const data = await response.json()

        setSession(data.session)
        setScopePackage(data.scopePackage)
        setRounds(data.scopePackage?.round_plan || [])
        setScores(data.scores || [])
        setEvents(data.events || [])
        setArtifacts(data.artifacts || [])
        setAssessments(data.assessments || [])
      }
      setLoading(false)
    } finally {
      refreshInFlight.current = false
    }
  }, [sessionId])

  // Initial fetch + slow polling fallback (real-time handles live updates;
  // polling is only a safety net in case the WebSocket drops)
  useEffect(() => {
    if (!sessionId) return
    let cancelled = false

    const tick = async () => {
      if (cancelled) return
      await refresh()
    }

    void tick()

    const interval = setInterval(() => {
      void tick()
    }, 30000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [sessionId, refresh])

  // Subscribe to real-time updates
  useEffect(() => {
    if (!sessionId) return

    const sessionChannel = supabase
      .channel(`session:${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'interview_sessions',
          filter: `id=eq.${sessionId}`
        },
        (payload) => {
          if (payload.new) {
            setSession((prev) => prev ? { ...prev, ...payload.new as InterviewSession } : payload.new as InterviewSession)
          }
        }
      )
      .subscribe()

    const scopeChannel = supabase
      .channel(`scope:${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'interview_scope_packages',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => {
          if (payload.new) {
            const pkg = payload.new as InterviewScopePackage
            setScopePackage(pkg)
            setRounds(pkg.round_plan || [])
          }
        }
      )
      .subscribe()

    const scoresChannel = supabase
      .channel(`scores:${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scores',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => {
          if (payload.new) {
            const nextScore = payload.new as Score
            setScores((prev) => {
              const index = prev.findIndex((s) => s.id === nextScore.id)
              if (index >= 0) {
                const updated = [...prev]
                updated[index] = nextScore
                return updated
              }
              return [...prev, nextScore]
            })
          }
        }
      )
      .subscribe()

    const eventsChannel = supabase
      .channel(`events:${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'live_events',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => {
          if (payload.new) {
            const incoming = payload.new as Event
            setEvents((prev) => {
              if (prev.some((e) => e.id === incoming.id)) return prev
              return [incoming, ...prev]
            })
          }
        }
      )
      .subscribe()

    const assessmentsChannel = supabase
      .channel(`assessments:${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ai_assessments',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => {
          if (payload.new) {
            setAssessments((prev) => [payload.new, ...prev])
          }
        }
      )
      .subscribe()

    return () => {
      sessionChannel.unsubscribe()
      scopeChannel.unsubscribe()
      scoresChannel.unsubscribe()
      eventsChannel.unsubscribe()
      assessmentsChannel.unsubscribe()
    }
  }, [sessionId])

  return { session, scopePackage, rounds, scores, events, artifacts, assessments, loading, refresh }
}
