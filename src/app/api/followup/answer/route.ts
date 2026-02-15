import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const { session_id, round_number, question_id, question, answer } = await request.json()

    if (!session_id || !question_id || !answer) {
      return NextResponse.json(
        { error: 'Missing required fields: session_id, question_id, answer' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin.from('live_events').insert({
      session_id,
      event_type: 'followup_answer',
      actor: 'candidate',
      payload: {
        round_number: round_number ?? null,
        question_id,
        question: question || null,
        answer: String(answer).slice(0, 2000)
      }
    })

    if (error) {
      console.error('Followup answer event error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Followup answer error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
