'use client'

import { AlertTriangle, CheckCircle2, Slash, ShieldAlert, TrendingUp, Loader2 } from "lucide-react"
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
  loading
}: GatePanelProps) {
  const resolved = {
    overall: overall ?? 0,
    confidence: confidence ?? 0,
    dimensions: dimensions ?? [],
    redFlags: redFlags ?? [],
    truthLog: truthLog ?? [],
    followups: followups ?? []
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
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Dimension Scores</p>
          {resolved.dimensions.length === 0 && (
            <p className="text-sm text-muted-foreground">No scores yet.</p>
          )}
          {resolved.dimensions.map((dimension) => {
            const max = Number(dimension.max || 30)
            const value = Number(dimension.score || 0)
            return (
              <div key={dimension.label} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>{dimension.label.replace(/_/g, " ")}</span>
                  <span className="font-medium">{value}</span>
                </div>
                <Progress value={(value / max) * 100} />
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
              {entry.line !== undefined && entry.line !== null && (
                <p className="mt-1 text-xs text-muted-foreground">Line {entry.line}</p>
              )}
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Recommended Follow-ups</p>
          <div className="space-y-2">
            {resolved.followups.length === 0 && (
              <div className="rounded-lg border bg-muted/60 p-3 text-sm text-muted-foreground">
                No follow-up suggestions yet.
              </div>
            )}
            {resolved.followups.map((followup) => (
              <div key={followup} className="rounded-lg border bg-muted/40 p-3 text-sm">
                {followup}
              </div>
            ))}
          </div>

          {onAddFollowup && (
            <div className="flex items-center gap-2">
              <Input
                placeholder="Add manual follow-up..."
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return
                  const value = event.currentTarget.value.trim()
                  if (!value) return
                  onAddFollowup(value)
                  event.currentTarget.value = ""
                }}
              />
              <Button
                variant="outline"
                onClick={(event) => {
                  const input = event.currentTarget.previousElementSibling as HTMLInputElement | null
                  const value = input?.value?.trim()
                  if (!value) return
                  onAddFollowup(value)
                  if (input) input.value = ""
                }}
              >
                Add
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Button variant="outline" onClick={() => onAction?.("escalate")} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
            Escalate
          </Button>
          <Button variant="secondary" onClick={() => onDecision?.("caution")} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
            Caution
          </Button>
          <Button variant="default" onClick={() => onDecision?.("proceed")} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Proceed
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-2">
          <Button variant="destructive" onClick={() => onDecision?.("stop")} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Slash className="h-4 w-4" />}
            Stop
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
