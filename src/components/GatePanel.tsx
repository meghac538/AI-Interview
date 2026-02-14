import { AlertTriangle, CheckCircle2, Slash } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

export interface GatePanelProps {
  overall?: number;
  confidence?: number;
  dimensions?: Array<{ label: string; score: number; max?: number }>;
  redFlags?: Array<{ label: string; detail?: string }>;
  followups?: string[];
  onDecision?: (decision: "proceed" | "stop") => void;
  onAction?: (action: "escalate") => void;
  onAddFollowup?: (followup: string) => void;
}

export function GatePanel({
  overall,
  confidence,
  dimensions,
  redFlags,
  followups,
  onDecision,
  onAction,
  onAddFollowup
}: GatePanelProps) {
  const resolved = {
    overall: overall ?? 0,
    confidence: confidence ?? 0,
    dimensions: dimensions ?? [],
    redFlags: redFlags ?? [],
    followups: followups ?? []
  };

  return (
    <Card className="bg-white/90">
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink-900">Gate Panel</h2>
          <Badge tone="sky">Live scoring</Badge>
        </div>
        <div className="flex items-baseline gap-3">
          <div className="text-4xl font-display font-semibold text-ink-900">{resolved.overall}</div>
          <div className="text-sm text-ink-500">Overall score</div>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-ink-500">
            <span>Confidence</span>
            <span>{resolved.confidence.toFixed(2)}</span>
          </div>
          <Progress value={resolved.confidence * 100} />
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="h-px bg-ink-100" />

        <div className="space-y-3">
          {resolved.dimensions.map((dimension) => (
            <div key={dimension.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-ink-600">{dimension.label}</span>
                <span className="font-semibold text-ink-900">{dimension.score}</span>
              </div>
              <Progress value={(dimension.score / (dimension.max || 30)) * 100} />
            </div>
          ))}
        </div>

        <div className="h-px bg-ink-100" />

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-500">Red Flags</p>
          {resolved.redFlags.length === 0 && (
            <div className="rounded-2xl bg-ink-50/60 px-4 py-3 text-xs text-ink-500">
              No red flags detected.
            </div>
          )}
          {resolved.redFlags.map((flag) => (
            <div
              key={flag.label}
              className="rounded-2xl border border-signal-200 bg-signal-100 px-4 py-3 text-sm"
            >
              <div className="flex items-center gap-2 font-semibold text-signal-800">
                <AlertTriangle className="h-4 w-4" />
                {flag.label}
              </div>
              {flag.detail && <p className="mt-1 text-xs text-signal-800">{flag.detail}</p>}
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-500">
            Recommended Follow-ups
          </p>
          <ul className="space-y-2 text-sm text-ink-700">
            {resolved.followups.map((item) => (
              <li key={item} className="rounded-2xl bg-ink-100 px-3 py-2">
                {item}
              </li>
            ))}
            {resolved.followups.length === 0 && (
              <li className="rounded-2xl bg-ink-50 px-3 py-2 text-xs text-ink-500">No follow-ups suggested.</li>
            )}
          </ul>
          {onAddFollowup && (
            <div className="flex items-center gap-2">
              <Input
                className="flex-1"
                placeholder="Add a follow-up question..."
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    const value = (event.currentTarget.value || "").trim();
                    if (!value) return;
                    onAddFollowup(value);
                    event.currentTarget.value = "";
                  }
                }}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={(event) => {
                  const input = (event.currentTarget
                    .previousElementSibling as HTMLInputElement | null);
                  const value = (input?.value || "").trim();
                  if (!value) return;
                  onAddFollowup(value);
                  if (input) input.value = "";
                }}
              >
                Add
              </Button>
            </div>
          )}
        </div>

        <div className="h-px bg-ink-100" />

        <div className="grid grid-cols-3 gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={() => onAction?.("escalate")}>
            Escalate difficulty
          </Button>
          <Button variant="secondary" size="sm" onClick={() => onDecision?.("proceed")}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Proceed
          </Button>
          <Button variant="danger" size="sm" onClick={() => onDecision?.("stop")}>
            <Slash className="mr-2 h-4 w-4" />
            Stop
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
