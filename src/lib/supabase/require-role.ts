import { NextResponse } from "next/server"
import type { User } from "@supabase/supabase-js"
import { supabaseAdmin } from "@/lib/supabase/server"
import { INTERVIEWER_ROLES, normalizeRole, type AppRole } from "@/lib/auth/roles"

function extractBearerToken(request: Request) {
  const header = request.headers.get("authorization") || request.headers.get("Authorization") || ""
  const match = header.match(/^Bearer\\s+(.+)$/i)
  return match?.[1]?.trim() || null
}

function unauthorized() {
  return {
    ok: false as const,
    response: NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}

function forbidden(message = "Forbidden") {
  return {
    ok: false as const,
    response: NextResponse.json({ error: message }, { status: 403 })
  }
}

async function loadEffectiveRole(user: User): Promise<AppRole | null> {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  const profileRole = normalizeRole((profile as any)?.role)
  if (profileRole) return profileRole

  const appMetaRole = normalizeRole((user.app_metadata as any)?.role)
  if (appMetaRole) return appMetaRole

  const userMetaRole = normalizeRole((user.user_metadata as any)?.role)
  if (userMetaRole) return userMetaRole

  return null
}

async function authenticate(request: Request) {
  const token = extractBearerToken(request)
  if (!token) return unauthorized()

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  const user = data?.user
  if (error || !user) return unauthorized()

  const role = await loadEffectiveRole(user)
  return {
    ok: true as const,
    user,
    role
  }
}

export async function requireRoles(request: Request, allowedRoles: ReadonlyArray<AppRole>) {
  const auth = await authenticate(request)
  if (!auth.ok) return auth

  if (!auth.role || !allowedRoles.includes(auth.role)) {
    return forbidden()
  }

  return {
    ok: true as const,
    user: auth.user,
    role: auth.role
  }
}

export async function requireInterviewer(request: Request) {
  return requireRoles(request, INTERVIEWER_ROLES)
}

export async function requireSessionAccess(request: Request, sessionId: string) {
  const auth = await authenticate(request)
  if (!auth.ok) return auth

  const role = auth.role
  if (role && (INTERVIEWER_ROLES as readonly string[]).includes(role)) {
    return {
      ok: true as const,
      user: auth.user,
      role
    }
  }

  const isCandidateRole = role === "candidate"
  if (!isCandidateRole) {
    return forbidden()
  }

  const { data: session, error: sessionError } = await supabaseAdmin
    .from("interview_sessions")
    .select("id,candidate_id")
    .eq("id", sessionId)
    .maybeSingle()

  if (sessionError || !session?.candidate_id) {
    return forbidden("Session access denied")
  }

  const { data: candidate, error: candidateError } = await supabaseAdmin
    .from("candidates")
    .select("id,email")
    .eq("id", session.candidate_id)
    .maybeSingle()

  if (candidateError || !candidate) {
    return forbidden("Session access denied")
  }

  const userEmail = auth.user.email?.trim().toLowerCase() || null
  const candidateEmail = String(candidate.email || "").trim().toLowerCase() || null
  const metadataCandidateId =
    (auth.user.user_metadata as any)?.candidate_id ||
    (auth.user.app_metadata as any)?.candidate_id ||
    null

  const matchesCandidate =
    (metadataCandidateId && metadataCandidateId === candidate.id) ||
    (userEmail && candidateEmail && userEmail === candidateEmail)

  if (!matchesCandidate) {
    return forbidden("Session access denied")
  }

  return {
    ok: true as const,
    user: auth.user,
    role
  }
}
