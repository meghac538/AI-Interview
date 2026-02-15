import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

interface TranscriptMessage {
  role: 'user' | 'assistant'
  text: string
  timestamp?: number
}

export async function POST(request: Request) {
  try {
    const { session_id, round_number, messages } = await request.json()

    // Validate input
    if (!session_id || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'session_id and messages array are required' },
        { status: 400 }
      )
    }

    // Validate message structure
    for (const msg of messages) {
      if (!msg.role || !['user', 'assistant'].includes(msg.role)) {
        return NextResponse.json(
          { error: 'Each message must have a valid role (user or assistant)' },
          { status: 400 }
        )
      }
      if (typeof msg.text !== 'string' || msg.text.trim().length === 0) {
        return NextResponse.json(
          { error: 'Each message must have non-empty text' },
          { status: 400 }
        )
      }
    }

    // Transform messages to DB format
    const transcripts = messages.map((msg: TranscriptMessage) => {
      const wordCount = msg.text.split(/\s+/).filter(Boolean).length

      return {
        session_id,
        round_number: round_number || 1,
        role: msg.role,
        text: msg.text,
        word_count: wordCount,
        timestamp: msg.timestamp
          ? new Date(msg.timestamp).toISOString()
          : new Date().toISOString()
      }
    })

    // Batch insert
    const { data, error } = await supabaseAdmin
      .from('voice_transcripts')
      .insert(transcripts)
      .select()

    if (error) {
      console.error('Failed to insert transcripts:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    console.log(`✅ Saved ${data.length} transcript messages for session ${session_id}`)

    // Step 7: Check if we should trigger analysis (every 10 messages)
    const { count } = await supabaseAdmin
      .from('voice_transcripts')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', session_id)
      .eq('round_number', round_number || 1)

    if (count && count % 10 === 0) {
      console.log(`🎯 Triggering analysis for session ${session_id} (${count} messages)`)
      // Trigger analysis asynchronously (don't wait)
      fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/voice/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id,
          round_number: round_number || 1
        })
      }).catch(err => console.error('Failed to trigger analysis:', err))
    }

    return NextResponse.json(
      {
        success: true,
        count: data.length,
        transcripts: data
      },
      { status: 201 }
    )
  } catch (error: unknown) {
    console.error('Unexpected error in transcript API:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
