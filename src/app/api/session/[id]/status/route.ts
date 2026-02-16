import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/server"

const ALLOWED_STATUSES = new Set(["scheduled", "live", "paused", "completed", "aborted"])

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params
    const body = await request.json().catch(() => ({}))
    const nextStatus = String(body?.status || "").trim()

    if (!ALLOWED_STATUSES.has(nextStatus)) {
      return NextResponse.json(
        { error: `Invalid status. Allowed: ${Array.from(ALLOWED_STATUSES).join(", ")}` },
        { status: 400 }
      )
    }

    const reason = typeof body?.reason === "string" ? body.reason : null

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("interview_sessions")
      .select("id,status")
      .eq("id", sessionId)
      .single()

    if (existingError) throw existingError

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("interview_sessions")
      .update({ status: nextStatus })
      .eq("id", sessionId)
      .select("id,status")
      .single()

    if (updateError) throw updateError

    await supabaseAdmin.from("live_events").insert({
      session_id: sessionId,
      event_type: "session_status_changed",
      actor: "interviewer",
      payload: {
        from: existing?.status ?? null,
        to: nextStatus,
        reason
      }
    })

    return NextResponse.json({
      session_id: sessionId,
      status: updated?.status,
      reason
    })
  } catch (error: any) {
    console.error("Session status update error:", error)
    return NextResponse.json({ error: error.message || "Failed to update session status" }, { status: 500 })
  }
}

