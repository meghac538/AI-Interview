'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Slash, ShieldAlert, TrendingUp, Loader2, Sparkles, Zap } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"

export interface RedFlagEntry {
  label: string;
  detail?: string;
  source?: string;
  severity?: 'critical' | 'warning';
  auto_stop?: boolean;
  created_at?: string;
}

export interface GatePanelProps {
  overall?: number
  confidence?: number
  dimensions?: Array<{ label: string; score: number; max?: number }>
  redFlags?: RedFlagEntry[]
  truthLog?: Array<{ dimension: string; quote: string; line?: number }>
  followups?: string[]
  onDecision?: (decision: "proceed" | "caution" | "stop") => void
  onAction?: (action: "escalate") => void
  onAddFollowup?: (followup: string) => void
  loading?: boolean
  // New: Expected dimensions from round rubric (for showing structure even when unscored)
  expectedDimensions?: Array<{ name: string; description: string; maxScore: number }>
  currentRoundNumber?: number
}

export function GatePanel({
  overall,
  confidence,
  dimensions,
  redFlags,
  truthLog,
  followups,
  onDecision,
  onAction,
  onAddFollowup,
  loading,
  expectedDimensions,
  currentRoundNumber
}: GatePanelProps) {
  // Merge expected dimensions with actual scores
  const mergedDimensions = (() => {
    if (!expectedDimensions || expectedDimensions.length === 0) {
      return dimensions ?? []
    }

    // Create a map of scored dimensions
    const scoredMap = new Map(
      (dimensions ?? []).map(d => [d.label.toLowerCase().replace(/\s+/g, '_'), d])
    )

    // Merge expected with scored
    return expectedDimensions.map(expected => {
      const scored = scoredMap.get(expected.name)
      return {
        label: expected.name,
        score: scored?.score ?? 0,
        max: expected.maxScore,
        description: expected.description,
        status: scored ? 'scored' : 'pending'
      }
    })
  })()

  const resolved = {
    overall: overall ?? 0,
    confidence: confidence ?? 0,
    dimensions: mergedDimensions,
    redFlags: redFlags ?? [],
    truthLog: truthLog ?? [],
    followups: followups ?? []
  }

  const [summary, setSummary] = useState<string | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)

  const hasScoreData =
    resolved.overall > 0 ||
    resolved.dimensions.some((d) => (d.score ?? 0) > 0) ||
    resolved.redFlags.length > 0 ||
    resolved.truthLog.length > 0

  const fetchSummary = async () => {
    setSummaryLoading(true)
    setSummaryError(null)
    try {
      const res = await fetch('/api/ai/interview-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          overall: resolved.overall,
          confidence: resolved.confidence,
          dimensions: resolved.dimensions,
          redFlags: resolved.redFlags,
          truthLog: resolved.truthLog,
          followups: resolved.followups
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to generate summary')
      setSummary(data.summary || '')
    } catch (err: any) {
      setSummaryError(err?.message || 'Failed to generate summary')
      setSummary(null)
    } finally {
      setSummaryLoading(false)
    }
  }

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Gate Panel
            </CardTitle>
            <CardDescription>Live scoring, risks, and interviewer controls.</CardDescription>
          </div>
          <Badge variant="secondary">0-100</Badge>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border p-3">
            <p className="text-xs text-muted-foreground">Overall score</p>
            <p className="mt-1 text-3xl font-semibold">{resolved.overall}</p>
          </div>
          <div className="rounded-xl border p-3">
            <p className="text-xs text-muted-foreground">Confidence</p>
            <p className="mt-1 text-3xl font-semibold">{Math.round(resolved.confidence * 100)}%</p>
          </div>
        </div>

        <Progress value={Math.max(0, Math.min(100, resolved.overall))} />
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              AI Summary
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasScoreData || summaryLoading}
              onClick={fetchSummary}
            >
              {summaryLoading ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Generating…
                </>
              ) : (
                'Generate summary'
              )}
            </Button>
          </div>
          {summaryError && (
            <p className="text-sm text-destructive">{summaryError}</p>
          )}
          {summary ? (
            <p className="text-sm leading-relaxed text-muted-foreground">{summary}</p>
          ) : !hasScoreData ? (
            <p className="text-sm text-muted-foreground">
              Complete rounds and trigger scoring to generate an AI summary of how the interview is going.
            </p>
          ) : null}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Dimension Scores</p>
            {currentRoundNumber && (
              <Badge variant="outline" className="text-[10px]">Round {currentRoundNumber}</Badge>
            )}
          </div>
          {resolved.dimensions.length === 0 && (
            <p className="text-sm text-muted-foreground">No scores yet.</p>
          )}
          {resolved.dimensions.map((dimension: any) => {
            const max = Number(dimension.max || 30)
            const value = Number(dimension.score || 0)
            const isPending = dimension.status === 'pending'
            const percentage = (value / max) * 100
            const isAdaptability = dimension.label === 'adaptability'

            return (
              <div
                key={dimension.label}
                className={`space-y-1.5 ${isAdaptability ? 'rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 -mx-1' : ''}`}
              >
                <div className="flex items-center justify-between text-sm gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {isAdaptability && <Zap className="h-3 w-3 text-amber-500 shrink-0" />}
                    <span className="truncate" title={dimension.description}>
                      {dimension.label.replace(/_/g, " ")}
                    </span>
                    {isAdaptability && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-amber-500/50 text-amber-600">
                        Curveball
                      </Badge>
                    )}
                    {isPending && (
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                        Pending
                      </Badge>
                    )}
                  </div>
                  <span className={`font-medium tabular-nums ${isPending ? 'text-muted-foreground' : ''}`}>
                    {value}/{max}
                  </span>
                </div>
                <Progress
                  value={percentage}
                  className={isPending ? 'opacity-30' : ''}
                />
                {dimension.description && !isPending && value > 0 && (
                  <p className="text-[10px] text-muted-foreground line-clamp-2">
                    {dimension.description}
                  </p>
                )}
              </div>
            )
          })}
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Red Flags</p>
            {resolved.redFlags.length > 0 && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                resolved.redFlags.some(f => f.severity === 'critical')
                  ? 'bg-destructive/20 text-destructive'
                  : 'bg-amber-200 text-amber-800'
              }`}>
                {resolved.redFlags.length}
              </span>
            )}
          </div>
          {resolved.redFlags.length === 0 && (
            <div className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 p-3 text-sm">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                No critical flags detected
              </div>
            </div>
          )}
          <div className="max-h-[280px] space-y-3 overflow-y-auto pr-1">
            {resolved.redFlags.map((flag, index) => {
              const isCritical = flag.severity === 'critical'
              return (
                <div
                  key={`${flag.label}-${index}`}
                  className={`rounded-lg border p-3 text-sm ${
                    isCritical
                      ? 'border-destructive/50 bg-destructive/10 animate-pulse'
                      : 'border-destructive/30 bg-destructive/10'
                  }`}
                >
                  <div className="flex items-center gap-2 font-medium text-destructive">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {flag.label}
                    {flag.auto_stop && (
                      <span className="ml-auto rounded-full bg-destructive/20 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                        AUTO-STOP
                      </span>
                    )}
                  </div>
                  {flag.detail && (
                    <p className="mt-1 text-xs text-muted-foreground">{flag.detail}</p>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    {flag.source && (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        flag.source === 'interviewer'
                          ? 'bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {flag.source === 'interviewer' ? 'Interviewer' : 'System'}
                      </span>
                    )}
                    {flag.created_at && (
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(flag.created_at).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            TruthLog Evidence
          </p>
          {resolved.truthLog.length === 0 && (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
              Evidence quotes will appear after scoring.
            </div>
          )}
          {resolved.truthLog.map((entry, index) => (
            <div
              key={`${entry.dimension}-${index}`}
              className="rounded-lg border bg-muted/20 px-4 py-3 text-sm"
            >
              <div className="text-xs font-semibold text-muted-foreground">{entry.dimension}</div>
              <p className="mt-2">&ldquo;{entry.quote}&rdquo;</p>
              {('line' in entry && entry.line != null) && (
                <p className="mt-1 text-xs text-muted-foreground">Line {entry.line}</p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
