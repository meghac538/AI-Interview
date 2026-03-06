"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bot,
  Plus,
  ShieldCheck,
  Activity,
  Eye,
  EyeOff,
  Lock,
  Power,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase/client";
import { SessionsPanel } from "@/components/admin/sessions-panel";
import {
  MODEL_STAGES,
  getStageLabelByValue,
} from "@/lib/constants/model-stages";
import { PROVIDERS, getProviderByValue } from "@/lib/constants/providers";

interface ModelRow {
  id: string;
  model_key: string;
  provider: string;
  purpose: string;
  edgeadmin_endpoint?: string | null;
  api_key_last4?: string | null;
  status?: string;
}

interface MetricsPayload {
  totals: {
    sessions: number;
    live: number;
    completed: number;
    aborted: number;
    avg_overall_score: number;
    avg_confidence: number;
    sidekick_queries: number;
    sidekick_tokens: number;
    avg_prompt_length: number;
  };
  top_event_types: Array<{ event_type: string; count: number }>;
  recent_events: Array<{
    id: string;
    event_type: string;
    created_at: string;
    payload: any;
    session_id: string;
  }>;
}

export default function AdminPage() {
  const [models, setModels] = useState<ModelRow[]>([]);
  const [metrics, setMetrics] = useState<MetricsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [authUserEmail, setAuthUserEmail] = useState<string | null>(null);
  const [authRole, setAuthRole] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSending, setAuthSending] = useState(false);

  const [provider, setProvider] = useState("openai");
  const [modelKey, setModelKey] = useState("gpt-4o");
  const [purpose, setPurpose] = useState("candidate_sidekick");
  const [apiKey, setApiKey] = useState("");
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [endpoint, setEndpoint] = useState("https://api.openai.com/v1");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [formFeedback, setFormFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [fetchedModels, setFetchedModels] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [isModelFetched, setIsModelFetched] = useState(false);
  const [manualModelEntry, setManualModelEntry] = useState(false);

  const authedFetch = async (url: string, init?: RequestInit) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const headers = new Headers(init?.headers || {});
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(url, { ...init, headers });
  };

  const resolveRole = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user || null;
    const userEmail = user?.email || null;
    setAuthUserEmail(userEmail);
    if (!user) {
      setAuthRole(null);
      setAuthReady(true);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      setAuthRole(null);
      setAuthReady(true);
      return;
    }

    setAuthRole((profile as any)?.role || null);
    setAuthReady(true);
  };

  const loadData = async () => {
    setLoading(true);
    const [modelsResponse, metricsResponse] = await Promise.all([
      authedFetch("/api/admin/models"),
      authedFetch("/api/admin/metrics"),
    ]);

    const modelsJson = await modelsResponse.json();
    const metricsJson = await metricsResponse.json();

    setModels(modelsJson.models || []);
    setMetrics(metricsJson?.totals ? metricsJson : null);
    setLoading(false);
  };

  useEffect(() => {
    void resolveRole();

    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      void resolveRole();
    });

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (authRole === "admin") {
      void loadData();
    } else {
      setLoading(false);
    }
  }, [authReady, authRole]);

  const addModel = async () => {
    setSubmitting(true);
    setFormFeedback(null);
    try {
      const response = await authedFetch("/api/admin/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          model_key: modelKey,
          purpose,
          api_key: apiKey,
          edgeadmin_endpoint: endpoint || null,
        }),
      });

      if (response.ok) {
        setModelKey("");
        setApiKey("");
        setEndpoint("");
        setAdvancedOpen(false);
        setFetchedModels([]);
        setIsModelFetched(false);
        setManualModelEntry(false);
        setValidationError(null);
        setFormFeedback({
          type: "success",
          message: `Model "${modelKey}" added successfully.`,
        });
        await loadData();
      } else {
        const body = await response.json().catch(() => null);
        setFormFeedback({
          type: "error",
          message: body?.error || `Failed to add model (${response.status}).`,
        });
      }
    } catch (err: any) {
      setFormFeedback({
        type: "error",
        message: err?.message || "Network error — could not reach server.",
      });
    }
    setSubmitting(false);
  };

  const toggleModelActive = async (model: ModelRow) => {
    setTogglingId(model.id);
    try {
      const newActive = model.status !== "active";
      const response = await authedFetch("/api/admin/models", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: model.id, is_active: newActive }),
      });
      if (response.ok) {
        await loadData();
      }
    } catch {
      // silently fail — table will stay in current state
    }
    setTogglingId(null);
  };

  const handleProviderChange = (value: string) => {
    setProvider(value);
    const p = getProviderByValue(value);
    if (p) setEndpoint(p.defaultEndpoint);
    setFetchedModels([]);
    setIsModelFetched(false);
    setManualModelEntry(false);
    setModelKey("");
    setValidationError(null);
  };

  const validateAndFetchModels = async () => {
    if (!provider || !apiKey.trim()) return;
    setValidating(true);
    setValidationError(null);
    setFetchedModels([]);
    setIsModelFetched(false);
    setManualModelEntry(false);

    try {
      const response = await authedFetch("/api/admin/models/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, api_key: apiKey.trim() }),
      });

      const json = await response.json();

      if (!response.ok || !json.valid) {
        setValidationError(json.error || "Validation failed");
        return;
      }

      setFetchedModels(json.models || []);
      setIsModelFetched(true);
      if (json.models?.length > 0) {
        setModelKey(json.models[0].id);
      }
    } catch {
      setValidationError("Network error — could not reach server.");
    } finally {
      setValidating(false);
    }
  };

  const healthCards = useMemo(() => {
    if (!metrics?.totals) return [];
    return [
      {
        label: "Total sessions",
        value: metrics.totals.sessions,
        icon: Activity,
      },
      { label: "Live sessions", value: metrics.totals.live, icon: ShieldCheck },
      {
        label: "AI sidekick queries",
        value: metrics.totals.sidekick_queries,
        icon: Bot,
      },
      {
        label: "Avg overall score",
        value: metrics.totals.avg_overall_score,
        icon: Activity,
      },
    ];
  }, [metrics]);

  const signInWithGoogle = async () => {
    if (authSending) return;
    setAuthSending(true);
    setAuthError(null);
    try {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/admin`
          : undefined;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: redirectTo ? { redirectTo } : undefined,
      });
      if (error) throw error;
    } catch (err: any) {
      setAuthError(err?.message || "Unable to sign in with Google.");
    } finally {
      setAuthSending(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setAuthUserEmail(null);
    setAuthRole(null);
  };

  if (!authReady) {
    return (
      <main className="surface-grid flex min-h-screen items-center justify-center px-4 py-10">
        <div className="text-sm text-muted-foreground">
          Loading admin access...
        </div>
      </main>
    );
  }

  if (!authUserEmail) {
    return (
      <main className="surface-grid min-h-screen px-4 py-10 md:px-8">
        <div className="mx-auto w-full max-w-xl space-y-6">
          <header className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Admin
              </p>
              <h1 className="text-3xl font-semibold">
                Sign in to configure OneRecruit
              </h1>
            </div>
            <ThemeToggle />
          </header>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary" />
                Admin access required
              </CardTitle>
              <CardDescription>
                Sign in with Google to access the admin console. Your
                `profiles.role` must be `admin`.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                className="w-full"
                onClick={signInWithGoogle}
                disabled={authSending}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                {authSending ? "Signing in..." : "Sign in with Google"}
              </Button>
              {authError && (
                <p className="text-sm text-destructive">{authError}</p>
              )}
              <div className="rounded-xl border bg-muted/30 p-4 text-xs text-muted-foreground leading-6">
                If your account is new, a `profiles` row is created
                automatically. Update `profiles.role` to `admin` for this email.
              </div>
              <Button variant="outline" asChild className="w-full">
                <Link href="/">Back to Home</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  if (authRole !== "admin") {
    return (
      <main className="surface-grid min-h-screen px-4 py-10 md:px-8">
        <div className="mx-auto w-full max-w-xl space-y-6">
          <header className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Admin
              </p>
              <h1 className="text-3xl font-semibold">Access denied</h1>
            </div>
            <ThemeToggle />
          </header>
          <Card>
            <CardHeader>
              <CardTitle>Forbidden</CardTitle>
              <CardDescription>
                Signed in as{" "}
                <span className="font-medium text-foreground">
                  {authUserEmail}
                </span>
                . Role:{" "}
                <span className="font-medium text-foreground">
                  {authRole || "unknown"}
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                This page is gated to admins. Update your `profiles.role` to
                `admin`.
              </p>
              <Button onClick={signOut} className="w-full">
                Sign out
              </Button>
              <Button variant="outline" asChild className="w-full">
                <Link href="/">Back to Home</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="surface-grid min-h-screen px-4 py-8 md:px-8">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Admin
            </p>
            <h1 className="text-3xl font-semibold">Admin Console</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={signOut}>
              Sign out
            </Button>
            <ThemeToggle />
          </div>
        </header>

        <Tabs defaultValue="sessions" className="space-y-4">
          <TabsList>
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          </TabsList>

          <TabsContent value="sessions">
            <SessionsPanel />
          </TabsContent>

          <TabsContent value="dashboard" className="space-y-6">
            <section className="grid gap-4 md:grid-cols-4">
              {healthCards.map((card) => (
                <Card key={card.label}>
                  <CardHeader className="pb-2">
                    <CardDescription>{card.label}</CardDescription>
                    <CardTitle className="text-2xl">{card.value}</CardTitle>
                  </CardHeader>
                </Card>
              ))}
            </section>

            <Tabs defaultValue="models" className="space-y-4">
              <TabsList>
                <TabsTrigger value="models">Model Registry</TabsTrigger>
                <TabsTrigger value="events">Event Logs</TabsTrigger>
                <TabsTrigger value="metrics">Prompting Metrics</TabsTrigger>
              </TabsList>

              <TabsContent value="models">
                <div className="grid gap-4 lg:grid-cols-[1.2fr,1fr]">
                  <Card>
                    <CardHeader>
                      <CardTitle>Configured Models</CardTitle>
                      <CardDescription>
                        OpenAI-compatible multi-model registry for sidekick
                        routing.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Provider</TableHead>
                            <TableHead>Model</TableHead>
                            <TableHead>Purpose</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loading && (
                            <TableRow>
                              <TableCell colSpan={4}>
                                Loading models...
                              </TableCell>
                            </TableRow>
                          )}
                          {!loading && models.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={4}>
                                No models added yet.
                              </TableCell>
                            </TableRow>
                          )}
                          {models.map((model) => (
                            <TableRow
                              key={model.id}
                              className={
                                model.status !== "active" ? "opacity-60" : ""
                              }
                            >
                              <TableCell>{model.provider}</TableCell>
                              <TableCell className="font-medium">
                                {model.model_key}
                              </TableCell>
                              <TableCell>
                                {getStageLabelByValue(model.purpose)}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge
                                    variant={
                                      model.status === "active"
                                        ? "secondary"
                                        : "outline"
                                    }
                                    className={
                                      model.status === "active"
                                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                        : ""
                                    }
                                  >
                                    {model.status}
                                  </Badge>
                                  {model.api_key_last4 ? (
                                    <span className="text-xs text-muted-foreground">
                                      key •••• {model.api_key_last4}
                                    </span>
                                  ) : null}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    disabled={togglingId === model.id}
                                    onClick={() => toggleModelActive(model)}
                                    title={
                                      model.status === "active"
                                        ? "Deactivate model"
                                        : "Activate model"
                                    }
                                  >
                                    <Power className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Add Model</CardTitle>
                      <CardDescription>
                        Add an OpenAI-compatible model. Hiring managers should
                        only provide an API key.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-2">
                        <Label>Provider</Label>
                        <Select
                          value={provider}
                          onValueChange={handleProviderChange}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a provider" />
                          </SelectTrigger>
                          <SelectContent>
                            {PROVIDERS.map((p) => (
                              <SelectItem key={p.value} value={p.value}>
                                {p.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Purpose</Label>
                        <Select value={purpose} onValueChange={setPurpose}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a stage" />
                          </SelectTrigger>
                          <SelectContent>
                            {MODEL_STAGES.map((stage) => (
                              <SelectItem key={stage.value} value={stage.value}>
                                <span>{stage.label}</span>
                                <span className="ml-2 text-xs text-muted-foreground">
                                  {stage.description}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>API key</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            value={apiKey}
                            onChange={(event) => {
                              setApiKey(event.target.value);
                              setFetchedModels([]);
                              setIsModelFetched(false);
                              setManualModelEntry(false);
                              setValidationError(null);
                            }}
                            type={apiKeyVisible ? "text" : "password"}
                            placeholder="Paste provider API key"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => setApiKeyVisible((prev) => !prev)}
                          >
                            {apiKeyVisible ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full"
                          disabled={validating || !provider || !apiKey.trim()}
                          onClick={validateAndFetchModels}
                        >
                          {validating ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Validating...
                            </>
                          ) : (
                            "Validate & Fetch Models"
                          )}
                        </Button>
                        {validationError && (
                          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            {validationError}
                          </div>
                        )}
                        {isModelFetched && (
                          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400">
                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                            Key valid — {fetchedModels.length} model
                            {fetchedModels.length !== 1 ? "s" : ""} found
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Stored encrypted server-side. Used only for sidekick
                          runtime calls.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label>Model key</Label>
                        {isModelFetched && !manualModelEntry ? (
                          <>
                            <Select
                              value={modelKey}
                              onValueChange={setModelKey}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select a model" />
                              </SelectTrigger>
                              <SelectContent>
                                {fetchedModels.map((m) => (
                                  <SelectItem key={m.id} value={m.id}>
                                    {m.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <button
                              type="button"
                              className="text-xs text-muted-foreground underline hover:text-foreground"
                              onClick={() => {
                                setManualModelEntry(true);
                                setModelKey("");
                              }}
                            >
                              Enter manually instead
                            </button>
                          </>
                        ) : (
                          <>
                            <Input
                              value={modelKey}
                              onChange={(event) =>
                                setModelKey(event.target.value)
                              }
                              placeholder={
                                isModelFetched
                                  ? "e.g. gpt-4o"
                                  : "Validate API key to see available models"
                              }
                            />
                            {manualModelEntry && (
                              <button
                                type="button"
                                className="text-xs text-muted-foreground underline hover:text-foreground"
                                onClick={() => {
                                  setManualModelEntry(false);
                                  if (fetchedModels.length > 0) {
                                    setModelKey(fetchedModels[0].id);
                                  }
                                }}
                              >
                                Select from fetched models
                              </button>
                            )}
                          </>
                        )}
                      </div>

                      <Collapsible
                        open={advancedOpen}
                        onOpenChange={setAdvancedOpen}
                      >
                        <CollapsibleTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            className="w-full justify-between"
                          >
                            Advanced settings
                            <span className="text-xs text-muted-foreground">
                              {advancedOpen ? "Hide" : "Show"}
                            </span>
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-2">
                          <Label>OpenAI-compatible endpoint (optional)</Label>
                          <Input
                            value={endpoint}
                            onChange={(event) =>
                              setEndpoint(event.target.value)
                            }
                            placeholder="https://gateway.company.ai/v1"
                          />
                          <p className="text-xs text-muted-foreground">
                            Leave blank to use the default provider endpoint.
                          </p>
                        </CollapsibleContent>
                      </Collapsible>

                      {formFeedback && (
                        <div
                          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                            formFeedback.type === "success"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400"
                              : "border-destructive/30 bg-destructive/10 text-destructive"
                          }`}
                        >
                          {formFeedback.type === "success" ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                          ) : (
                            <AlertCircle className="h-4 w-4 shrink-0" />
                          )}
                          {formFeedback.message}
                        </div>
                      )}

                      <Button
                        onClick={addModel}
                        disabled={
                          submitting ||
                          !provider ||
                          !modelKey ||
                          !purpose ||
                          !apiKey
                        }
                        className="w-full"
                      >
                        <Plus className="h-4 w-4" />
                        {submitting ? "Saving..." : "Add Model"}
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="events">
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Live Events</CardTitle>
                    <CardDescription>
                      Detailed interviewer/candidate/AI activity timeline.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-[480px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Time</TableHead>
                            <TableHead>Event</TableHead>
                            <TableHead>Session</TableHead>
                            <TableHead>Payload</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(metrics?.recent_events || []).map((event, idx) => (
                            <TableRow key={event.id || idx}>
                              <TableCell className="text-xs text-muted-foreground">
                                {new Date(event.created_at).toLocaleString()}
                              </TableCell>
                              <TableCell>{event.event_type}</TableCell>
                              <TableCell className="font-mono text-xs">
                                {event.session_id?.slice(0, 8)}
                              </TableCell>
                              <TableCell className="max-w-[420px] truncate text-xs">
                                {JSON.stringify(event.payload || {})}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="metrics">
                <Card>
                  <CardHeader>
                    <CardTitle>AI Prompting & Usage Metrics</CardTitle>
                    <CardDescription>
                      Session-level visibility into AI usage style and volume.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-xl border p-4">
                      <p className="text-sm text-muted-foreground">
                        Sidekick tokens
                      </p>
                      <p className="mt-2 text-2xl font-semibold">
                        {metrics?.totals.sidekick_tokens || 0}
                      </p>
                    </div>
                    <div className="rounded-xl border p-4">
                      <p className="text-sm text-muted-foreground">
                        Avg prompt length
                      </p>
                      <p className="mt-2 text-2xl font-semibold">
                        {metrics?.totals.avg_prompt_length || 0}
                      </p>
                    </div>
                    <div className="rounded-xl border p-4">
                      <p className="text-sm text-muted-foreground">
                        Avg confidence
                      </p>
                      <p className="mt-2 text-2xl font-semibold">
                        {metrics?.totals.avg_confidence || 0}
                      </p>
                    </div>

                    <div className="md:col-span-3 rounded-xl border p-4">
                      <p className="mb-3 text-sm font-medium">
                        Top event types
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {(metrics?.top_event_types || []).map((item) => (
                          <Badge key={item.event_type} variant="outline">
                            {item.event_type}: {item.count}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
