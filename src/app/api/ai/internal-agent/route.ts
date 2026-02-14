import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { supabaseAdmin } from '@/lib/supabase/server'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(request: Request) {
  try {
    const { session_id, round_number, agent_id, agent_name, message, conversation_history, agent_persona } = await request.json()

    if (!session_id || !agent_id || !message || !agent_persona) {
      return NextResponse.json(
        { error: 'Missing required fields: session_id, agent_id, message, agent_persona' },
        { status: 400 }
      )
    }

    // Build conversation for OpenAI
    const messages = [
      { role: 'system' as const, content: agent_persona },
      { role: 'system' as const, content: 'Keep responses concise (2-4 sentences). Be helpful but honest about limitations. If you are unsure about something, say so rather than guessing. Do not volunteer information the candidate has not asked about — let them drive the conversation.' },
      ...(conversation_history || []).map((msg: any) => ({
        role: (msg.speaker === 'candidate' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: msg.text
      })),
      { role: 'user' as const, content: message }
    ]

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      temperature: 0.7,
      max_tokens: 300
    })

    const response = completion.choices[0].message.content || ''

    // Log to live_events for audit trail
    await supabaseAdmin.from('live_events').insert({
      session_id,
      event_type: 'internal_agent_message',
      actor: 'system',
      payload: {
        agent_id,
        agent_name: agent_name || agent_id,
        round_number,
        candidate_message: String(message).slice(0, 500),
        agent_response: response
      }
    })

    return NextResponse.json({ response, agent_id })
  } catch (error: any) {
    console.error('Internal agent error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
