"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Loader2, LogIn, ShieldAlert } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabase/client"
import { resolveCurrentUserRole } from "@/lib/supabase/client-role"
import { isInterviewerRole } from "@/lib/auth/roles"

function InterviewerLoginContent() {
  const router = useRouter()
  const params = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [signingIn, setSigningIn] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deniedEmail, setDeniedEmail] = useState<string | null>(null)

  const nextPath = useMemo(() => {
    const raw = params.get("next")
    if (!raw || !raw.startsWith("/interviewer")) return "/interviewer"
    return raw
  }, [params])

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      const { email, role } = await resolveCurrentUserRole()
      if (cancelled) return

      if (!email) {
        setLoading(false)
        return
      }

      if (isInterviewerRole(role)) {
        router.replace(nextPath)
        return
      }

      setDeniedEmail(email)
      setLoading(false)
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [nextPath, router])

  const signInWithGoogle = async () => {
    if (signingIn) return
    setSigningIn(true)
    setError(null)

    try {
      const origin = window.location.origin
      const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: {
            prompt: "select_account"
          }
        }
      })

      if (oauthError) {
        throw oauthError
      }
    } catch (err: any) {
      setError(err?.message || "Unable to start Google sign-in.")
      setSigningIn(false)
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setDeniedEmail(null)
  }

  if (loading) {
    return (
      <main className="surface-grid flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking interviewer access...
        </div>
      </main>
    )
  }

  return (
    <main className="surface-grid min-h-screen px-4 py-10 md:px-8">
      <div className="mx-auto w-full max-w-xl space-y-6">
        <header className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Interviewer</p>
            <h1 className="text-3xl font-semibold">Secure Console Sign-In</h1>
          </div>
          <ThemeToggle />
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Continue with Google</CardTitle>
            <CardDescription>
              Interviewer access is restricted to internal users with interviewer/admin roles.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {deniedEmail ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                <p className="flex items-center gap-2 font-medium">
                  <ShieldAlert className="h-4 w-4" />
                  Access denied for {deniedEmail}
                </p>
                <p className="mt-2 text-xs">
                  This account does not have interviewer permissions. Ask admin to grant role access.
                </p>
              </div>
            ) : null}

            <Button className="w-full" onClick={signInWithGoogle} disabled={signingIn}>
              {signingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              {signingIn ? "Redirecting..." : "Sign in with Google"}
            </Button>

            {deniedEmail ? (
              <Button variant="outline" className="w-full" onClick={signOut}>
                Sign out and use another account
              </Button>
            ) : null}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <Button variant="ghost" asChild className="w-full">
              <Link href="/candidate/login">Candidate Entry</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

export default function InterviewerLoginPage() {
  return (
    <Suspense
      fallback={
        <main className="surface-grid flex min-h-screen items-center justify-center">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading interviewer sign-in...
          </div>
        </main>
      }
    >
      <InterviewerLoginContent />
    </Suspense>
  )
}
