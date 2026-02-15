import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Shield } from 'lucide-react'

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[radial-gradient(circle_at_top,#eef6ff_0%,#f7f7fb_35%,#fefefe_100%)] px-6">
      <div className="w-full max-w-md space-y-10 text-center">
        <header className="space-y-3">
          <div className="flex items-center justify-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-skywash-600 shadow-aura" />
            <span className="text-sm font-semibold uppercase tracking-[0.2em] text-ink-500">
              Interview Platform
            </span>
          </div>
          <h1 className="font-display text-3xl text-ink-900">Welcome</h1>
          <p className="text-sm text-ink-500">Sign in to manage interview sessions.</p>
        </header>

        <Link href="/interviewer/login" className="group block">
          <Card className="bg-white/90 shadow-panel transition hover:border-skywash-300 hover:shadow-lg">
            <CardContent className="flex flex-col items-center gap-4 py-10">
              <Shield className="h-10 w-10 text-skywash-600 transition group-hover:scale-110" />
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-ink-900">
                  Interviewer Login
                </h2>
                <p className="text-xs text-ink-500">
                  Create sessions, send candidate access links, and score interviews.
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <p className="text-xs text-ink-400">
          Candidates receive access via a magic link sent by their interviewer.
        </p>
      </div>
    </main>
  )
}
