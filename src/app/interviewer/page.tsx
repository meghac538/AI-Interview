'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardHeader } from '@/components/ui/card'

type SessionListItem = {
  id: string
  status: string
  candidate?: { name?: string }
  job?: { title?: string }
}

export default function InterviewerPage() {
  const [sessions, setSessions] = useState<SessionListItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadSessions = async () => {
      const response = await fetch('/api/interviewer/sessions')
      if (response.ok) {
        const data = await response.json()
        setSessions(data.sessions || [])
      }
      setLoading(false)
    }
    loadSessions()
  }, [])

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#eef6ff_0%,#f7f7fb_35%,#fefefe_100%)] px-6 py-10">
      <div className="mx-auto w-full max-w-5xl">
        <Card className="bg-white/90">
          <CardHeader className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-500">
                Interviewer Console
              </p>
              <h1 className="text-2xl font-semibold text-ink-900">Active Sessions</h1>
              <p className="text-sm text-ink-500">
                Select a session to open the live Gate Panel and transcript.
              </p>
            </div>
            {loading && (
              <div className="rounded-2xl bg-ink-50 px-4 py-3 text-sm text-ink-500">
                Loading sessions...
              </div>
            )}
            {!loading && sessions.length === 0 && (
              <div className="rounded-2xl bg-ink-50 px-4 py-3 text-sm text-ink-500">
                No sessions found.
              </div>
            )}
            <div className="flex flex-col gap-3">
              {sessions.map((session) => (
                <Link
                  key={session.id}
                  href={`/interviewer/${session.id}`}
                  className="rounded-2xl border border-ink-100 bg-white px-4 py-3 text-sm transition hover:border-skywash-300"
                >
                  <div className="font-semibold text-ink-900">
                    {session.candidate?.name || 'Candidate'} • {session.job?.title || 'Role'}
                  </div>
                  <div className="text-xs text-ink-500">Session status: {session.status}</div>
                </Link>
              ))}
            </div>
          </CardHeader>
        </Card>
      </div>
    </main>
  )
}
