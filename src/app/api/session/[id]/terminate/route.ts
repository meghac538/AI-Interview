import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const payload = await request.json().catch(() => ({}));

    // Mark all active/pending rounds as skipped
    const { data: scopePackage } = await supabaseAdmin
      .from("interview_scope_packages")
      .select("*")
      .eq("session_id", id)
      .single();

    if (scopePackage) {
      const roundPlan = (scopePackage.round_plan || []) as Array<Record<string, any>>;
      let modified = false;
      for (const round of roundPlan) {
        if (round.status === "active" || round.status === "pending") {
          round.status = "skipped";
          round.completed_at = new Date().toISOString();
          modified = true;
        }
      }
      if (modified) {
        await supabaseAdmin
          .from("interview_scope_packages")
          .update({ round_plan: roundPlan })
          .eq("id", scopePackage.id);
      }
    }

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
