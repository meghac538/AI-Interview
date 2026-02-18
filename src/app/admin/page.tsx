"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Bot, Eye, EyeOff, Loader2, Plus, ShieldCheck, Activity, LogOut, Zap } from "lucide-react"
import { useRouter } from "next/navigation"
import { ThemeToggle } from "@/components/theme-toggle"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Textarea } from "@/components/ui/textarea"
import { supabase } from "@/lib/supabase/client"
import { authedFetch } from "@/lib/supabase/authed-fetch"
import { resolveCurrentUserRole } from "@/lib/supabase/client-role"
import { isAdminRole } from "@/lib/auth/roles"

interface ModelRow {
  id: string
  model_key: string
  provider: string
  purpose: string
  edgeadmin_endpoint?: string | null
  api_key_last4?: string | null
  status?: string
}

interface MetricsPayload {
  totals: {
    sessions: number
    live: number
    completed: number
    aborted: number
    avg_overall_score: number
    avg_confidence: number
    sidekick_queries: number
    sidekick_tokens: number
    avg_prompt_length: number
  }
  top_event_types: Array<{ event_type: string; count: number }>
  recent_events: Array<{ id: string; event_type: string; created_at: string; payload: any; session_id: string }>
}

interface AgentDeploymentConfig {
  id: string
  name: string
  description?: string | null
  event_type: string
  role_family?: string | null
  target_url: string
  http_method: string
  is_active: boolean
  timeout_ms: number
  headers: Record<string, string>
  request_template: Record<string, any>
  updated_at?: string
}

interface DeploymentRun {
  id: string
  status: string
  deployment_name: string
  session_id: string
  response_status?: number | null
  error_message?: string | null
  created_at: string
}

