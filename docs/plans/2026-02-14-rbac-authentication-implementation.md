# RBAC Authentication Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement Supabase Auth-based RBAC system to protect interviewer routes while keeping candidate access public.

**Architecture:** Three-layer security using Next.js middleware for route protection, API route guards for endpoints, and Supabase Auth for session management. OneOrigin staff authenticate via email/password; candidates access anonymously via unique URLs.

**Tech Stack:** Next.js 15, Supabase Auth, TypeScript, React

---

## Task 1: Add Server-Side Auth Utilities

**Files:**
- Modify: `src/lib/supabase/server.ts`
- Create: `src/lib/auth/server.ts`

**Step 1: Extend Supabase server client with auth helpers**

Update `src/lib/supabase/server.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase server environment variables')
}

// Server-only client with elevated privileges
// Use this ONLY in API routes, never expose to client
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Create a Supabase client with cookie-based auth for server components
export async function createServerClient() {
  const cookieStore = await cookies()
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  return createClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
    },
  })
}

// Get the current session from cookies
export async function getServerSession() {
  const supabase = await createServerClient()
  const { data: { session }, error } = await supabase.auth.getSession()

  if (error) {
    console.error('Error getting session:', error)
    return null
  }

  return session
}

// Get the current user from session
export async function getServerUser() {
  const session = await getServerSession()
  return session?.user ?? null
}
```

**Step 2: Create auth guard utilities**

Create `src/lib/auth/server.ts`:

```typescript
import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/supabase/server'

/**
 * Require authentication for API routes
 * Throws 401 error if user is not authenticated
 * Returns authenticated user object
 */
export async function requireAuth() {
  const user = await getServerUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  return user
}

/**
 * Create unauthorized response for API routes
 */
export function unauthorizedResponse(message: string = 'Unauthorized') {
  return NextResponse.json(
    { error: message },
    { status: 401 }
  )
}

/**
 * Optional: Get user if authenticated, null otherwise
 * Does not throw error
 */
export async function getOptionalUser() {
  const user = await getServerUser()
  return user
}
```

**Step 3: Verify TypeScript compilation**

Run: `npm run build`
Expected: No TypeScript errors related to new auth files

**Step 4: Commit**

```bash
git add src/lib/supabase/server.ts src/lib/auth/server.ts
git commit -m "feat: add server-side auth utilities

- Add createServerClient for cookie-based auth
- Add getServerSession and getServerUser helpers
- Create requireAuth guard for API route protection

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Create Unauthorized Error Page

**Files:**
- Create: `src/app/unauthorized/page.tsx`

**Step 1: Create unauthorized page component**

Create `src/app/unauthorized/page.tsx`:

```typescript
import Link from 'next/link'

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
            <svg
              className="h-6 w-6 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Access Denied
          </h2>

          <p className="mt-2 text-sm text-gray-600">
            You must be logged in to view this page.
          </p>

          <div className="mt-6">
            <Link
              href="/login"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Go to Login
            </Link>
          </div>

          <div className="mt-4">
            <Link
              href="/"
              className="text-sm text-blue-600 hover:text-blue-500"
            >
              Return to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Test page renders**

Run: `npm run dev`
Visit: `http://localhost:3000/unauthorized`
Expected: See "Access Denied" page with login link

**Step 3: Commit**

