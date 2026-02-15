# RBAC Authentication Design
**Date:** 2026-02-14
**Author:** Claude Code
**Status:** Approved

## Context

The AI Interview Platform currently has no authentication system. All routes are publicly accessible, meaning anyone with a session URL can view any interview session. This design document outlines the implementation of role-based access control (RBAC) to secure the application.

### Problem Statement
- No user authentication exists
- All interview sessions are publicly accessible
- No distinction between OneOrigin staff (interviewers) and candidates
- Security risk: anyone can create, view, or modify sessions

### Requirements
1. **OneOrigin staff must authenticate** to access interviewer views and manage sessions
2. **Candidates access anonymously** via unique session URLs (no login required)
3. **Unauthenticated access** to protected routes shows 403 error page
4. Use **Supabase Auth** (already integrated in the project)

### Success Criteria
- Interviewer routes (`/interviewer/*`, `/test`) require authentication
- Protected API endpoints reject unauthenticated requests
- Candidate routes remain fully public (no auth required)
- Clear error handling for unauthorized access

---

## Architecture Overview

### Chosen Approach: Middleware + API Guards

**Three-layer protection:**

1. **Supabase Auth** - Authentication provider using email/password
2. **Next.js Middleware** - Route-level protection at framework level
3. **API Route Guards** - Server-side validation for sensitive endpoints

### Why This Approach?
- Standard Next.js pattern (easy to understand and maintain)
- Fast to implement (2-3 hours)
- Centralized route protection via middleware
- No database schema changes required
- Can add Row Level Security (RLS) later for defense-in-depth

---

## Components

### New Files

#### 1. `src/middleware.ts`
Next.js middleware for route protection.

**Responsibilities:**
- Intercept requests to protected routes
- Validate Supabase session from cookies
- Return 403 for unauthorized access
- Allow public routes to pass through

**Protected Routes:**
- `/interviewer/*` - Interviewer dashboard and session views
- `/test` - Session creation form
- `/api/interviewer/*` - Interviewer-specific API endpoints
- `/api/session/create` - Session creation endpoint

**Public Routes:**
- `/` - Landing page
- `/login` - Login page
- `/signup` - Signup page (if implemented)
- `/unauthorized` - 403 error page
- `/candidate/*` - Candidate interview views
- `/api/artifact/*` - Artifact submission endpoints
- `/api/voice/*` - Voice call endpoints

#### 2. `src/lib/auth/server.ts`
Server-side authentication utilities.

**Functions:**
- `requireAuth()` - Extract authenticated user or throw 401 error
- `getUser()` - Get current user from session (optional check)

**Usage in API routes:**
```typescript
import { requireAuth } from '@/lib/auth/server'

export async function POST(request: Request) {
  const user = await requireAuth(request)
  // user.id, user.email available
  // ... rest of handler
}
```

#### 3. `src/app/login/page.tsx`
Login page with email/password form.

**Features:**
- Email and password inputs
- Form validation
- Error handling (invalid credentials, network errors)
- Calls Supabase Auth `signInWithPassword()`
- No automatic redirect (user navigates manually after login)

#### 4. `src/app/unauthorized/page.tsx`
403 error page for unauthorized access.

**Content:**
- Message: "Access Denied - You must be logged in to view this page"
- Link to `/login`
- Simple styling consistent with app

#### 5. `src/app/signup/page.tsx` (Optional)
Self-service registration page.

**Features:**
- Email/password signup form
- Email confirmation flow
- Only if you want users to self-register (vs. admin-created accounts)

### Modified Files

#### 1. `src/lib/supabase/client.ts`
No changes needed - already configured for auth.

#### 2. `src/lib/supabase/server.ts`
Add helper functions:
- `getSession()` - Extract session from request cookies
- `getUser()` - Get authenticated user from session

#### 3. Protected API Routes
Add `requireAuth()` call at the top of handler:

**Routes to protect:**
- `src/app/api/session/create/route.ts` - Only authenticated users can create sessions
- `src/app/api/interviewer/sessions/route.ts` - List sessions for authenticated interviewer
- `src/app/api/interviewer/action/route.ts` - Record interviewer actions
- `src/app/api/session/[id]/terminate/route.ts` - Only interviewer can terminate

**Routes to keep public:**
- `src/app/api/artifact/submit/route.ts` - Candidates submit anonymously
- `src/app/api/voice/*` - Voice interaction endpoints
- `src/app/api/ai/*` - AI chat and assessment endpoints (used by candidates)

---

## Data Flow

### Login Flow
```
1. User visits /login
2. Enters email/password
3. Supabase Auth validates credentials
4. Session token stored in HTTP-only cookie
5. User navigates to /interviewer (middleware allows access)
```

### Protected Route Access (Interviewer)
```
1. User requests /interviewer/[sessionId]
2. Middleware intercepts request
3. Reads session cookie → validates with Supabase
4. If valid: request proceeds to page
5. If invalid: return 403 → redirect to /unauthorized
```

### Protected API Access
```
1. Client calls POST /api/session/create
2. API route calls requireAuth()
3. requireAuth() extracts user from session cookie
4. If no user: throw 401 Unauthorized
5. If valid: proceed with request
   - Optionally store user.id in interviewer_user_id field
```

### Public Candidate Flow (Unchanged)
```
1. Candidate receives URL: /candidate/abc-123-xyz
2. Opens URL (no auth required)
3. Page loads, fetches session data via API
4. Real-time updates work via Supabase subscriptions (anon key)
5. Submits artifacts via public API endpoints
```

