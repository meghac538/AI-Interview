import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const { session_id, action_type, payload } = await request.json()

    if (!session_id || !action_type) {
      return NextResponse.json(
        { error: 'Missing required fields: session_id, action_type' },
        { status: 400 }
      )
    }

    await supabaseAdmin.from('live_events').insert({
      session_id,
      event_type: 'interviewer_action',
      actor: 'interviewer',
      payload: {
        action_type,
        ...payload
      }
    })

    if (action_type === 'manual_followup' && payload?.followup) {
      const { data: scores } = await supabaseAdmin
        .from('scores')
        .select('*')
        .eq('session_id', session_id)
        .order('created_at', { ascending: false })
        .limit(1)

      const latest = scores?.[0]
      if (latest) {
        const existing = Array.isArray(latest.recommended_followups)
          ? latest.recommended_followups
          : []
        const updated = [...existing, String(payload.followup)]

        await supabaseAdmin
          .from('scores')
          .update({ recommended_followups: updated })
          .eq('id', latest.id)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('Interviewer action error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
