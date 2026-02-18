import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/supabase/require-admin"

function sanitizeHttpMethod(value: unknown) {
  const method = typeof value === "string" ? value.trim().toUpperCase() : "POST"
  return method || "POST"
}

function sanitizeJsonObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return value
}

function isMissingColumnError(error: any) {
  const message = String(error?.message || "").toLowerCase()
  return error?.code === "42703" || message.includes("does not exist") || message.includes("column")
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
    headers: row.headers || {},
    request_template: row.request_template || {},
    is_active: row.is_active !== false,
    updated_at: row.updated_at
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
    const gate = await requireAdmin(request)
    if (!gate.ok) return gate.response

    const configsRes = await supabaseAdmin
      .from("webhook_configs")
      .select("*")
      .order("updated_at", { ascending: false })

    if (configsRes.error) throw configsRes.error

    let runs: any[] = []
    let warning: string | null = null

    const runsRes = await supabaseAdmin
      .from("session_agent_deployments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100)

    if (runsRes.error) {
      if (!isMissingTableError(runsRes.error)) {
        throw runsRes.error
      }
      warning = "session_agent_deployments table is not available yet. Run latest migration."
    } else {
      runs = runsRes.data || []
    }

    return NextResponse.json({
      configs: (configsRes.data || []).map(normalizeConfig),
      recent_runs: runs.map(normalizeRun),
      warning
    })
  } catch (error: any) {
    console.error("Admin deployment config GET error:", error)
    return NextResponse.json({ error: error?.message || "Failed to fetch deployment config" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const gate = await requireAdmin(request)
    if (!gate.ok) return gate.response

    const payload = await request.json()
    const name = String(payload?.name || "").trim()
    const eventType = String(payload?.event_type || "").trim()
    const targetUrl = String(payload?.target_url || "").trim()
    const roleFamily = payload?.role_family ? String(payload.role_family).trim() : null
    const httpMethod = sanitizeHttpMethod(payload?.http_method)
    const timeoutMs = Number(payload?.timeout_ms || 12000)

    if (!name || !eventType || !targetUrl) {
      return NextResponse.json({ error: "name, event_type and target_url are required" }, { status: 400 })
    }

    if (!/^https?:\/\//i.test(targetUrl)) {
      return NextResponse.json({ error: "target_url must start with http:// or https://" }, { status: 400 })
    }

    const baseInsert = {
      name,
      event_type: eventType,
      target_url: targetUrl,
      headers: sanitizeJsonObject(payload?.headers),
      is_active: payload?.is_active !== false,
      retry_count: 3
    }

    const extendedInsert = {
      ...baseInsert,
      description: payload?.description ? String(payload.description).trim() : null,
      role_family: roleFamily,
      http_method: httpMethod,
      timeout_ms: Number.isFinite(timeoutMs) ? Math.max(1000, timeoutMs) : 12000,
      request_template: sanitizeJsonObject(payload?.request_template),
      created_by: gate.user.id,
      updated_by: gate.user.id
    }

    let warning: string | null = null
    let insertResult = await supabaseAdmin.from("webhook_configs").insert(extendedInsert).select("*").single()

    if (insertResult.error && isMissingColumnError(insertResult.error)) {
      insertResult = await supabaseAdmin.from("webhook_configs").insert(baseInsert).select("*").single()
      warning = "Saved with legacy webhook schema. Apply latest migration for role/method/template fields."
    }

    if (insertResult.error) throw insertResult.error

    return NextResponse.json({
      config: normalizeConfig(insertResult.data),
      warning
    })
  } catch (error: any) {
    console.error("Admin deployment config POST error:", error)
    return NextResponse.json({ error: error?.message || "Failed to save deployment config" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const gate = await requireAdmin(request)
    if (!gate.ok) return gate.response

    const payload = await request.json()
    const id = String(payload?.id || "").trim()

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    const baseUpdates: Record<string, any> = {}
    if (payload?.name !== undefined) baseUpdates.name = String(payload.name || "").trim()
    if (payload?.event_type !== undefined) baseUpdates.event_type = String(payload.event_type || "").trim()
    if (payload?.target_url !== undefined) baseUpdates.target_url = String(payload.target_url || "").trim()
    if (payload?.is_active !== undefined) baseUpdates.is_active = Boolean(payload.is_active)
    if (payload?.headers !== undefined) baseUpdates.headers = sanitizeJsonObject(payload.headers)

    const extendedUpdates: Record<string, any> = {
      ...baseUpdates,
      updated_by: gate.user.id
    }

    if (payload?.description !== undefined) extendedUpdates.description = payload.description ? String(payload.description).trim() : null
    if (payload?.role_family !== undefined) extendedUpdates.role_family = payload.role_family ? String(payload.role_family).trim() : null
    if (payload?.http_method !== undefined) extendedUpdates.http_method = sanitizeHttpMethod(payload.http_method)
    if (payload?.timeout_ms !== undefined) {
      const timeoutMs = Number(payload.timeout_ms)
      extendedUpdates.timeout_ms = Number.isFinite(timeoutMs) ? Math.max(1000, timeoutMs) : 12000
    }
    if (payload?.request_template !== undefined) extendedUpdates.request_template = sanitizeJsonObject(payload.request_template)

    let warning: string | null = null
    let updateResult = await supabaseAdmin
      .from("webhook_configs")
      .update(extendedUpdates)
      .eq("id", id)
      .select("*")
      .single()

    if (updateResult.error && isMissingColumnError(updateResult.error)) {
      updateResult = await supabaseAdmin
        .from("webhook_configs")
        .update(baseUpdates)
        .eq("id", id)
        .select("*")
        .single()
      warning = "Updated with legacy webhook schema. Apply latest migration for role/method/template fields."
    }

    if (updateResult.error) throw updateResult.error

    return NextResponse.json({
      config: normalizeConfig(updateResult.data),
      warning
    })
  } catch (error: any) {
    console.error("Admin deployment config PATCH error:", error)
    return NextResponse.json({ error: error?.message || "Failed to update deployment config" }, { status: 500 })
  }
}
