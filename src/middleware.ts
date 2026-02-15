import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseMiddlewareClient } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request })
  const supabase = createSupabaseMiddlewareClient(request, response)
  const pathname = request.nextUrl.pathname

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  const isInterviewerRoute = pathname.startsWith('/interviewer')
  const isCandidateRoute = pathname.startsWith('/candidate')

  // No authenticated user — redirect to appropriate login
  if (error || !user) {
    if (isInterviewerRoute) {
      return NextResponse.redirect(new URL('/interviewer/login', request.url))
    }
    if (isCandidateRoute) {
      const loginUrl = new URL('/candidate/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
    return response
  }

  // Candidate-specific checks
  if (isCandidateRoute) {
    // Check 2-hour expiry from user_metadata
    const expiresAt = user.user_metadata?.expires_at
    if (expiresAt && new Date(expiresAt) < new Date()) {
      await supabase.auth.signOut()
      const loginUrl = new URL('/candidate/login', request.url)
      loginUrl.searchParams.set('error', 'session_expired')
      return NextResponse.redirect(loginUrl)
    }

    // Verify session ID in URL matches the one in user_metadata
    const pathSessionId = pathname.split('/')[2]
    const metaSessionId = user.user_metadata?.session_id
    if (metaSessionId && pathSessionId && metaSessionId !== pathSessionId) {
      return NextResponse.redirect(
        new URL('/candidate/login?error=wrong_session', request.url)
      )
    }
  }

  return response
}

export const config = {
  matcher: ['/interviewer/((?!login).*)', '/candidate/((?!login).*)'],
}
