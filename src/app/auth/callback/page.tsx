'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { supabase } from '@/lib/supabase/client'

function CallbackHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/candidate/login'
  const [status, setStatus] = useState('Authenticating...')

  useEffect(() => {
    const handleAuth = async () => {
      // 1. Check for hash fragment (implicit flow from generateLink/inviteUserByEmail)
      const hash = window.location.hash
      if (hash) {
        const params = new URLSearchParams(hash.substring(1))
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (!error) {
            router.push(next)
            return
          }
          console.error('setSession error:', error)
        }
      }

      // 2. Check for code query param (PKCE flow)
      const code = searchParams.get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
          router.push(next)
          return
        }
        console.error('exchangeCode error:', error)
      }

      // 3. Auth failed
      setStatus('Authentication failed. Redirecting...')
      router.push('/candidate/login?error=auth_failed')
    }

    handleAuth()
  }, [next, router, searchParams])

  return (
    <main className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top,#eef6ff_0%,#f7f7fb_35%,#fefefe_100%)]">
      <p className="text-sm text-ink-500">{status}</p>
    </main>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center">
          <p className="text-sm text-ink-500">Loading...</p>
        </main>
      }
    >
      <CallbackHandler />
    </Suspense>
  )
}
