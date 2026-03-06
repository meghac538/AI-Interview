"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Info } from "lucide-react";

interface AIAssessment {
  id: string;
  session_id: string;
  round_number: number;
  timestamp: string;
  observation: string;
  dimension: string;
  severity: "info" | "concern" | "red_flag";
  created_at: string;
}

export function AIAssessmentsPanel({ sessionId }: { sessionId: string }) {
  const [assessments, setAssessments] = useState<AIAssessment[]>([]);
  const [loading, setLoading] = useState(true);

  // Load existing assessments
  useEffect(() => {
    async function loadAssessments() {
      const { data } = await supabase
        .from("ai_assessments")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false });

      if (data) {
        setAssessments(data as AIAssessment[]);
      }
      setLoading(false);
    }

    loadAssessments();
  }, [sessionId]);

  // Subscribe to new assessments
  useEffect(() => {
    const channel = supabase
      .channel(`ai-assessments-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ai_assessments",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const newAssessment = payload.new as AIAssessment;
          setAssessments((prev) => [newAssessment, ...prev]);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  const getSeverityConfig = (severity: string) => {
    switch (severity) {
      case "red_flag":
        return {
          icon: AlertCircle,
          color: "text-destructive",
          bg: "bg-destructive/10",
          border: "border-destructive/20",
        };
      case "concern":
        return {
          icon: Info,
          color: "text-amber-600 dark:text-amber-400",
          bg: "bg-amber-50 dark:bg-amber-950/30",
          border: "border-amber-200 dark:border-amber-800",
        };
      default: // info
        return {
          icon: CheckCircle,
          color: "text-emerald-600 dark:text-emerald-400",
          bg: "bg-emerald-50 dark:bg-emerald-950/30",
          border: "border-emerald-200 dark:border-emerald-800",
        };
    }
  };

  const groupedAssessments = assessments.reduce(
    (acc, assessment) => {
      const dimension = assessment.dimension;
      if (!acc[dimension]) acc[dimension] = [];
      acc[dimension].push(assessment);
      return acc;
    },
    {} as Record<string, AIAssessment[]>,
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">AI Observations</CardTitle>
          <Badge variant="secondary">Live</Badge>
        </div>
        <CardDescription>Real-time performance analysis</CardDescription>
      </CardHeader>
      <CardContent className="max-h-96 space-y-3 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            Loading assessments...
          </div>
        )}

        {!loading && assessments.length === 0 && (
          <div className="rounded-lg bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
            AI observations will appear here during the call
          </div>
        )}

        {Object.entries(groupedAssessments).map(([dimension, items]) => (
          <div key={dimension} className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {dimension.replace(/_/g, " ")}
            </h4>
            {items.slice(0, 3).map((assessment) => {
              const config = getSeverityConfig(assessment.severity);
              const Icon = config.icon;

              return (
                <div
                  key={assessment.id}
                  className={`flex gap-3 rounded-lg border ${config.border} ${config.bg} px-3 py-2`}
                >
                  <Icon
                    className={`mt-0.5 h-4 w-4 flex-shrink-0 ${config.color}`}
                  />
                  <div className="flex-1">
                    <p className="text-sm">{assessment.observation}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(assessment.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {/* Summary Stats */}
        {assessments.length > 0 && (
          <div className="mt-4 flex gap-2 border-t pt-3">
            <Badge variant="secondary">
              {assessments.filter((a) => a.severity === "info").length} Positive
            </Badge>
            <Badge variant="outline">
              {assessments.filter((a) => a.severity === "concern").length}{" "}
              Concerns
            </Badge>
            <Badge variant="destructive">
              {assessments.filter((a) => a.severity === "red_flag").length} Red
              Flags
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
