"use client";

import type { ComponentType } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  Brain,
  ChartNoAxesCombined,
  Play,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import AnimatedProgressBar from "@/components/ui/smoothui/animated-progress-bar";
import { cn } from "@/lib/utils";
import {
  getRoleWidgetTemplate,
  normalizeRoleWidgetConfig,
  type RoleWidgetLane,
} from "@/lib/role-widget-templates";

type FlowLaneUI = RoleWidgetLane & {
  icon: ComponentType<{ className?: string }>;
  accentClass: string;
};

const laneIcons: Array<ComponentType<{ className?: string }>> = [
  Brain,
  ShieldCheck,
  ChartNoAxesCombined,
  Workflow,
];
const laneAccents = [
  "text-primary",
  "text-chart-2",
  "text-chart-1",
  "text-chart-3",
];

function withVisualMetadata(lanes: RoleWidgetLane[]): FlowLaneUI[] {
  return lanes.map((lane, index) => ({
    ...lane,
    icon: laneIcons[index % laneIcons.length],
    accentClass: laneAccents[index % laneAccents.length],
  }));
}

type RunState = {
  laneId: string;
  stepIndex: number;
  progress: number;
  status: "running" | "done";
} | null;

function parseEtaSeconds(value?: string) {
  const trimmed = String(value || "")
    .trim()
    .toLowerCase();
  const match = trimmed.match(/^(\d+)(ms|s|m)$/);
  if (!match) return 0.7;
  const amount = Number(match[1]);
  const unit = match[2];
  if (Number.isNaN(amount) || amount <= 0) return 0.7;
  if (unit === "ms") return amount / 1000;
  if (unit === "m") return amount * 60;
  return amount;
}

function buildAstraFlowPrompt(roleFamily: string, lane: RoleWidgetLane) {
  const steps = lane.steps
    .map((step, index) => `${index + 1}. ${step.label}`)
    .join("\n");

  return [
    `You are Astra, an in-interview sidekick. The candidate must remain the author of final responses.`,
    ``,
    `Role family: ${roleFamily}`,
    `Flow: ${lane.title} (${lane.subtitle})`,
    ``,
    `Execute this flow and return:`,
    `- A concise checklist aligned to the steps`,
    `- Key risks/constraints to verify`,
    `- A short "candidate-owned" suggested outline (not a full final answer)`,
    ``,
    `Steps:`,
    steps,
  ].join("\n");
}

