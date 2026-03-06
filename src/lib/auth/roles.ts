export const ADMIN_ROLES = ["admin"] as const

export const INTERVIEWER_ROLES = [
  "admin",
  "hiring_lead",
  "recruiter",
  "interviewer"
] as const

export const CANDIDATE_ROLES = ["candidate"] as const

export type AppRole =
  | (typeof ADMIN_ROLES)[number]
  | (typeof INTERVIEWER_ROLES)[number]
  | (typeof CANDIDATE_ROLES)[number]

export function normalizeRole(role: unknown): AppRole | null {
  if (typeof role !== "string") return null
  const lowered = role.trim().toLowerCase()

  if ((INTERVIEWER_ROLES as readonly string[]).includes(lowered)) {
    return lowered as AppRole
  }

  if ((CANDIDATE_ROLES as readonly string[]).includes(lowered)) {
    return lowered as AppRole
  }

  return null
}

export function isInterviewerRole(role: unknown): boolean {
  const normalized = normalizeRole(role)
  return !!normalized && (INTERVIEWER_ROLES as readonly string[]).includes(normalized)
}

export function isAdminRole(role: unknown): boolean {
  const normalized = normalizeRole(role)
  return normalized === "admin"
}
