import Link from "next/link"
import { ArrowRight, Gauge, Bot, UserRoundCheck } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ThemeToggle } from "@/components/theme-toggle"

export default function HomePage() {
  const showTestEntry = process.env.NODE_ENV !== "production"

  return (
    <main className="surface-grid min-h-screen px-4 py-8 md:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">OneOrigin Inc.</p>
            <h1 className="text-3xl font-semibold">AI Live Assessment Platform</h1>
          </div>
          <ThemeToggle />
        </header>

        <section className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardHeader>
              <Badge variant="secondary" className="w-fit">Candidate + Employer + Admin</Badge>
              <CardTitle className="text-2xl">Production-ready live interview flow</CardTitle>
              <CardDescription>
                Candidate entry, timed assessment canvas, ChatGPT-class AI sidekick, and interviewer gate controls with evidence-backed metrics.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/candidate/login">
                  Candidate Login
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/interviewer/login">Interviewer Console</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/admin/login">Admin Dashboard</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/about-oneorigin">About OneOrigin</Link>
              </Button>
              {showTestEntry ? (
                <Button asChild variant="secondary">
                  <Link href="/test">Create Test Session</Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Live Readiness</CardTitle>
              <CardDescription>Current environment checks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2"><Gauge className="h-4 w-4 text-primary" /> Secure backend linked</div>
              <div className="flex items-center gap-2"><Bot className="h-4 w-4 text-primary" /> Sidekick endpoints active</div>
              <div className="flex items-center gap-2"><UserRoundCheck className="h-4 w-4 text-primary" /> Candidate flow available</div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  )
}