export default function AdminPage() {
  const router = useRouter()
  const [models, setModels] = useState<ModelRow[]>([])
  const [metrics, setMetrics] = useState<MetricsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [authReady, setAuthReady] = useState(false)
  const [authUserEmail, setAuthUserEmail] = useState<string | null>(null)
  const [authRole, setAuthRole] = useState<string | null>(null)

  const [provider, setProvider] = useState("openai")
  const [modelKey, setModelKey] = useState("gpt-4o")
  const [purpose, setPurpose] = useState("candidate_sidekick")
  const [apiKey, setApiKey] = useState("")
  const [apiKeyVisible, setApiKeyVisible] = useState(false)
  const [endpoint, setEndpoint] = useState("")
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const [agentConfigs, setAgentConfigs] = useState<AgentDeploymentConfig[]>([])
  const [agentRuns, setAgentRuns] = useState<DeploymentRun[]>([])
  const [agentSubmitting, setAgentSubmitting] = useState(false)
  const [agentFormError, setAgentFormError] = useState<string | null>(null)
  const [agentName, setAgentName] = useState("")
  const [agentDescription, setAgentDescription] = useState("")
  const [agentEventType, setAgentEventType] = useState("session.assist")
  const [agentRoleFamily, setAgentRoleFamily] = useState("all")
  const [agentTargetUrl, setAgentTargetUrl] = useState("")
  const [agentHttpMethod, setAgentHttpMethod] = useState("POST")
  const [agentTimeoutMs, setAgentTimeoutMs] = useState("12000")
  const [agentHeadersJson, setAgentHeadersJson] = useState('{\n  "Content-Type": "application/json"\n}')
  const [agentTemplateJson, setAgentTemplateJson] = useState('{\n  "source": "oneorigin_interview",\n  "payload": {}\n}')

  const loadData = async () => {
    setLoading(true)
    const [modelsResponse, metricsResponse, deploymentsResponse] = await Promise.all([
      authedFetch("/api/admin/models"),
      authedFetch("/api/admin/metrics"),
      authedFetch("/api/admin/agent-deployments")
    ])

    const modelsJson = await modelsResponse.json().catch(() => ({}))
    const metricsJson = await metricsResponse.json().catch(() => ({}))
    const deploymentsJson = await deploymentsResponse.json().catch(() => ({}))

    setModels(modelsJson.models || [])
    setMetrics(metricsJson || null)
    setAgentConfigs(deploymentsJson.configs || [])
    setAgentRuns(deploymentsJson.recent_runs || [])
    setLoading(false)
  }

  useEffect(() => {
    let cancelled = false

    const resolveRole = async () => {
      const { email, role } = await resolveCurrentUserRole()
      if (cancelled) return

      if (!email) {
        router.replace("/admin/login")
        return
      }

      setAuthUserEmail(email)
      setAuthRole(role)
      setAuthReady(true)

      if (isAdminRole(role)) {
        await loadData()
      }
    }

    void resolveRole()

    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      void resolveRole()
    })

    return () => {
      cancelled = true
      subscription.subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  const addModel = async () => {
    setSubmitting(true)
    const response = await authedFetch("/api/admin/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider,
        model_key: modelKey,
        purpose,
        api_key: apiKey,
        edgeadmin_endpoint: endpoint || null
      })
    })

    if (response.ok) {
      setModelKey("gpt-4o")
      setApiKey("")
      setEndpoint("")
      setAdvancedOpen(false)
      await loadData()
    }
    setSubmitting(false)
  }

  const saveAgentConfig = async () => {
    if (agentSubmitting) return
    setAgentSubmitting(true)
    setAgentFormError(null)

    try {
      const headers = JSON.parse(agentHeadersJson || "{}")
      const requestTemplate = JSON.parse(agentTemplateJson || "{}")

      const response = await authedFetch("/api/admin/agent-deployments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: agentName,
          description: agentDescription || null,
          event_type: agentEventType,
          role_family: agentRoleFamily === "all" ? null : agentRoleFamily,
          target_url: agentTargetUrl,
          http_method: agentHttpMethod,
          timeout_ms: Number(agentTimeoutMs || 12000),
          headers,
          request_template: requestTemplate,
          is_active: true
        })
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.error || "Failed to save agent deployment flow")
      }

      setAgentName("")
      setAgentDescription("")
      setAgentTargetUrl("")
      await loadData()
    } catch (error: any) {
      setAgentFormError(error?.message || "Unable to save deployment flow.")
    } finally {
      setAgentSubmitting(false)
    }
  }

  const toggleAgentConfig = async (config: AgentDeploymentConfig) => {
    const response = await authedFetch("/api/admin/agent-deployments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: config.id, is_active: !config.is_active })
    })

    if (response.ok) {
      await loadData()
    }
  }

  const healthCards = useMemo(() => {
    if (!metrics) return []
    return [
      { label: "Total sessions", value: metrics.totals.sessions, icon: Activity },
      { label: "Live sessions", value: metrics.totals.live, icon: ShieldCheck },
      { label: "AI sidekick queries", value: metrics.totals.sidekick_queries, icon: Bot },
      { label: "Avg overall score", value: metrics.totals.avg_overall_score, icon: Activity }
    ]
  }, [metrics])

  const signOut = async () => {
    await supabase.auth.signOut()
    router.replace("/admin/login")
  }

  if (!authReady) {
    return (
      <main className="surface-grid flex min-h-screen items-center justify-center px-4 py-10">
        <div className="text-sm text-muted-foreground">Loading admin access...</div>
      </main>
    )
  }

  if (!isAdminRole(authRole)) {
    return (
      <main className="surface-grid min-h-screen px-4 py-10 md:px-8">
        <div className="mx-auto w-full max-w-xl space-y-6">
          <header className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Admin</p>
              <h1 className="text-3xl font-semibold">Access denied</h1>
            </div>
            <ThemeToggle />
          </header>
          <Card>
            <CardHeader>
              <CardTitle>Forbidden</CardTitle>
              <CardDescription>
                Signed in as <span className="font-medium text-foreground">{authUserEmail}</span>. Role: <span className="font-medium text-foreground">{authRole || "unknown"}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                This page is gated to admins.
              </p>
              <Button onClick={signOut} className="w-full">Sign out</Button>
              <Button variant="outline" asChild className="w-full">
                <Link href="/interviewer">Back to interviewer</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    )
  }

  return (
    <main className="surface-grid min-h-screen px-4 py-8 md:px-8">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Admin</p>
            <h1 className="text-3xl font-semibold">AI Sidekick Configuration + Live Metrics</h1>
            {authUserEmail ? <p className="text-xs text-muted-foreground">Signed in: {authUserEmail}</p> : null}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/interviewer">
                <ArrowLeft className="h-4 w-4" />
                Interviewer
              </Link>
            </Button>
            <Button variant="outline" onClick={signOut}>
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
            <ThemeToggle />
          </div>
        </header>

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
            <TabsTrigger value="interviewer_config">Interviewer Config</TabsTrigger>
            <TabsTrigger value="events">Event Logs</TabsTrigger>
            <TabsTrigger value="metrics">Prompting Metrics</TabsTrigger>
          </TabsList>

          <TabsContent value="models">
            <div className="grid gap-4 lg:grid-cols-[1.2fr,1fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Configured Models</CardTitle>
                  <CardDescription>OpenAI-compatible multi-model registry for sidekick routing.</CardDescription>
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
                          <TableCell colSpan={4}>Loading models...</TableCell>
                        </TableRow>
                      )}
                      {!loading && models.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4}>No models added yet.</TableCell>
                        </TableRow>
                      )}
                      {models.map((model) => (
                        <TableRow key={model.id}>
                          <TableCell>{model.provider}</TableCell>
                          <TableCell className="font-medium">{model.model_key}</TableCell>
                          <TableCell>{model.purpose}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={model.status === "active" ? "secondary" : "outline"}>{model.status}</Badge>
                              {model.api_key_last4 ? (
                                <span className="text-xs text-muted-foreground">key •••• {model.api_key_last4}</span>
                              ) : null}
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
                  <CardDescription>Add an OpenAI-compatible model. Hiring managers should only provide an API key.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label>Provider</Label>
                    <Input value={provider} onChange={(event) => setProvider(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Model key</Label>
                    <Input value={modelKey} onChange={(event) => setModelKey(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Purpose</Label>
                    <Input value={purpose} onChange={(event) => setPurpose(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>API key</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        value={apiKey}
                        onChange={(event) => setApiKey(event.target.value)}
                        type={apiKeyVisible ? "text" : "password"}
                        placeholder="Paste provider API key"
                      />
                      <Button type="button" variant="outline" size="icon" onClick={() => setApiKeyVisible((prev) => !prev)}>
                        {apiKeyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Stored encrypted server-side. Used only for sidekick runtime calls.
                    </p>
                  </div>

                  <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                    <CollapsibleTrigger asChild>
                      <Button type="button" variant="ghost" className="w-full justify-between">
                        Advanced settings
                        <span className="text-xs text-muted-foreground">{advancedOpen ? "Hide" : "Show"}</span>
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-2">
                      <Label>OpenAI-compatible endpoint (optional)</Label>
                      <Input
                        value={endpoint}
                        onChange={(event) => setEndpoint(event.target.value)}
                        placeholder="https://gateway.company.ai/v1"
                      />
                      <p className="text-xs text-muted-foreground">
                        Leave blank to use the default provider endpoint.
                      </p>
                    </CollapsibleContent>
                  </Collapsible>

                  <Button onClick={addModel} disabled={submitting || !provider || !modelKey || !purpose || !apiKey} className="w-full">
                    <Plus className="h-4 w-4" />
                    {submitting ? "Saving..." : "Add Model"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="interviewer_config">
            <div className="grid gap-4 lg:grid-cols-[1.2fr,1fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Agent Deployment Panel Configuration</CardTitle>
                  <CardDescription>
                    Define deployable webhook/API flows (n8n compatible). Interviewers can launch these into any live session.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {agentConfigs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5}>No deployment flows configured.</TableCell>
                        </TableRow>
                      ) : (
                        agentConfigs.map((config) => (
                          <TableRow key={config.id}>
                            <TableCell>
                              <div className="font-medium">{config.name}</div>
                              <div className="text-xs text-muted-foreground truncate max-w-[260px]">{config.target_url}</div>
                            </TableCell>
                            <TableCell className="text-xs">{config.role_family || "all"}</TableCell>
                            <TableCell className="text-xs">{config.http_method}</TableCell>
                            <TableCell>
                              <Badge variant={config.is_active ? "secondary" : "outline"}>
                                {config.is_active ? "active" : "inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button size="sm" variant="outline" onClick={() => void toggleAgentConfig(config)}>
                                {config.is_active ? "Disable" : "Enable"}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>

                  <div className="rounded-xl border p-4">
                    <p className="mb-2 text-sm font-medium">Recent deployment runs</p>
                    <div className="max-h-[220px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Time</TableHead>
                            <TableHead>Flow</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>HTTP</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {agentRuns.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4}>No deployments recorded yet.</TableCell>
                            </TableRow>
                          ) : (
                            agentRuns.map((run) => (
                              <TableRow key={run.id}>
                                <TableCell className="text-xs text-muted-foreground">{new Date(run.created_at).toLocaleString()}</TableCell>
                                <TableCell className="text-xs">{run.deployment_name}</TableCell>
                                <TableCell>
                                  <Badge variant={run.status === "success" ? "secondary" : "outline"}>{run.status}</Badge>
                                </TableCell>
                                <TableCell className="text-xs">{run.response_status || "-"}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Create Deployment Flow</CardTitle>
                  <CardDescription>
                    Configure endpoint behavior once. Interviewers only select and deploy during live sessions.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input value={agentName} onChange={(event) => setAgentName(event.target.value)} placeholder="n8n - Sales Objection Coaching" />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input value={agentDescription} onChange={(event) => setAgentDescription(event.target.value)} placeholder="What this deployment flow does" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label>Event Type</Label>
                      <Input value={agentEventType} onChange={(event) => setAgentEventType(event.target.value)} placeholder="session.assist" />
                    </div>
                    <div className="space-y-2">
                      <Label>Role family</Label>
                      <Input value={agentRoleFamily} onChange={(event) => setAgentRoleFamily(event.target.value)} placeholder="sales / agentic_eng / all" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Target URL</Label>
                    <Input value={agentTargetUrl} onChange={(event) => setAgentTargetUrl(event.target.value)} placeholder="https://n8n.company.com/webhook/..." />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label>HTTP Method</Label>
                      <Input value={agentHttpMethod} onChange={(event) => setAgentHttpMethod(event.target.value.toUpperCase())} placeholder="POST" />
                    </div>
                    <div className="space-y-2">
                      <Label>Timeout (ms)</Label>
                      <Input value={agentTimeoutMs} onChange={(event) => setAgentTimeoutMs(event.target.value)} placeholder="12000" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Headers JSON</Label>
                    <Textarea rows={5} className="font-mono text-xs" value={agentHeadersJson} onChange={(event) => setAgentHeadersJson(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Request Template JSON</Label>
                    <Textarea rows={6} className="font-mono text-xs" value={agentTemplateJson} onChange={(event) => setAgentTemplateJson(event.target.value)} />
                  </div>

                  {agentFormError ? <p className="text-sm text-destructive">{agentFormError}</p> : null}

                  <Button
                    onClick={saveAgentConfig}
                    disabled={
                      agentSubmitting ||
                      !agentName.trim() ||
                      !agentEventType.trim() ||
                      !agentTargetUrl.trim() ||
                      !agentHttpMethod.trim()
                    }
                    className="w-full"
                  >
                    <Zap className="h-4 w-4" />
                    {agentSubmitting ? "Saving..." : "Save Deployment Flow"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="events">
            <Card>
              <CardHeader>
                <CardTitle>Recent Live Events</CardTitle>
                <CardDescription>Detailed interviewer/candidate/AI activity timeline.</CardDescription>
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
                      {(metrics?.recent_events || []).map((event) => (
                        <TableRow key={event.id}>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(event.created_at).toLocaleString()}
                          </TableCell>
                          <TableCell>{event.event_type}</TableCell>
                          <TableCell className="font-mono text-xs">{event.session_id?.slice(0, 8)}</TableCell>
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
                <CardDescription>Session-level visibility into AI usage style and volume.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border p-4">
                  <p className="text-sm text-muted-foreground">Sidekick tokens</p>
                  <p className="mt-2 text-2xl font-semibold">{metrics?.totals.sidekick_tokens || 0}</p>
                </div>
                <div className="rounded-xl border p-4">
                  <p className="text-sm text-muted-foreground">Avg prompt length</p>
                  <p className="mt-2 text-2xl font-semibold">{metrics?.totals.avg_prompt_length || 0}</p>
                </div>
                <div className="rounded-xl border p-4">
                  <p className="text-sm text-muted-foreground">Avg confidence</p>
                  <p className="mt-2 text-2xl font-semibold">{metrics?.totals.avg_confidence || 0}</p>
                </div>

                <div className="md:col-span-3 rounded-xl border p-4">
                  <p className="mb-3 text-sm font-medium">Top event types</p>
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
      </div>
    </main>
  )
}
