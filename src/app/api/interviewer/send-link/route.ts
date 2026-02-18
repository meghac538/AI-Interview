import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { requireInterviewer } from '@/lib/supabase/require-role'

export async function POST(request: Request) {
  try {
    const gate = await requireInterviewer(request)
    if (!gate.ok) return gate.response

    const { session_id } = await request.json()

    if (!session_id) {
      return NextResponse.json({ error: 'Missing required field: session_id' }, { status: 400 })
    }

    const { data: session, error: sessionError } = await supabaseAdmin
      .from('interview_sessions')
      .select('id,candidate_id,status')
      .eq('id', session_id)
      .single()

    if (sessionError) throw sessionError

    if (!session?.candidate_id) {
      return NextResponse.json({ error: 'Session has no linked candidate.' }, { status: 400 })
    }

    const { data: candidate, error: candidateError } = await supabaseAdmin
      .from('candidates')
      .select('id,name,email')
      .eq('id', session.candidate_id)
      .single()

    if (candidateError) throw candidateError

    const email = String(candidate?.email || '').trim().toLowerCase()
    if (!email) {
      return NextResponse.json({ error: 'Candidate email is missing.' }, { status: 400 })
    }

    // Prefer the request URL origin so local dev ports (3000 vs 3001) and deploy previews work
    // even when the `Origin` header is not present (e.g. some proxies/clients).
    const requestUrl = new URL(request.url)
    const forwardedHost = request.headers.get('x-forwarded-host')
    const forwardedProto = request.headers.get('x-forwarded-proto')
    const baseUrl =
      forwardedHost
        ? `${forwardedProto || requestUrl.protocol.replace(':', '')}://${forwardedHost}`
        : requestUrl.origin || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const redirectTo = `${baseUrl}/candidate/login?session=${session.id}`

    let generatedLink:
      | {
          action_link?: string
          email_otp?: string
          hashed_token?: string
          verification_type?: string
        }
      | undefined

    const firstAttempt = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo }
    })

    if (firstAttempt.error) {
      const message = firstAttempt.error.message || ''
      const shouldCreateUser = /user not found|invalid email/i.test(message)

      if (!shouldCreateUser) {
        throw firstAttempt.error
      }

      const createUserResult = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          role: 'candidate',
          candidate_id: candidate.id,
          candidate_name: candidate.name || null
        }
      })

      if (createUserResult.error) throw createUserResult.error

      const secondAttempt = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: { redirectTo }
      })

      if (secondAttempt.error) throw secondAttempt.error
      generatedLink = secondAttempt.data?.properties
    } else {
      generatedLink = firstAttempt.data?.properties
    }

    const actionLink = generatedLink?.action_link

    if (!actionLink) {
      throw new Error('Auth provider did not return an action link for this candidate.')
    }

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

    await supabaseAdmin.from('live_events').insert({
      session_id: session.id,
      event_type: 'magic_link_issued',
      actor: 'interviewer',
      payload: {
        issued_by_user_id: gate.user.id,
        issued_by_email: gate.user.email || null,
        candidate_id: candidate.id,
        email,
        redirect_to: redirectTo,
        expires_at: expiresAt,
        generated_at: new Date().toISOString(),
        method: 'supabase_admin_generate_link'
      }
    })

    const { error: magicLinkLogError } = await supabaseAdmin.from('magic_link_events').insert({
      session_id: session.id,
      candidate_id: candidate.id,
      email,
      status: 'issued',
      action_link: actionLink,
      redirect_to: redirectTo,
      expires_at: expiresAt
    })

    if (magicLinkLogError) {
      console.warn('Magic link audit insert warning:', magicLinkLogError.message)
    }

    return NextResponse.json({
      session_id: session.id,
      candidate_id: candidate.id,
      candidate_email: email,
      action_link: actionLink,
      redirect_to: redirectTo,
      expires_at: expiresAt
    })
  } catch (error: any) {
    console.error('Interviewer send link error:', error)
    return NextResponse.json({ error: error?.message || 'Failed to send candidate link' }, { status: 500 })
  }
}
