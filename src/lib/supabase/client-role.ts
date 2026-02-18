import { supabase } from "@/lib/supabase/client"
import { normalizeRole, type AppRole } from "@/lib/auth/roles"

export async function resolveCurrentUserRole(): Promise<{
  userId: string | null
  email: string | null
  role: AppRole | null
}> {
  const { data: sessionData } = await supabase.auth.getSession()
  const user = sessionData.session?.user || null

  if (!user) {
    return { userId: null, email: null, role: null }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  const role =
    normalizeRole((profile as any)?.role) ||
    normalizeRole((user.app_metadata as any)?.role) ||
    normalizeRole((user.user_metadata as any)?.role) ||
    null

  return {
    userId: user.id,
    email: user.email || null,
    role
  }
}
