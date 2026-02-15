import { NextResponse } from 'next/server'

/**
 * OpenAI Realtime API - Session Secret Generation
 *
 * Generates an ephemeral client secret (ek_*) for connecting to OpenAI Realtime API via WebRTC
 * The client secret expires after 1 minute and can only be used once
 *
 * POST /api/voice/session-secret
 * Body: { session_id: string, persona_id?: string, scenario_id?: string, difficulty?: number }
 */

export async function POST(request: Request) {
  try {
    const { session_id, persona_id, scenario_id, difficulty = 3 } = await request.json()

    if (!session_id) {
      return NextResponse.json(
        { error: 'Missing session_id' },
        { status: 400 }
      )
    }

    // TODO: Fetch persona and scenario from database (Phase 3)
    // For now, use hardcoded system instructions

    const systemInstructions = `You are a sales prospect named "Alex Morgan", a VP of Operations at a mid-market company.

PERSONALITY:
- Professional but skeptical
- Budget-conscious and asks tough questions
- Appreciates data-driven pitches
- Can be convinced with strong value propositions

CONVERSATION STYLE:
- Speak naturally and conversationally
- Ask clarifying questions when needed
- Raise objections about cost, implementation time, and ROI
- Get more interested if the candidate handles objections well

DIFFICULTY LEVEL: ${difficulty}/5
${difficulty <= 2 ? '(Be relatively easy to convince, fewer objections)' : ''}
${difficulty === 3 ? '(Balanced - some objections but open to good arguments)' : ''}
${difficulty >= 4 ? '(Be very skeptical, raise multiple objections, demand concrete proof)' : ''}

IMPORTANT:
- Keep responses concise (2-3 sentences max)
- React naturally to what the candidate says
- Don't give away the sale too easily
- If they ask good discovery questions, reward with useful information`

    // Call OpenAI Realtime API to create session
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview-2024-12-17',
        voice: 'sage', // Can be: ash, coral, sage, cedar, marin, ballad
        instructions: systemInstructions,
        temperature: 0.8,
        turn_detection: {
          type: 'server_vad', // Voice Activity Detection
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500
        },
        input_audio_transcription: {
          model: 'whisper-1'
        }
      })
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('OpenAI Realtime API error:', error)
      return NextResponse.json(
        { error: 'Failed to create OpenAI session', details: error },
        { status: 500 }
      )
    }

    const data = await response.json()

    // Return the client secret for WebRTC connection
    return NextResponse.json({
      client_secret: data.client_secret.value,
      expires_at: data.client_secret.expires_at,
      session_id: data.id,
      voice: data.voice,
      model: data.model
    })

  } catch (error: any) {
    console.error('Session secret generation error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
