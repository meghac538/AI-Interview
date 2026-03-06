"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { KeyRound, Loader2, Sparkles } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { GlowyWavesHero } from "@/components/uitripled/glowy-waves-hero"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabase/client"

function CandidateLoginContent() {
  const router = useRouter()
  const params = useSearchParams()
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [resolvingLink, setResolvingLink] = useState(false)
  const [info, setInfo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [heroStats, setHeroStats] = useState<Array<{ label: string; value: string }>>([])

  const logMagicLinkOpen = async (sessionId: string, sourceEmail?: string) => {
    try {
      await fetch("/api/candidate/magic-link/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          email: sourceEmail || null
        })
      })
    } catch (logError) {
      console.warn("Unable to log magic-link open event:", logError)
    }
  }

  useEffect(() => {
    let cancelled = false

    const resolveEntry = async () => {
      const sessionId = params.get("session") || params.get("session_id")
      const hash = typeof window !== "undefined" ? window.location.hash : ""
      const hashParams = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash)
      const accessToken = hashParams.get("access_token")
      const refreshToken = hashParams.get("refresh_token")

      if (sessionId) {
        // Load real session context for the hero stats (avoid hard-coded numbers on the login screen).
        // Fire-and-forget; do not block magic-link verification/redirect.
        void (async () => {
          try {
            const response = await fetch(`/api/session/${sessionId}`)
            if (!response.ok) return
            const data = await response.json()
            const rounds = Array.isArray(data?.rounds) ? data.rounds : []
            const roundCount = rounds.length
            const totalMinutes = rounds.reduce((acc: number, round: any) => {
              const value = Number(round?.duration_minutes || 0)
              return acc + (Number.isFinite(value) ? value : 0)
            }, 0)

            if (!cancelled) {
              setHeroStats([
                { label: "Rounds", value: String(roundCount).padStart(2, "0") },
                { label: "Total time", value: totalMinutes ? `${totalMinutes}m` : "--" },
                { label: "AI Sidekick", value: "ON" }
              ])
            }
          } catch {
            // Non-blocking; the login flow must remain fast even if stats can't load.
          }
        })()
      }

      if (sessionId && !accessToken) {
        const { data: existingSession } = await supabase.auth.getSession()
        if (existingSession.session) {
          void logMagicLinkOpen(sessionId)
          router.replace(`/candidate/${sessionId}`)
        } else {
          setInfo("Waiting for secure one-time sign-in link. Please open the link sent by your hiring manager.")
        }
        return
      }

      if (!accessToken || !refreshToken) return

      setResolvingLink(true)
      setError(null)
      setInfo("Verifying your one-time candidate link...")

      try {
        const { error: setSessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        })

        if (setSessionError) throw setSessionError

        if (typeof window !== "undefined") {
          window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`)
        }

        if (sessionId) {
          void logMagicLinkOpen(sessionId)
          router.replace(`/candidate/${sessionId}`)
          return
        }

        const { data: userData, error: userError } = await supabase.auth.getUser()
        if (userError) throw userError

        const authEmail = userData.user?.email
        if (!authEmail) {
          throw new Error("Candidate email could not be resolved from the magic link.")
        }

        const response = await fetch("/api/candidate/access", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: authEmail })
        })

        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || "Unable to locate your active session.")
        }

        if (data.session_id) {
          void logMagicLinkOpen(data.session_id, authEmail)
        }

        router.replace(data.redirect_url)
      } catch (err: any) {
        if (cancelled) return
        setError(err?.message || "Unable to verify your candidate link.")
      } finally {
        if (!cancelled) {
          setResolvingLink(false)
          setInfo(null)
        }
      }
    }

    void resolveEntry()

    return () => {
      cancelled = true
    }
  }, [params, router])

  const handleAccess = async () => {
    if (!email.trim() || loading || resolvingLink) return
    setLoading(true)
    setError(null)
    setInfo(null)
    try {
      const response = await fetch("/api/candidate/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Unable to locate your session")
      }

      const sessionId = data?.session_id
      if (!sessionId) {
        throw new Error("No active session found for this email.")
      }

      const redirectTo = `${window.location.origin}/candidate/login?session=${sessionId}`
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { emailRedirectTo: redirectTo }
      })

      if (otpError) throw otpError
      setInfo("Magic link sent. Open it to enter your live assessment session.")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative min-h-screen">
      <div className="absolute right-6 top-6 z-20">
        <ThemeToggle />
      </div>

      <GlowyWavesHero
        badgeText="Experience the reborn"
        titlePrefix="2025 Lit the Fuse."
        titleHighlight="You're the Next Chapter."
        description={
          "OneOrigin didn't \"adopt AI.\" We rebuilt the company around it - workflows, decisions, delivery, and velocity. This isn't a slow-and-steady corporate tour. It's an AI-native, execution-first arena where sharp thinking shows up fast and impact compounds. When your live assessment starts, your hiring manager will trigger a secure, one-time sign-in link - instant access to a thrilling AI session. Tune into your best frequency!"
        }
        pills={["Google Meet trigger", "One-time sign-in link", "Astra sidekick on"]}
        stats={heroStats}
        actions={
          <Card className="w-full max-w-xl border-2 border-primary/25 bg-card/90 shadow-2xl shadow-primary/15 backdrop-blur">
              <CardHeader className="space-y-3 p-7 md:p-8">
                <CardTitle className="text-2xl leading-[1.18] tracking-tight md:text-[1.75rem]">Join Your Live Assessment</CardTitle>
                <CardDescription className="text-[15px] leading-7">
                  Enter the email from your interview invite. You will be redirected into your active round.
                </CardDescription>
              </CardHeader>

            <CardContent className="space-y-6 p-7 pt-0 md:p-8 md:pt-0">
              <div className="space-y-3 text-left">
                <Label htmlFor="email" className="text-sm font-medium tracking-[0.01em]">Candidate email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@company.com"
                  autoComplete="email"
                  className="h-12 text-[15px]"
                />
              </div>

              <div className="space-y-3">
                <Button
                  type="button"
                  onClick={handleAccess}
                  disabled={loading || resolvingLink || !email.trim()}
                  className="h-12 w-full rounded-xl bg-primary px-6 text-base font-semibold tracking-[0.02em] text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  {loading || resolvingLink ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enter Live Session
                    </span>
                  ) : (
                    "Enter Live Session"
                  )}
                </Button>
                <button
                  type="button"
                  onClick={handleAccess}
                  disabled={loading || resolvingLink || !email.trim()}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border px-4 text-sm tracking-[0.01em] text-muted-foreground transition hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading || resolvingLink ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                  Secure fallback entry
                </button>
              </div>

              {info && (
                <Alert>
                  <AlertTitle>Magic link validation</AlertTitle>
                  <AlertDescription>{info}</AlertDescription>
                </Alert>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertTitle>Access failed</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="rounded-lg border bg-muted/25 p-4 text-left text-xs leading-6 text-muted-foreground">
                <p className="font-semibold tracking-[0.02em] text-foreground">Live entry workflow</p>
                <p className="mt-1">Hiring manager greets on Google Meet, clicks Send Link, issues a secure one-time sign-in link, candidate enters center canvas.</p>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Sparkles className="h-4 w-4 text-primary" />
                AI sidekick activity, prompts, and tool traces are logged for interviewer review.
              </div>
            </CardContent>
          </Card>
        }
      />
    </main>
  )
}

export default function CandidateLoginPage() {
  return (
    <Suspense
      fallback={
        <main className="surface-grid flex min-h-screen items-center justify-center">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading candidate entry...
          </div>
        </main>
      }
    >
      <CandidateLoginContent />
    </Suspense>
  )
}
