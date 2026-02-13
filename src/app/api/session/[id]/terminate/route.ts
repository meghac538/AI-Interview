import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const payload = await request.json().catch(() => ({}));

    await supabaseAdmin
      .from("interview_sessions")
      .update({ status: "aborted" })
      .eq("id", id);

    await supabaseAdmin.from("live_events").insert({
      session_id: id,
      event_type: "session_terminated",
      actor: "interviewer",
      payload: {
        reason: payload?.reason ?? "manual"
      }
    });

    return NextResponse.json({
      sessionId: id,
      status: "aborted",
      reason: payload?.reason ?? "manual"
    });
  } catch (error: any) {
    console.error("Terminate session error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
