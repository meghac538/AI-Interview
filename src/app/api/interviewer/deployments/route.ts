import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/server"
import { requireInterviewer } from "@/lib/supabase/require-role"

function mergeObjects(base: Record<string, any>, extras: Record<string, any>) {
  return {
    ...base,
    ...extras,
    payload: {
      ...(base.payload || {}),
      ...(extras.payload || {})
    }
  }
}

function parseResponseBody(raw: string) {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return { raw }
  }
}

function isMissingTableError(error: any) {
  return error?.code === "PGRST205"
}

function normalizeConfig(row: any) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || null,
    event_type: row.event_type,
    role_family: row.role_family || null,
    target_url: row.target_url,
    http_method: row.http_method || "POST",
    timeout_ms: Number(row.timeout_ms || 12000),
    is_active: row.is_active !== false,
    headers: row.headers || {},
    request_template: row.request_template || {}
  }
}

function normalizeRun(row: any) {
  return {
    id: row.id,
    status: row.status,
    deployment_name: row.deployment_name,
    session_id: row.session_id,
    response_status: row.response_status || null,
    error_message: row.error_message || null,
    created_at: row.created_at
  }
}

export async function GET(request: Request) {
  try {
    const gate = await requireInterviewer(request)
    if (!gate.ok) return gate.response

    const url = new URL(request.url)
    const sessionId = url.searchParams.get("session_id")

    const [configsRes, scopeRes] = await Promise.all([
      supabaseAdmin
        .from("webhook_configs")
        .select("*")
        .eq("is_active", true)
        .order("updated_at", { ascending: false }),
      sessionId
        ? supabaseAdmin
            .from("interview_scope_packages")
            .select("track")
            .eq("session_id", sessionId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null } as any)
    ])

    if (configsRes.error) throw configsRes.error
    if (scopeRes.error) throw scopeRes.error

    let deployments: any[] = []
    let warning: string | null = null

    if (sessionId) {
      const deploymentsRes = await supabaseAdmin
        .from("session_agent_deployments")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false })
        .limit(50)

      if (deploymentsRes.error) {
        if (!isMissingTableError(deploymentsRes.error)) {
          throw deploymentsRes.error
        }
        warning = "session_agent_deployments table is not available yet. Run latest migration."
      } else {
        deployments = deploymentsRes.data || []
      }
    }

    return NextResponse.json({
      configs: (configsRes.data || []).map(normalizeConfig),
      deployments: deployments.map(normalizeRun),
      session_track: scopeRes.data?.track || null,
      warning
    })
  } catch (error: any) {
    console.error("Interviewer deployments GET error:", error)
    return NextResponse.json({ error: error?.message || "Failed to load deployment panel" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const gate = await requireInterviewer(request)
    if (!gate.ok) return gate.response

    const payload = await request.json()
    const sessionId = String(payload?.session_id || "").trim()
    const webhookConfigId = String(payload?.webhook_config_id || "").trim()
    const inputPayload = (payload?.input && typeof payload.input === "object" && !Array.isArray(payload.input)) ? payload.input : {}

    if (!sessionId || !webhookConfigId) {
      return NextResponse.json({ error: "session_id and webhook_config_id are required" }, { status: 400 })
    }

    const [{ data: configRow, error: configError }, { data: session, error: sessionError }] = await Promise.all([
      supabaseAdmin
        .from("webhook_configs")
        .select("*")
        .eq("id", webhookConfigId)
        .maybeSingle(),
      supabaseAdmin
        .from("interview_sessions")
        .select("id,candidate_id,status")
        .eq("id", sessionId)
        .maybeSingle()
    ])

    if (configError) throw configError
    if (sessionError) throw sessionError

    const config = configRow ? normalizeConfig(configRow) : null

    if (!config || !config.is_active) {
      return NextResponse.json({ error: "Selected deployment flow is inactive or missing." }, { status: 400 })
    }

    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 })
    }

    const startedAt = Date.now()
    const runtimePayload = {
      session_id: sessionId,
      candidate_id: session.candidate_id,
      session_status: session.status,
      event_type: config.event_type,
      deployed_by: gate.user.id,
      deployed_at: new Date().toISOString(),
      payload: inputPayload
    }

    const requestPayload = mergeObjects((config.request_template || {}) as Record<string, any>, runtimePayload)

    let deploymentRowId: string | null = null
    let persistenceWarning: string | null = null

    const insertAttempt = await supabaseAdmin
      .from("session_agent_deployments")
      .insert({
        session_id: sessionId,
        webhook_config_id: config.id,
        deployed_by: gate.user.id,
        deployment_name: config.name,
        status: "queued",
        request_payload: requestPayload
      })
      .select("id")
      .single()

    if (insertAttempt.error) {
      if (!isMissingTableError(insertAttempt.error)) {
        throw insertAttempt.error
      }
      persistenceWarning = "Deployment executed but not persisted; run latest migration."
    } else {
      deploymentRowId = insertAttempt.data?.id || null
    }

    const controller = new AbortController()
    const timeoutMs = Number(config.timeout_ms || 12000)
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    const requestHeaders = new Headers((config.headers || {}) as Record<string, string>)
    if (!requestHeaders.has("Content-Type")) {
      requestHeaders.set("Content-Type", "application/json")
    }

    let status = "failed"
    let responseStatus: number | null = null
    let responseBody: any = null
    let errorMessage: string | null = null

    try {
      const response = await fetch(config.target_url, {
        method: String(config.http_method || "POST").toUpperCase(),
        headers: requestHeaders,
        body: JSON.stringify(requestPayload),
        signal: controller.signal
      })

      responseStatus = response.status
      const responseText = await response.text()
      responseBody = parseResponseBody(responseText)
      status = response.ok ? "success" : "failed"
      if (!response.ok) {
        errorMessage = `Target returned HTTP ${response.status}`
      }
    } catch (error: any) {
      if (error?.name === "AbortError") {
        status = "timeout"
        errorMessage = "Deployment request timed out"
      } else {
        status = "failed"
        errorMessage = error?.message || "Deployment request failed"
      }
    } finally {
      clearTimeout(timeout)
    }

    const durationMs = Date.now() - startedAt

    if (deploymentRowId) {
      await supabaseAdmin
        .from("session_agent_deployments")
        .update({
          status,
          response_status: responseStatus,
          response_body: responseBody,
          error_message: errorMessage,
          duration_ms: durationMs
        })
        .eq("id", deploymentRowId)
    }

    await supabaseAdmin.from("live_events").insert({
      session_id: sessionId,
      event_type: "agent_deployment_triggered",
      actor: "interviewer",
      payload: {
        webhook_config_id: config.id,
        deployment_name: config.name,
        status,
        response_status: responseStatus,
        error: errorMessage,
        duration_ms: durationMs
      }
    })

    return NextResponse.json({
      ok: status === "success",
      deployment_id: deploymentRowId,
      status,
      response_status: responseStatus,
      response_body: responseBody,
      error: errorMessage,
      warning: persistenceWarning
    })
  } catch (error: any) {
    console.error("Interviewer deployments POST error:", error)
    return NextResponse.json({ error: error?.message || "Failed to deploy selected flow" }, { status: 500 })
  }
}
