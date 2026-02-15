'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { LogOut, Plus, ArrowRight } from 'lucide-react'

type SessionListItem = {
  id: string
  status: string
  candidate?: { name?: string }
  job?: { title?: string }
}

export default function InterviewerDashboard() {
  const router = useRouter()
  const [sessions, setSessions] = useState<SessionListItem[]>([])
  const [loadingSessions, setLoadingSessions] = useState(true)

  // Create session form
  const [candidateName, setCandidateName] = useState('')
  const [role, setRole] = useState('Account Executive')
  const [level, setLevel] = useState('mid')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const loadSessions = async () => {
    const response = await fetch('/api/interviewer/sessions')
    if (response.ok) {
      const data = await response.json()
      setSessions(data.sessions || [])
    }
    setLoadingSessions(false)
  }

  useEffect(() => {
    loadSessions()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const createSession = async () => {
    if (!candidateName.trim()) return
    setCreating(true)
    setCreateError(null)

    try {
      const response = await fetch('/api/session/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate_name: candidateName, role, level }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to create session')

      // Refresh session list and clear form
      setCandidateName('')
      await loadSessions()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setCreateError(message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#eef6ff_0%,#f7f7fb_35%,#fefefe_100%)] px-6 py-8">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-400">
              Interviewer Dashboard
            </p>
            <h1 className="text-2xl font-display font-semibold text-ink-900">
              Sessions
            </h1>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>

        {/* Create Session */}
        <Card className="bg-white/90">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-skywash-600" />
              <h2 className="text-base font-semibold">Create New Session</h2>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[160px] space-y-1">
                <label className="text-xs font-medium text-ink-600">Candidate Name</label>
                <Input
                  placeholder="Jane Doe"
                  value={candidateName}
                  onChange={(e) => setCandidateName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && candidateName.trim()) createSession()
                  }}
                />
              </div>
              <div className="flex-1 min-w-[140px] space-y-1">
                <label className="text-xs font-medium text-ink-600">Role</label>
                <Select value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="Account Executive">Account Executive</option>
                  <option value="SDR">SDR</option>
                  <option value="Solutions Engineer">Solutions Engineer</option>
                  <option value="Customer Success Manager">Customer Success Manager</option>
                  <option value="Implementation Specialist">Implementation Specialist</option>
                </Select>
              </div>
              <div className="w-[120px] space-y-1">
                <label className="text-xs font-medium text-ink-600">Level</label>
                <Select value={level} onChange={(e) => setLevel(e.target.value)}>
                  <option value="junior">Junior</option>
                  <option value="mid">Mid</option>
                  <option value="senior">Senior</option>
                </Select>
              </div>
              <Button
                size="sm"
                onClick={createSession}
                disabled={creating || !candidateName.trim()}
              >
                {creating ? 'Creating...' : 'Create'}
              </Button>
            </div>
            {createError && (
              <p className="mt-2 text-xs text-signal-600">{createError}</p>
            )}
          </CardContent>
        </Card>

        {/* Session List */}
        <Card className="bg-white/90">
          <CardHeader>
            <h2 className="text-base font-semibold">Active Sessions</h2>
            <p className="text-xs text-ink-500">
              Click a session to open the live Gate Panel and transcript.
            </p>
          </CardHeader>
          <CardContent>
            {loadingSessions && (
              <div className="rounded-2xl bg-ink-50 px-4 py-3 text-sm text-ink-500">
                Loading sessions...
              </div>
            )}
            {!loadingSessions && sessions.length === 0 && (
              <div className="rounded-2xl bg-ink-50 px-4 py-3 text-sm text-ink-500">
                No sessions yet. Create one above to get started.
              </div>
            )}
            <div className="flex flex-col gap-3">
              {sessions.map((session) => (
                <Link
                  key={session.id}
                  href={`/interviewer/${session.id}`}
                  className="flex items-center justify-between rounded-2xl border border-ink-100 bg-white px-4 py-3 transition hover:border-skywash-300"
                >
                  <div>
                    <div className="text-sm font-semibold text-ink-900">
                      {session.candidate?.name || 'Candidate'} &middot; {session.job?.title || 'Role'}
                    </div>
                    <div className="text-xs text-ink-500">
                      {session.id.slice(0, 8)}...
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone={session.status === 'live' ? 'sky' : 'neutral'}>
                      {session.status}
                    </Badge>
                    <ArrowRight className="h-4 w-4 text-ink-400" />
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
