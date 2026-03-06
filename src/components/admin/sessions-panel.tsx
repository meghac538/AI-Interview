"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type SessionListItem = {
  id: string;
  status: string;
  candidate?: { name?: string; email?: string };
  job?: { title?: string; level_band?: string };
  created_at?: string;
};

export function SessionsPanel() {
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSessions = async () => {
      const response = await fetch("/api/interviewer/sessions");
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions || []);
      }
      setLoading(false);
    };
    void loadSessions();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active and Recent Sessions</CardTitle>
        <CardDescription>Newest sessions appear first.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading sessions...
          </div>
        )}

        {!loading && sessions.length === 0 && (
          <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
            No sessions found.
          </div>
        )}

        {sessions.map((session) => {
          const statusVariant =
            session.status === "live"
              ? "default"
              : session.status === "completed"
                ? "secondary"
                : "outline";

          return (
            <Link
              key={session.id}
              href={`/interviewer/${session.id}`}
              className="flex items-center justify-between rounded-lg border p-4 transition hover:bg-muted/30"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">
                    {session.candidate?.name || "Candidate"} |{" "}
                    {session.job?.title || "Role"}
                  </p>
                  <Badge variant={statusVariant} className="capitalize">
                    {session.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {session.candidate?.email || "No email"} | Level{" "}
                  {session.job?.level_band || "n/a"}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
