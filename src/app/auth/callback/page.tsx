"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase/client"
import { resolveCurrentUserRole } from "@/lib/supabase/client-role"
import { isAdminRole, isInterviewerRole } from "@/lib/auth/roles"

function sanitizeNextPath(raw: string | null): string {
  if (!raw) return "/"
  if (!raw.startsWith("/")) return "/"
  return raw
}

function AuthCallbackContent() {
  const router = useRouter()
  const params = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  const nextPath = useMemo(() => sanitizeNextPath(params.get("next")), [params])

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        const code = params.get("code")
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          if (exchangeError) {
            throw exchangeError
          }
        } else if (typeof window !== "undefined" && window.location.hash.includes("access_token")) {
          const hashParams = new URLSearchParams(window.location.hash.slice(1))
          const accessToken = hashParams.get("access_token")
          const refreshToken = hashParams.get("refresh_token")

          if (accessToken && refreshToken) {
            const { error: setSessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            })
            if (setSessionError) throw setSessionError
          }
        }

        const { role } = await resolveCurrentUserRole()

        if (nextPath.startsWith("/admin") && !isAdminRole(role)) {
          router.replace(`/admin/login?denied=1&next=${encodeURIComponent(nextPath)}`)
          return
        }

        if (nextPath.startsWith("/interviewer") && !isInterviewerRole(role)) {
          router.replace(`/interviewer/login?denied=1&next=${encodeURIComponent(nextPath)}`)
          return
        }

        if (!cancelled) {
          router.replace(nextPath)
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Unable to complete sign-in.")
        }
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [nextPath, params, router])

  return (
    <main className="surface-grid flex min-h-screen items-center justify-center px-4">
      <div className="rounded-xl border bg-background/80 px-6 py-5 text-center">
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Completing secure sign-in...
        </div>
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      </div>
    </main>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="surface-grid flex min-h-screen items-center justify-center px-4">
          <div className="rounded-xl border bg-background/80 px-6 py-5 text-center">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Completing secure sign-in...
            </div>
          </div>
        </main>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  )
}