export function RoleFlowHub({
  className,
  lanes,
  roleFamily = "sales",
}: {
  className?: string;
  lanes?: RoleWidgetLane[];
  roleFamily?: string;
}) {
  const [runState, setRunState] = useState<RunState>(null);

  const uiLanes = useMemo(() => {
    const configured = normalizeRoleWidgetConfig(lanes);
    const resolved =
      configured.length > 0 ? configured : getRoleWidgetTemplate(roleFamily);
    return withVisualMetadata(resolved);
  }, [lanes, roleFamily]);

  useEffect(() => {
    if (!runState || runState.status !== "running") return;
    const lane = uiLanes.find((candidate) => candidate.id === runState.laneId);
    if (!lane) return;

    const step = lane.steps[runState.stepIndex];
    const delaySeconds = Math.max(
      0.35,
      Math.min(6, parseEtaSeconds(step?.eta)),
    );

    const timeout = setTimeout(() => {
      setRunState((prev) => {
        if (!prev || prev.status !== "running" || prev.laneId !== lane.id)
          return prev;
        const nextStep = prev.stepIndex + 1;
        if (nextStep >= lane.steps.length) {
          return {
            ...prev,
            stepIndex: lane.steps.length - 1,
            progress: 100,
            status: "done",
          };
        }

        const nextProgress = Math.round(
          (nextStep / Math.max(1, lane.steps.length)) * 100,
        );
        return {
          ...prev,
          stepIndex: nextStep,
          progress: Math.min(98, Math.max(12, nextProgress)),
        };
      });
    }, delaySeconds * 1000);

    return () => clearTimeout(timeout);
  }, [runState, uiLanes]);

  useEffect(() => {
    if (!runState || runState.status !== "done") return;
    const timeout = setTimeout(() => setRunState(null), 1400);
    return () => clearTimeout(timeout);
  }, [runState]);

  const runLane = (lane: FlowLaneUI) => {
    // No auto-running animation loops; run on demand and open Astra with a role-aware prompt.
    setRunState({
      laneId: lane.id,
      stepIndex: 0,
      progress: 12,
      status: "running",
    });

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("astra:prefill", {
          detail: {
            open: true,
            prompt: buildAstraFlowPrompt(roleFamily, lane),
          },
        }),
      );
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {uiLanes.map((lane, laneIndex) => {
        const ActiveIcon = lane.icon;
        const isLaneRunning =
          runState?.laneId === lane.id && runState.status === "running";
        const isLaneDone =
          runState?.laneId === lane.id && runState.status === "done";
        const activeStepIndex =
          runState?.laneId === lane.id ? runState.stepIndex : null;
        const progressValue =
          runState?.laneId === lane.id ? runState.progress : 0;

        return (
          <Card
            key={lane.id}
            className="glass-surface relative overflow-hidden rounded-2xl border-0 bg-transparent shadow-none"
          >
            <div className="glass-glow" aria-hidden="true" />
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <ActiveIcon className={cn("h-4 w-4", lane.accentClass)} />
                    {lane.title}
                  </CardTitle>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {lane.subtitle}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="text-[10px] uppercase tracking-[0.18em]"
                  >
                    Candidate
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => runLane(lane)}
                    className="gap-2"
                    disabled={isLaneRunning}
                  >
                    <Play className="h-4 w-4" />
                    {isLaneRunning
                      ? "Running"
                      : isLaneDone
                        ? "Complete"
                        : "Run"}
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              <AnimatedProgressBar
                value={progressValue}
                color={
                  laneIndex === 1
                    ? "oklch(var(--chart-2))"
                    : laneIndex === 2
                      ? "oklch(var(--chart-1))"
                      : "oklch(var(--chart-3))"
                }
                className="[&_div]:!rounded-md"
              />

              <div className="grid gap-2">
                {lane.steps.map((step, stepIndex) => {
                  const isActive =
                    activeStepIndex === stepIndex && isLaneRunning;
                  const isComplete =
                    isLaneDone ||
                    (runState?.laneId === lane.id &&
                      stepIndex < (activeStepIndex ?? 0));

                  return (
                    <div
                      key={step.id}
                      className={cn(
                        "relative rounded-lg border bg-muted/20 p-2 transition-colors",
                        isActive
                          ? "border-primary/40 bg-primary/5"
                          : "border-border/60",
                        isComplete && !isActive ? "opacity-80" : null,
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs">
                          <span
                            className={cn(
                              "inline-flex h-5 w-5 items-center justify-center rounded-md border text-[10px] font-semibold",
                              isActive
                                ? "border-primary/60 bg-primary/10 text-primary"
                                : isComplete
                                  ? "border-border/60 bg-muted/30 text-foreground"
                                  : "border-border/60 text-muted-foreground",
                            )}
                          >
                            {stepIndex + 1}
                          </span>
                          <span
                            className={cn(
                              "font-medium",
                              isActive
                                ? "text-foreground"
                                : "text-muted-foreground",
                            )}
                          >
                            {step.label}
                          </span>
                        </div>
                        <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                          {step.eta}
                        </span>
                      </div>

                      {isActive ? (
                        <div className="pointer-events-none absolute inset-0 rounded-lg border border-primary/25" />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </CardContent>
            <div className="glass-highlight" aria-hidden="true" />
            <div className="glass-inner-shadow" aria-hidden="true" />
          </Card>
        );
      })}

      <Card className="glass-surface relative border-0 bg-transparent shadow-none">
        <div className="glass-glow" aria-hidden="true" />
        <CardContent className="flex items-center justify-between gap-3 pt-6">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Orchestration
            </p>
            <p className="text-sm font-medium">
              Role widget flows are configured by hiring manager and stream live
              to candidate workspace.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Workflow className="h-4 w-4 text-primary" />
            <Sparkles className="h-4 w-4 text-chart-1" />
            <Bot className="h-4 w-4 text-chart-2" />
          </div>
        </CardContent>
        <div className="glass-highlight" aria-hidden="true" />
        <div className="glass-inner-shadow" aria-hidden="true" />
      </Card>
    </div>
  );
}
