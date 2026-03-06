import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/require-admin";

export async function GET(request: Request) {
  try {
    const gate = await requireAdmin(request);
    if (!gate.ok) return gate.response;

    const { data, error } = await supabaseAdmin
      .from("model_registry")
      .select(
        "id,model_key,provider,purpose,edgeadmin_endpoint,is_active,created_at,api_key_last4",
      )
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      models:
        data?.map((row) => ({
          ...row,
          status: row.is_active ? "active" : "inactive",
        })) || [],
    });
  } catch (error: any) {
    console.error("Admin models GET error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch models" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const gate = await requireAdmin(request);
    if (!gate.ok) return gate.response;

    const { model_key, provider, purpose, edgeadmin_endpoint, api_key } =
      await request.json();

    if (!model_key || !provider || !purpose) {
      return NextResponse.json(
        { error: "model_key, provider and purpose are required" },
        { status: 400 },
      );
    }

    const apiKey: string | null =
      typeof api_key === "string" && api_key.trim() ? api_key.trim() : null;

    const { encryptModelApiKey } =
      await import("@/lib/ai/model-registry-secrets");
    const apiKeyEncrypted = apiKey ? encryptModelApiKey(apiKey) : null;
    const apiKeyLast4 = apiKey ? apiKey.slice(-4) : null;

    const { data, error } = await supabaseAdmin
      .from("model_registry")
      .insert({
        model_key,
        provider,
        purpose,
        edgeadmin_endpoint: edgeadmin_endpoint || null,
        api_key_ciphertext: apiKeyEncrypted,
        api_key_last4: apiKeyLast4,
        budget_policy: {},
        is_active: true,
      })
      .select(
        "id,model_key,provider,purpose,edgeadmin_endpoint,is_active,created_at,api_key_last4",
      )
      .single();

    if (error) throw error;

    return NextResponse.json({ model: data });
  } catch (error: any) {
    console.error("Admin models POST error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to add model" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const gate = await requireAdmin(request);
    if (!gate.ok) return gate.response;

    const { id, is_active } = await request.json();

    if (!id || typeof is_active !== "boolean") {
      return NextResponse.json(
        { error: "id (string) and is_active (boolean) are required" },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from("model_registry")
      .update({ is_active })
      .eq("id", id)
      .select("id,model_key,provider,purpose,is_active")
      .single();

    if (error) throw error;

    return NextResponse.json({ model: data });
  } catch (error: any) {
    console.error("Admin models PATCH error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update model" },
      { status: 500 },
    );
  }
}
