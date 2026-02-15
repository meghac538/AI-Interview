'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { ArrowLeft, Mail, AlertCircle, Clock } from 'lucide-react'

const errorMessages: Record<string, { title: string; message: string }> = {
  session_expired: {
    title: 'Session Expired',
    message:
      'Your 2-hour interview window has ended. Please contact the interviewer if you need more time.',
  },
  auth_failed: {
    title: 'Authentication Failed',
    message:
      'The login link may have expired. Please ask the interviewer to send a new one.',
  },
  wrong_session: {
    title: 'Access Denied',
    message: 'You do not have access to this interview session.',
  },
}

function LoginContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const errorInfo = error ? errorMessages[error] : null

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
      <Card className="w-full max-w-md bg-white/90 shadow-panel">
        <CardHeader className="text-center">
          {errorInfo ? (
            <>
              {error === 'session_expired' ? (
                <Clock className="h-10 w-10 text-signal-500 mx-auto" />
              ) : (
                <AlertCircle className="h-10 w-10 text-signal-500 mx-auto" />
              )}
              <h1 className="text-xl font-display font-semibold text-ink-900">
                {errorInfo.title}
              </h1>
            </>
          ) : (
            <>
              <Mail className="h-10 w-10 text-skywash-600 mx-auto" />
              <h1 className="text-xl font-display font-semibold text-ink-900">
                Interview Access
              </h1>
            </>
          )}
        </CardHeader>
        <CardContent>
          {errorInfo ? (
            <div className="rounded-2xl border border-signal-200 bg-signal-50 px-4 py-3">
              <p className="text-sm text-signal-800">{errorInfo.message}</p>
            </div>
          ) : (
            <div className="space-y-3 text-center">
              <p className="text-sm text-ink-600">
                Check your email for the interview access link sent by your
                interviewer.
              </p>
              <p className="text-xs text-ink-400">
                The link will give you 2 hours of access to complete your
                interview.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </main>
  )
}

export default function CandidateLoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center">
          <p className="text-sm text-ink-500">Loading...</p>
        </main>
      }
    >
      <LoginContent />
    </Suspense>
  )
}
