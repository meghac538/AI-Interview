import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const { session_id, email, expiry_hours } = await request.json()

    if (!session_id || !email) {
      return NextResponse.json(
        { error: 'Missing required fields: session_id, email' },
        { status: 400 }
      )
    }

    // Verify session exists
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('interview_sessions')
      .select('id, candidate_id')
      .eq('id', session_id)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Update candidate email in DB
    if (session.candidate_id) {
      await supabaseAdmin
        .from('candidates')
        .update({ email })
        .eq('id', session.candidate_id)
    }

    const hours = Number(expiry_hours) || 2
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const redirectTo = `${appUrl}/auth/callback?next=/candidate/${session_id}`

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find((u) => u.email === email)

    let magicLink: string | undefined

    if (!existingUser) {
      // New user: inviteUserByEmail creates user AND sends email
      const { error: inviteError } =
        await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
          data: {
            session_id,
            expires_at: expiresAt,
          },
          redirectTo,
        })

      if (inviteError) {
        console.error('Invite error:', inviteError)
        throw inviteError
      }

      // Also generate the link for backup display
      const { data: linkData } =
        await supabaseAdmin.auth.admin.generateLink({
          type: 'magiclink',
          email,
          options: {
            data: { session_id, expires_at: expiresAt },
            redirectTo,
          },
        })
      magicLink = linkData?.properties?.action_link
    } else {
      // Existing user: update metadata, then generate + show link
      await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        user_metadata: {
          session_id,
          expires_at: expiresAt,
        },
      })

      // Generate magic link (for backup display and re-sends)
      const { data: linkData, error: linkError } =
        await supabaseAdmin.auth.admin.generateLink({
          type: 'magiclink',
          email,
          options: {
            data: { session_id, expires_at: expiresAt },
            redirectTo,
          },
        })

      if (linkError) {
        console.error('Generate link error:', linkError)
        throw linkError
      }
      magicLink = linkData?.properties?.action_link
    }

    // Log event
    await supabaseAdmin.from('live_events').insert({
      session_id,
      event_type: 'credentials_sent',
      payload: { email, expires_at: expiresAt },
    })

    return NextResponse.json({
      ok: true,
      expires_at: expiresAt,
      magic_link: magicLink,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Send magic link error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
