'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ArrowLeft, LogIn, Eye, EyeOff } from 'lucide-react'

export default function InterviewerLoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signupSuccess, setSignupSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const ALLOWED_DOMAIN = 'oneorigin.us'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const domain = email.split('@')[1]?.toLowerCase()
    if (domain !== ALLOWED_DOMAIN) {
      setError(`Only @${ALLOWED_DOMAIN} email addresses are allowed.`)
      setLoading(false)
      return
    }

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }
      router.push('/interviewer')
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }
      setSignupSuccess(true)
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[radial-gradient(circle_at_top,#eef6ff_0%,#f7f7fb_35%,#fefefe_100%)] px-6">
      <div className="w-full max-w-md space-y-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-ink-500 hover:text-ink-700 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Home
        </Link>

        <Card className="bg-white/90 shadow-panel">
          <CardHeader className="text-center">
            <LogIn className="h-10 w-10 text-skywash-600 mx-auto" />
            <h1 className="text-xl font-display font-semibold text-ink-900">
              Interviewer {mode === 'login' ? 'Login' : 'Sign Up'}
            </h1>
            <p className="text-sm text-ink-500">
              {mode === 'login'
                ? 'Sign in to manage interview sessions.'
                : 'Create an account to start interviewing.'}
            </p>
          </CardHeader>
          <CardContent>
            {signupSuccess ? (
              <div className="space-y-4 text-center">
                <div className="rounded-2xl bg-skywash-50 border border-skywash-200 px-4 py-3">
                  <p className="text-sm text-skywash-800">
                    Account created. Please check your email to confirm, then log in.
                  </p>
                </div>
                <button
                  onClick={() => { setMode('login'); setSignupSuccess(false) }}
                  className="text-sm text-skywash-600 hover:text-skywash-800 underline"
                >
                  Go to Login
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-ink-600">Email</label>
                  <Input
                    type="email"
                    placeholder="you@oneorigin.us"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-ink-600">Password</label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                {error && (
                  <div className="rounded-2xl border border-signal-200 bg-signal-50 px-4 py-2">
                    <p className="text-xs text-signal-700">{error}</p>
                  </div>
                )}
                <Button size="sm" className="w-full" disabled={loading}>
                  {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
                </Button>
                <p className="text-center text-xs text-ink-500">
                  {mode === 'login' ? (
                    <>
                      Don&apos;t have an account?{' '}
                      <button
                        type="button"
                        onClick={() => { setMode('signup'); setError(null) }}
                        className="text-skywash-600 hover:text-skywash-800 underline"
                      >
                        Sign up
                      </button>
                    </>
                  ) : (
                    <>
                      Already have an account?{' '}
                      <button
                        type="button"
                        onClick={() => { setMode('login'); setError(null) }}
                        className="text-skywash-600 hover:text-skywash-800 underline"
                      >
                        Log in
                      </button>
                    </>
                  )}
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
