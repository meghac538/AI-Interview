# Change Tracking Log

## 2026-02-16
- Source branch: `main`
- Working branch context: local unmerged updates on `main` (ahead of `origin/main`)

### Scope
- Added role-gated Google OAuth entry points for interviewer and admin access.
- Added API role guards for interviewer/admin endpoints and session access enforcement for candidate vs staff.
- Added admin deployment configuration APIs and interviewer deployment trigger APIs.
- Added interviewer-side agent deployment panel UI for per-session webhook/API launches.
- Added Supabase migration for `session_agent_deployments` and webhook deployment metadata columns.
- Updated interviewer flows to send bearer-authenticated API requests.

### Files added
- `/Users/abhinandchincholi/ai-interview/src/app/interviewer/login/page.tsx`
- `/Users/abhinandchincholi/ai-interview/src/app/admin/login/page.tsx`
- `/Users/abhinandchincholi/ai-interview/src/app/auth/callback/page.tsx`
- `/Users/abhinandchincholi/ai-interview/src/app/api/admin/agent-deployments/route.ts`
- `/Users/abhinandchincholi/ai-interview/src/app/api/interviewer/deployments/route.ts`
- `/Users/abhinandchincholi/ai-interview/src/lib/auth/roles.ts`
- `/Users/abhinandchincholi/ai-interview/src/lib/supabase/authed-fetch.ts`
- `/Users/abhinandchincholi/ai-interview/src/lib/supabase/client-role.ts`
- `/Users/abhinandchincholi/ai-interview/src/lib/supabase/require-role.ts`
- `/Users/abhinandchincholi/ai-interview/supabase/migrations/20260216163000_agent_deployment_configs.sql`

### Notes
- Supabase CLI migration push is pending because provided access token returns `Unauthorized` during `supabase link`.

## 2026-02-17
- Source branch: `main`
- Working branch context: local `main` recovery actions for localhost runtime stability

### Scope
- Captured localhost runtime baseline and confirmed broken `3000` state (`missing required error components` fallback).
- Performed hard reset of stale Next.js dev processes and restored a single canonical server on `http://localhost:3000`.
- Executed deterministic smoke verification for public routes, protected APIs, and critical static assets.
- Added reusable npm scripts for clean dev startup/reset on port `3000`.
- Validated Supabase schema compatibility for session creation and deployment tables.
- Re-tested session creation API with live payload; session creation now succeeds.

### Files updated
- `/Users/abhinandchincholi/ai-interview/package.json`

### Notes
- `job_profiles.experience_years_max` exists on remote and no longer blocks session creation.
- Remote schema is still missing deployment objects:
  - `webhook_configs.http_method` column
  - `session_agent_deployments` table
- Supabase CLI project auth still returns `Unauthorized` with provided PAT, so migration deployment remains blocked until a valid PAT is provided.
