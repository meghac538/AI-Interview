'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Loader2, LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { ThemeToggle } from '@/components/theme-toggle'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { authedFetch } from '@/lib/supabase/authed-fetch'
import { resolveCurrentUserRole } from '@/lib/supabase/client-role'
import { isInterviewerRole } from '@/lib/auth/roles'
import { supabase } from '@/lib/supabase/client'

type SessionListItem = {
  id: string
  status: string
  candidate?: { name?: string; email?: string }
  job?: { title?: string; level_band?: string }
  created_at?: string
}

export default function InterviewerPage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<SessionListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [authReady, setAuthReady] = useState(false)
  const [authEmail, setAuthEmail] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      const { email, role } = await resolveCurrentUserRole()
      if (cancelled) return

      if (!email) {
        router.replace('/interviewer/login')
        return
      }

      if (!isInterviewerRole(role)) {
        router.replace('/interviewer/login?denied=1&next=%2Finterviewer')
        return
      }

      setAuthEmail(email)
      setAuthReady(true)

      const response = await authedFetch('/api/interviewer/sessions')
      if (response.ok) {
        const data = await response.json()
        if (!cancelled) setSessions(data.sessions || [])
      }

      if (!cancelled) setLoading(false)
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [router])

  const signOut = async () => {
    await supabase.auth.signOut()
    router.replace('/interviewer/login')
  }

  if (!authReady) {
    return (
      <main className="surface-grid flex min-h-screen items-center justify-center px-4 py-10">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Validating interviewer access...
        </div>
      </main>
    )
  }

  return (
    <main className="surface-grid min-h-screen px-4 py-8 md:px-8">
      <div className="mx-auto w-full max-w-5xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Interviewer</p>
            <h1 className="text-2xl font-semibold">Live Assessment Sessions</h1>
            <p className="text-sm text-muted-foreground">Open a live session for transcript, controls, and deployment panel.</p>
            {authEmail ? <p className="mt-1 text-xs text-muted-foreground">Signed in: {authEmail}</p> : null}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/">Home</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin">Admin</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/about-oneorigin">About</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
            <ThemeToggle />
          </div>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Active and Recent Sessions</CardTitle>
            <CardDescription>Newest sessions appear first.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading sessions...
              </div>
            )}

            {!loading && sessions.length === 0 && (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">No sessions found.</div>
            )}

            {sessions.map((session) => {
              const statusVariant =
                session.status === 'live' ? 'default' : session.status === 'completed' ? 'secondary' : 'outline'

              return (
                <Link
                  key={session.id}
                  href={`/interviewer/${session.id}`}
                  className="flex items-center justify-between rounded-lg border p-4 transition hover:bg-muted/30"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">
                        {session.candidate?.name || 'Candidate'} | {session.job?.title || 'Role'}
                      </p>
                      <Badge variant={statusVariant} className="capitalize">
                        {session.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {session.candidate?.email || 'No email'} | Level {session.job?.level_band || 'n/a'}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              )
            })}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