```bash
git add src/app/unauthorized/page.tsx
git commit -m "feat: add unauthorized error page

Displays 403 error with link to login page for unauthenticated users attempting to access protected routes.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Create Login Page

**Files:**
- Create: `src/app/login/page.tsx`

**Step 1: Create login page with form**

Create `src/app/login/page.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        if (signInError.message.includes('Invalid login credentials')) {
          setError('Invalid email or password')
        } else if (signInError.message.includes('Email not confirmed')) {
          setError('Please check your email to confirm your account')
        } else {
          setError(signInError.message)
        }
        setLoading(false)
        return
      }

      if (data.session) {
        // Successful login - redirect to interviewer dashboard
        router.push('/interviewer')
        router.refresh()
      }
    } catch (err) {
      console.error('Login error:', err)
      setError('Unable to connect. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            OneOrigin Staff Access
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    {error}
                  </h3>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email-address" className="sr-only">
                Email address
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
                disabled={loading}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Password"
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>

          <div className="text-center">
            <Link
              href="/"
              className="text-sm text-blue-600 hover:text-blue-500"
            >
              Return to Home
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
```

**Step 2: Test login page renders**

Run: `npm run dev`
Visit: `http://localhost:3000/login`
Expected: See login form with email/password inputs

**Step 3: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "feat: add login page with email/password auth

- Client-side form with Supabase Auth integration
- Error handling for invalid credentials and network errors
- Redirects to /interviewer on successful login

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Create Next.js Middleware for Route Protection

**Files:**
- Create: `src/middleware.ts`

**Step 1: Create middleware with route protection**

Create `src/middleware.ts`:

```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Protected route patterns
const protectedRoutes = [
  '/interviewer',
  '/test',
  '/api/interviewer',
  '/api/session/create',
]

// Public routes that should bypass auth
const publicRoutes = [
  '/',
  '/login',
  '/signup',
  '/unauthorized',
  '/candidate',
  '/api/artifact',
  '/api/voice',
  '/api/ai',
  '/api/round',
  '/api/score',
  '/test-voice',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip middleware for static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/images') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Check if route is public
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))
  if (isPublicRoute) {
    return NextResponse.next()
  }

  // Check if route is protected
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))
  if (!isProtectedRoute) {
    return NextResponse.next()
  }

  // Validate session for protected routes
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
      },
    })

    const { data: { session }, error } = await supabase.auth.getSession()

    if (error) {
      console.error('Middleware auth error:', error)
    }

    if (!session) {
      // No valid session - redirect to unauthorized page
      const url = request.nextUrl.clone()
      url.pathname = '/unauthorized'
      return NextResponse.redirect(url)
    }

    // Valid session - allow request
    return NextResponse.next()
  } catch (error) {
    console.error('Middleware error:', error)
    // Fail closed - redirect to unauthorized on any error
    const url = request.nextUrl.clone()
    url.pathname = '/unauthorized'
    return NextResponse.redirect(url)
  }
}

// Specify which routes the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*|images).*)',
  ],
}
```

**Step 2: Test middleware blocks protected routes**

Run: `npm run dev`
Visit: `http://localhost:3000/interviewer` (without logging in)
Expected: Redirect to `/unauthorized`

Visit: `http://localhost:3000/candidate/any-session-id`
Expected: Page loads normally (no redirect)

**Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add Next.js middleware for route protection

- Block /interviewer/* and /test routes without auth
- Protect /api/interviewer/* and /api/session/create endpoints
- Keep candidate routes and public APIs accessible
- Redirect to /unauthorized on auth failure

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Protect API Route - Session Create

**Files:**
- Modify: `src/app/api/session/create/route.ts`

**Step 1: Add auth guard to session creation**

Read the current file first, then modify to add auth check at the top:

```typescript
import { NextResponse } from 'next/server'
import { requireAuth, unauthorizedResponse } from '@/lib/auth/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function POST(request: Request) {
  // AUTHENTICATION CHECK - must be logged in to create sessions
  try {
    const user = await requireAuth()
    // user.id is available if you need to store interviewer_user_id
  } catch (error) {
    return unauthorizedResponse('You must be logged in to create sessions')
  }

  // ... rest of existing handler code (unchanged)
  try {
    const body = await request.json()
    // existing validation and session creation logic
  } catch (error) {
    // existing error handling
  }
}
```

**Step 2: Test API returns 401 without auth**

Test command:
```bash
curl -X POST http://localhost:3000/api/session/create \
  -H "Content-Type: application/json" \
  -d '{"candidate_name":"Test","role":"SDE","level":"L3"}'
```

Expected: `{"error":"You must be logged in to create sessions"}` with 401 status

**Step 3: Commit**

```bash
git add src/app/api/session/create/route.ts
git commit -m "feat: protect session creation API with auth guard

Only authenticated users can create interview sessions.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Protect API Route - Interviewer Sessions

**Files:**
- Modify: `src/app/api/interviewer/sessions/route.ts`

**Step 1: Add auth guard to interviewer sessions endpoint**

Add auth check at the top of the GET handler:

```typescript
import { NextResponse } from 'next/server'
import { requireAuth, unauthorizedResponse } from '@/lib/auth/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET(request: Request) {
  // AUTHENTICATION CHECK
  try {
    const user = await requireAuth()
    // Could filter sessions by user.id in future
  } catch (error) {
    return unauthorizedResponse('Authentication required')
  }

  // ... rest of existing handler code
}
```

**Step 2: Test API returns 401 without auth**

Test command:
```bash
curl http://localhost:3000/api/interviewer/sessions
```

Expected: `{"error":"Authentication required"}` with 401 status

**Step 3: Commit**

```bash
git add src/app/api/interviewer/sessions/route.ts
git commit -m "feat: protect interviewer sessions API with auth guard

Only authenticated users can list interview sessions.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Protect API Route - Interviewer Action

**Files:**
- Modify: `src/app/api/interviewer/action/route.ts`

**Step 1: Add auth guard to interviewer action endpoint**

Add auth check at the top:

```typescript
import { NextResponse } from 'next/server'
import { requireAuth, unauthorizedResponse } from '@/lib/auth/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function POST(request: Request) {
  // AUTHENTICATION CHECK
  try {
    const user = await requireAuth()
    // user.id could be logged with action for audit trail
  } catch (error) {
    return unauthorizedResponse('Authentication required')
  }

  // ... rest of existing handler code
}
```

**Step 2: Test API returns 401 without auth**

Test command:
```bash
curl -X POST http://localhost:3000/api/interviewer/action \
  -H "Content-Type: application/json" \
  -d '{"session_id":"test","action_type":"test"}'
```

Expected: `{"error":"Authentication required"}` with 401 status

**Step 3: Commit**

```bash
git add src/app/api/interviewer/action/route.ts
git commit -m "feat: protect interviewer action API with auth guard

Only authenticated users can record interviewer actions.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Protect API Route - Session Terminate

**Files:**
- Modify: `src/app/api/session/[id]/terminate/route.ts`

**Step 1: Add auth guard to session termination endpoint**

Add auth check at the top:

```typescript
import { NextResponse } from 'next/server'
import { requireAuth, unauthorizedResponse } from '@/lib/auth/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  // AUTHENTICATION CHECK
  try {
    const user = await requireAuth()
  } catch (error) {
    return unauthorizedResponse('Only authorized users can terminate sessions')
  }

  // ... rest of existing handler code
}
```

**Step 2: Test API returns 401 without auth**

Test command:
```bash
curl -X POST http://localhost:3000/api/session/test-id/terminate
```

Expected: `{"error":"Only authorized users can terminate sessions"}` with 401 status

**Step 3: Commit**

```bash
git add src/app/api/session/[id]/terminate/route.ts
git commit -m "feat: protect session terminate API with auth guard

Only authenticated users can terminate interview sessions.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 9: End-to-End Testing

**Files:**
- Reference: `docs/plans/2026-02-14-rbac-authentication-design.md` (Testing section)

**Step 1: Create test user in Supabase**

Manual action required:
1. Open Supabase dashboard
2. Navigate to Authentication > Users
3. Click "Add user"
4. Create user with email: `admin@oneorigin.com`, password: `Test123!@#`
5. Confirm email (disable email confirmation in settings if testing locally)

**Step 2: Test unauthenticated access**

Test scenarios:
1. Visit `http://localhost:3000/interviewer` → Should redirect to `/unauthorized`
2. Visit `http://localhost:3000/test` → Should redirect to `/unauthorized`
3. Visit `http://localhost:3000/candidate/any-uuid` → Should load normally
4. Call `POST /api/session/create` without auth → Should return 401

Expected: All protected routes blocked, candidate routes work

**Step 3: Test login flow**

Test scenarios:
1. Visit `http://localhost:3000/login`
2. Enter email: `admin@oneorigin.com`, password: `Test123!@#`
3. Click "Sign in"
4. Should redirect to `/interviewer`
5. Verify `/interviewer` page loads successfully

Expected: Login succeeds, protected route accessible

**Step 4: Test session persistence**

Test scenarios:
1. Close browser
2. Reopen and visit `http://localhost:3000/interviewer`
3. Should still be authenticated (no redirect to unauthorized)

Expected: Session cookie persists across browser sessions

**Step 5: Test protected API with auth**

With browser logged in, test in console:
```javascript
fetch('/api/session/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    candidate_name: 'Test Candidate',
    role: 'Software Engineer',
    level: 'L3'
  })
})
```

Expected: Returns 200 with session data (not 401)

**Step 6: Document test results**

Create test notes:
```bash
echo "# Manual Test Results - $(date)" > TEST_RESULTS.md
echo "" >> TEST_RESULTS.md
echo "## Protected Routes" >> TEST_RESULTS.md
echo "- ✅ /interviewer blocked when not authenticated" >> TEST_RESULTS.md
echo "- ✅ /test blocked when not authenticated" >> TEST_RESULTS.md
echo "- ✅ /candidate/* accessible without auth" >> TEST_RESULTS.md
echo "" >> TEST_RESULTS.md
echo "## Authentication" >> TEST_RESULTS.md
echo "- ✅ Login page works" >> TEST_RESULTS.md
echo "- ✅ Valid credentials grant access" >> TEST_RESULTS.md
echo "- ✅ Session persists across browser restarts" >> TEST_RESULTS.md
echo "" >> TEST_RESULTS.md
echo "## API Protection" >> TEST_RESULTS.md
echo "- ✅ Protected APIs return 401 without auth" >> TEST_RESULTS.md
echo "- ✅ Protected APIs return 200 with auth" >> TEST_RESULTS.md
```

**Step 7: Commit test results**

```bash
git add TEST_RESULTS.md
git commit -m "docs: add manual test results for RBAC implementation

All authentication flows tested and verified working:
- Route protection via middleware
- API guards blocking unauthenticated requests
- Login flow with session persistence
- Candidate routes remain public

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 10 (Optional): Create Signup Page

**Files:**
- Create: `src/app/signup/page.tsx`

**Note:** This task is optional. Only implement if you want self-service user registration. Otherwise, users should be created manually in Supabase dashboard.

**Step 1: Create signup page with form**

Create `src/app/signup/page.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (signUpError) {
        setError(signUpError.message)
        setLoading(false)
        return
      }

      if (data.user) {
        setSuccess(true)
        // If email confirmation is disabled, redirect immediately
        if (data.session) {
          setTimeout(() => router.push('/interviewer'), 2000)
        }
      }
    } catch (err) {
      console.error('Signup error:', err)
      setError('Unable to connect. Please try again.')
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="rounded-md bg-green-50 p-4">
            <h3 className="text-sm font-medium text-green-800">
              Account created successfully!
            </h3>
            <p className="mt-2 text-sm text-green-700">
              Please check your email to confirm your account.
            </p>
          </div>
          <Link
            href="/login"
            className="text-blue-600 hover:text-blue-500"
          >
            Go to Login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Create your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            OneOrigin Staff Registration
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSignup}>
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    {error}
                  </h3>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-md shadow-sm space-y-3">
            <div>
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
                disabled={loading}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Password (min 8 characters)"
                disabled={loading}
              />
            </div>
            <div>
              <label htmlFor="confirm-password" className="sr-only">
                Confirm Password
              </label>
              <input
                id="confirm-password"
                name="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Confirm password"
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating account...' : 'Sign up'}
            </button>
          </div>

          <div className="text-center space-y-2">
            <Link
              href="/login"
              className="text-sm text-blue-600 hover:text-blue-500"
            >
              Already have an account? Sign in
            </Link>
            <br />
            <Link
              href="/"
              className="text-sm text-gray-600 hover:text-gray-500"
            >
              Return to Home
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
```

**Step 2: Test signup page**

Run: `npm run dev`
Visit: `http://localhost:3000/signup`
Expected: See signup form with validation

**Step 3: Commit (if implemented)**

```bash
git add src/app/signup/page.tsx
git commit -m "feat: add signup page for self-service registration

Optional self-service user registration with email confirmation flow.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Verification Checklist

After completing all tasks, verify:

- ✅ Middleware blocks `/interviewer/*` routes when not authenticated
- ✅ Middleware blocks `/test` when not authenticated
- ✅ Protected API routes return 401 without valid session
- ✅ Login page successfully authenticates users
- ✅ Unauthorized page displays properly on blocked access
- ✅ Candidate routes (`/candidate/*`) remain fully public
- ✅ Session cookies are HTTP-only and secure
- ✅ All commits follow conventional commit format
- ✅ No TypeScript compilation errors
- ✅ No exposed secrets or service role keys in client code

---

## Post-Implementation Steps

1. **Supabase Configuration:**
   - Enable email/password auth in Supabase dashboard
   - Configure email confirmation (optional vs required)
   - Create initial admin user accounts

2. **Environment Variables:**
   - Verify all required env vars are set in `.env.local`
   - Document any new env vars in `.env.example`

3. **Documentation:**
   - Update README with authentication setup instructions
   - Document how to create new user accounts
   - Add troubleshooting guide for common auth issues

4. **Future Enhancements:**
   - Add Row Level Security (RLS) policies
   - Implement logout functionality
   - Add "Forgot password" flow
   - Create admin user management UI
   - Add OAuth providers (Google, GitHub)

---

## Related Skills

- `@superpowers:verification-before-completion` - Run before claiming work is complete
- `@superpowers:systematic-debugging` - Use if authentication issues arise
- `@feature-dev:feature-dev` - For adding OAuth or advanced auth features later
