# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI-powered interview platform built with Next.js 15 for conducting structured role-based assessments with real-time monitoring, AI assistance, and automated scoring. Features live persona interactions, multi-round workflows, and comprehensive audit trails.

## Development Commands

```bash
# Development
npm install          # Install dependencies (npm is the package manager, though pnpm-lock.yaml exists)
npm run dev          # Start dev server → http://localhost:3000

# Production
npm run build        # Production build
npm start            # Start production server

# Testing
npm run lint         # Run ESLint
```

## Environment Configuration

Required environment variables in `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key (client-side safe)
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (server-side only, full privileges)
- `OPENAI_API_KEY` - OpenAI API key for GPT-4o
- `NEXT_PUBLIC_APP_URL` - Application base URL

Copy from `.env.example` to get started.

## Architecture

### Path Aliases

- `@/*` maps to `src/*` (configured in [tsconfig.json:19](tsconfig.json#L19))

### Core Data Flow

1. **Session Creation**: `job_profile` → `candidate` → `interview_session` → `interview_scope_package` (contains round plan)
2. **Round Execution**: Rounds stored as JSONB array in `interview_scope_packages.round_plan`, status updated in place
3. **Real-time Sync**: 5 Supabase channels per session (session, scope, scores, events, artifacts)
4. **Scoring**: Background AI evaluation triggered on round completion, evidence-based with quote extraction

### Real-time System

The `useRealtimeSession` hook ([src/hooks/useRealtimeSession.ts](src/hooks/useRealtimeSession.ts)) subscribes to 4 Postgres change streams:
- `interview_sessions` - Session status updates
- `interview_scope_packages` - Round plan mutations (status, timestamps)
- `scores` - New scoring results
- `live_events` - Audit log entries

Updates propagate instantly to both candidate and interviewer views without polling.

### Round Lifecycle

Rounds are NOT separate rows - they exist as objects in the `round_plan` JSONB array:

```typescript
{
  round_number: 1,
  round_type: 'voice' | 'email' | 'text' | 'code',
  title: string,
  prompt: string,
  duration_minutes: number,
  status: 'pending' | 'active' | 'completed' | 'skipped',
  started_at: string | null,
  completed_at: string | null,
  config: Record<string, any>
}
```

To update a round's status:
1. Fetch current `interview_scope_packages` row
2. Mutate the `round_plan` array
3. Update the entire JSONB column (Supabase real-time will propagate)

See [src/app/api/round/start/route.ts](src/app/api/round/start/route.ts) for implementation pattern.

### Client Components

All interactive UI must use `"use client"` directive (Next.js 15 App Router default is server components). Key client components:
- `SessionProvider` - Wraps pages with real-time session data via Context
- Round UIs (`VoiceCallUI`, `EmailThreadUI`, `TextResponseUI`) - Handle user interactions
- `SidekickPanel` - AI assistant with policy enforcement

### AI Systems

**Sidekick (AI Assistant)**
- Policy-defined capabilities per track ([src/lib/ai/sidekick-policy.ts](src/lib/ai/sidekick-policy.ts))
- Server-side enforcement of restrictions (no complete answers, outline guidance only)
- 6 query limit per session
- Route: `/api/ai/chat`

**AI Prospect (Persona Simulation)**
- Simulated buyer with configurable objections and curveballs
- Route: `/api/ai/prospect`

**Scoring Engine**
- Evidence-based evaluation with quote extraction ([src/lib/ai/score-smith.ts](src/lib/ai/score-smith.ts))
- Dimension scores + overall + recommendation (proceed/caution/stop)
- Triggered via `/api/score/trigger`, runs async
- Results saved to `scores` table with real-time propagation

### Database Patterns

**Audit Everything**: All significant actions log to `live_events` table:
```typescript
await supabaseAdmin.from('live_events').insert({
  session_id: string,
  event_type: string,  // 'round_started', 'artifact_submitted', etc.
  payload: Record<string, any>
})
```

**Service Role vs Anon Key**:
- Client-side: Use `supabase` from [src/lib/supabase/client.ts](src/lib/supabase/client.ts) (anon key, RLS-enforced)
- Server-side API routes: Use `supabaseAdmin` from [src/lib/supabase/server.ts](src/lib/supabase/server.ts) (service role, bypasses RLS)

**No Direct Database Queries in Components**: Components only call API routes or use real-time subscriptions. All mutations go through `/api/*` endpoints.

## API Route Conventions

- All routes return JSON with `NextResponse.json()`
- Input validation happens at route entry
- Use try/catch with descriptive error messages
- Log errors with `console.error()` before returning 500
- Return created entities in response body for client-side updates

## Adding a New Round Type

1. Add type to `RoundType` union in [src/lib/types/database.ts](src/lib/types/database.ts)
2. Create UI component in `src/components/rounds/{RoundName}UI.tsx`
3. Register in `TaskSurface.tsx` switch statement
4. Update session creation in [src/app/api/session/create/route.ts](src/app/api/session/create/route.ts) to include in `round_plan`
5. Update scoring rubrics in [src/lib/ai/score-smith.ts](src/lib/ai/score-smith.ts) if needed

## TypeScript Configuration

- **Strict mode enabled** - no `any` types allowed (except in explicit error handling)
- **No allowJs** - TypeScript only
- **Target**: ES2020
- **Module resolution**: bundler (Next.js default)

## Common Patterns

**Fetching Session Data**:
```typescript
// Use the context in pages
const { session, rounds, currentRound, scores, events, loading } = useSession()
```

**Updating Round Status**:
```typescript
// In API route
const { data: pkg } = await supabaseAdmin
  .from('interview_scope_packages')
  .select('*')
  .eq('session_id', sessionId)
  .single()

const updatedRounds = pkg.round_plan.map(r =>
  r.round_number === roundNumber
    ? { ...r, status: 'active', started_at: new Date().toISOString() }
    : r
)

await supabaseAdmin
  .from('interview_scope_packages')
  .update({ round_plan: updatedRounds })
  .eq('id', pkg.id)
```

## Testing Strategy

No formal test framework configured. Test manually via:
1. `/test` page for session creation
2. Open candidate view and interviewer view in separate tabs
3. Verify real-time updates propagate across tabs
4. Check browser console for WebSocket connection status
5. Monitor Network tab for API call responses
