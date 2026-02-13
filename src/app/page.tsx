import Link from "next/link";
import { ArrowRight, Shield, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const highlights = [
  {
    title: "Candidate Experience",
    description:
      "Step-by-step workflow with task timers, dynamic inputs, and AI assistant guidance.",
    icon: Sparkles
  },
  {
    title: "Gate Panel",
    description:
      "Real-time scoring, red flags, and control levers for interviewer intervention.",
    icon: Shield
  }
];

export default function HomePage() {
  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <header className="flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-skywash-600 shadow-aura" />
            <span className="text-sm font-semibold uppercase tracking-[0.2em] text-ink-500">
              Interview Platform
            </span>
          </div>
          <div className="max-w-2xl space-y-5">
            <h1 className="font-display text-4xl text-ink-900 md:text-5xl">
              Governed by AI scoring and human control.
            </h1>
            <p className="text-base text-ink-600 md:text-lg">
              Built for deterministic, auditable interviews with agent-based rounds and live gate decisions.
              Candidates progress through structured tasks while interviewers monitor evidence-backed scores.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/test">
              <Button size="lg">
                Create Test Session
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/interviewer">
              <Button size="lg" variant="outline">
                View Active Sessions
              </Button>
            </Link>
          </div>
        </header>

        <section className="grid gap-6 md:grid-cols-2">
          {highlights.map((item) => (
            <Card key={item.title} className="animate-rise-in">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <item.icon className="h-6 w-6 text-skywash-700" />
                  <h2 className="text-xl font-semibold text-ink-900">{item.title}</h2>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-ink-600">{item.description}</p>
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    </main>
  );
}