### Session Cookie Details
- **Name:** `sb-<project-ref>-auth-token` (Supabase default)
- **HTTP-only:** Yes (not accessible via JavaScript)
- **Secure:** Yes (HTTPS only in production)
- **SameSite:** Lax (CSRF protection)
- **Lifetime:** 1 hour (refreshed automatically by Supabase)

---

## Error Handling

### Middleware (Route-level)
- **No session found** → `NextResponse.redirect('/unauthorized')` with 403 status
- **Invalid/expired session** → Same as no session
- **Supabase error** → Log error, return 403 (fail closed for security)

### API Routes
- **`requireAuth()` fails** → Return `{ error: 'Unauthorized' }` with 401 status
- **User object missing** → Return `{ error: 'Authentication required' }` with 401
- **Expired session during API call** → Client receives 401, should prompt re-login

### Login Page
- **Invalid credentials** → Show error: "Invalid email or password"
- **Network error** → Show: "Unable to connect. Please try again."
- **Email not confirmed** → Show: "Please check your email to confirm your account"

### Unauthorized Page (`/unauthorized`)
- Display message: "Access Denied - You must be logged in to view this page"
- Show link to `/login`
- Use simple styling consistent with existing app design

### Client-side Handling
- API calls returning 401 → Show toast/alert: "Session expired. Please log in again."
- No automatic redirect on 401 (user manually navigates to /login)

---

## Testing & Verification

### Manual Testing Steps

#### 1. Test Unauthenticated Access
- Visit `/interviewer` without logging in → Should see 403 unauthorized page
- Visit `/test` without logging in → Should see 403 unauthorized page
- Visit `/candidate/[sessionId]` → Should load normally (no auth required)

#### 2. Test Login Flow
- Visit `/login`
- Enter valid credentials → Should authenticate successfully
- Visit `/interviewer` → Should now have access

#### 3. Test Protected API Endpoints
- Call `POST /api/session/create` without auth → Should return 401
- Login first, then call endpoint → Should return 200 with session data

#### 4. Test Session Persistence
- Login → Close browser → Reopen → Should still be authenticated (cookie persists)
- Wait for session expiry (1 hour) → Should require re-login

#### 5. Test Candidate Flow (Unchanged)
- Without logging in, visit candidate URL
- Submit artifacts, interact with AI → Should work normally

### Verification Checklist
- ✅ Middleware blocks `/interviewer/*` routes when not authenticated
- ✅ Middleware blocks `/test` when not authenticated
- ✅ Protected API routes return 401 without valid session
- ✅ Login page successfully authenticates users
- ✅ Unauthorized page displays properly
- ✅ Candidate routes remain fully public
- ✅ Session cookies are HTTP-only and secure

---

## Future Enhancements (Out of Scope)

1. **Row Level Security (RLS)** - Add Supabase RLS policies for database-level protection
2. **Role Management** - Add explicit role field if more than "interviewer" role is needed
3. **OAuth Providers** - Add Google/GitHub login options
4. **Session Management** - Add logout functionality, session viewer
5. **Admin Dashboard** - Create/manage user accounts, assign roles
6. **Audit Logging** - Log all authentication events for security monitoring

---

## Critical Files

### Files to Create
1. `src/middleware.ts` - Route protection middleware
2. `src/lib/auth/server.ts` - Server-side auth utilities
3. `src/app/login/page.tsx` - Login page
4. `src/app/unauthorized/page.tsx` - 403 error page
5. `src/app/signup/page.tsx` - Signup page (optional)

### Files to Modify
1. `src/lib/supabase/server.ts` - Add session/user helpers
2. `src/app/api/session/create/route.ts` - Add auth guard
3. `src/app/api/interviewer/sessions/route.ts` - Add auth guard
4. `src/app/api/interviewer/action/route.ts` - Add auth guard
5. `src/app/api/session/[id]/terminate/route.ts` - Add auth guard

### No Changes Required
- `src/lib/supabase/client.ts` - Already configured
- Database schema - No changes needed initially
- Candidate-facing pages and APIs - Remain public

---

## Implementation Notes

### Supabase Auth Configuration
- Email/password auth should be enabled in Supabase dashboard
- Email confirmation can be optional or required (configure in Supabase)
- No custom user metadata needed initially (all authed users = interviewers)

### Middleware Configuration
- Use `matcher` config in middleware.ts to specify protected routes
- Avoid matching static assets (/_next/*, /favicon.ico, etc.)
- Use Next.js 15 middleware best practices

### Security Best Practices
- Never expose service role key to client
- Always use HTTP-only cookies for sessions
- Validate user on server side (never trust client)
- Log authentication failures for monitoring
- Use HTTPS in production (required for secure cookies)

---

## Rollout Strategy

### Phase 1: Core Auth (This Design)
1. Implement Supabase Auth setup
2. Create middleware for route protection
3. Add API route guards
4. Create login/unauthorized pages
5. Test thoroughly in development

### Phase 2: Production Deployment
1. Create initial admin user accounts in Supabase
2. Deploy to staging environment
3. Test all flows end-to-end
4. Deploy to production
5. Monitor authentication logs

### Phase 3: Enhancements (Future)
1. Add Row Level Security policies
2. Implement OAuth providers
3. Build admin user management UI
4. Add session management features
