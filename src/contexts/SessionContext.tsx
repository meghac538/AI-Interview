'use client'

import { createContext, useContext, ReactNode } from 'react'
import { useRealtimeSession } from '@/hooks/useRealtimeSession'
import type { Artifact, InterviewSession, Round, Score, Event, InterviewScopePackage } from '@/lib/types/database'

interface SessionContextValue {
  session: InterviewSession | null
  scopePackage: InterviewScopePackage | null
  rounds: Round[]
  currentRound: Round | null
  scores: Score[]
  events: Event[]
  artifacts: Artifact[]
  assessments: any[]
  loading: boolean
  refresh: () => Promise<void>
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined)

export function SessionProvider({
  sessionId,
  children
}: {
  sessionId: string
  children: ReactNode
}) {
  const data = useRealtimeSession(sessionId)

  const currentRound =
    data.rounds.find((r) => r.status === 'active') ||
    data.rounds.find((r) => r.status === 'pending') ||
    data.rounds[0] ||
    null

  return (
    <SessionContext.Provider value={{ ...data, currentRound }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  const context = useContext(SessionContext)
  if (!context) {
    throw new Error('useSession must be used within SessionProvider')
  }
  return context
}
