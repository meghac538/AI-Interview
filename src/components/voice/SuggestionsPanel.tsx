"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Suggestion } from "./types";

interface SuggestionsPanelProps {
  suggestions: Suggestion[];
  loading?: boolean;
  onDismiss: (id: string) => Promise<void>;
  onApply?: (suggestion: Suggestion) => void;
}

export function SuggestionsPanel({
  suggestions,
  loading,
  onDismiss,
  onApply,
}: SuggestionsPanelProps) {
  const [dismissing, setDismissing] = useState<string | null>(null);

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case "critical":
        return "bg-destructive";
      case "high":
        return "bg-amber-500";
      case "medium":
        return "bg-yellow-500";
      case "low":
        return "bg-muted-foreground";
      default:
        return "bg-muted-foreground";
    }
  };

  const getCategoryBadge = (
    category: string,
  ): {
    label: string;
    variant: "default" | "secondary" | "outline" | "destructive";
  } => {
    switch (category) {
      case "context_injection":
        return { label: "Context", variant: "default" };
      case "curveball":
        return { label: "Curveball", variant: "destructive" };
      case "followup_question":
        return { label: "Follow-up", variant: "secondary" };
      default:
        return { label: category, variant: "outline" };
    }
  };

  const handleDismiss = async (id: string) => {
    setDismissing(id);
    try {
      await onDismiss(id);
    } catch (error) {
      console.error("Failed to dismiss suggestion:", error);
    } finally {
      setDismissing(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI Suggestions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 animate-pulse">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 rounded bg-muted" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!suggestions || suggestions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI Suggestions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            <p className="text-sm font-medium">No suggestions yet</p>
            <p className="text-xs mt-2">
              AI will provide coaching tips as the conversation progresses
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">AI Suggestions</CardTitle>
          <span className="text-xs text-muted-foreground">
            {suggestions.length} active
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {suggestions.map((suggestion) => {
          const categoryBadge = getCategoryBadge(suggestion.category);
          const isBeingDismissed = dismissing === suggestion.id;

          return (
            <div
              key={suggestion.id}
              className="rounded-lg border p-4 hover:border-primary/30 transition-colors"
            >
              {/* Header */}
              <div className="flex items-start gap-3 mb-2">
                <div
                  className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${getPriorityColor(suggestion.priority)}`}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge
                      variant={categoryBadge.variant}
                      className="text-[10px]"
                    >
                      {categoryBadge.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground capitalize">
                      {suggestion.priority} priority
                    </span>
                  </div>
                  <p className="text-sm">{suggestion.text}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-3">
                {onApply && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onApply(suggestion)}
                  >
                    Apply
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDismiss(suggestion.id)}
                  disabled={isBeingDismissed}
                >
                  {isBeingDismissed ? "Dismissing..." : "Dismiss"}
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
