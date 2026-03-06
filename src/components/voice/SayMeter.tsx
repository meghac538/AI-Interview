"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface SayMeterProps {
  score: number;
  factors: {
    rapport: number;
    discovery: number;
    objection_handling: number;
    value_articulation: number;
    closing_momentum: number;
  };
  summary?: string;
  loading?: boolean;
}

export function SayMeter({ score, factors, summary, loading }: SayMeterProps) {
  const getScoreColor = (score: number): string => {
    if (score >= 81) return "text-emerald-500";
    if (score >= 61) return "text-yellow-500";
    if (score >= 41) return "text-amber-500";
    return "text-destructive";
  };

  const getScoreBgColor = (score: number): string => {
    if (score >= 81) return "bg-emerald-500/10";
    if (score >= 61) return "bg-yellow-500/10";
    if (score >= 41) return "bg-amber-500/10";
    return "bg-destructive/10";
  };

  const getScoreLabel = (score: number): string => {
    if (score >= 81) return "Excellent";
    if (score >= 61) return "Good";
    if (score >= 41) return "Getting There";
    return "Needs Improvement";
  };

  const factorLabels: Record<keyof typeof factors, string> = {
    rapport: "Rapport",
    discovery: "Discovery",
    objection_handling: "Objection Handling",
    value_articulation: "Value Articulation",
    closing_momentum: "Closing Momentum",
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Say Meter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="flex justify-center mb-6">
              <div className="w-32 h-32 rounded-full bg-muted" />
            </div>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-8 rounded bg-muted" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!score && score !== 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Say Meter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            <p className="text-sm font-medium">No Say Meter data yet</p>
            <p className="text-xs mt-2">Scores will appear after 10 messages</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Say Meter</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Circular Score Gauge */}
        <div className="flex justify-center">
          <div
            className={`relative w-32 h-32 rounded-full ${getScoreBgColor(score)} flex items-center justify-center`}
          >
            <div className="text-center">
              <div className={`text-4xl font-bold ${getScoreColor(score)}`}>
                {score}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {getScoreLabel(score)}
              </div>
            </div>
          </div>
        </div>

        {/* Factor Breakdown */}
        <div className="space-y-3">
          {(Object.keys(factors) as Array<keyof typeof factors>).map((key) => (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{factorLabels[key]}</span>
                <span
                  className={`font-semibold ${getScoreColor(factors[key])}`}
                >
                  {factors[key]}
                </span>
              </div>
              <Progress value={factors[key]} />
            </div>
          ))}
        </div>

        {/* Summary */}
        {summary && (
          <div className="border-t pt-4">
            <p className="text-sm text-muted-foreground italic">{summary}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
