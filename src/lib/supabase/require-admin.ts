import { requireRoles } from "@/lib/supabase/require-role"

export async function requireAdmin(request: Request) {
  return requireRoles(request, ["admin"])
}
