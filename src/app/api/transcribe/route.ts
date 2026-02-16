import { NextResponse } from 'next/server'
import OpenAI from 'openai'

/**
 * POST /api/transcribe
 * Speech-to-text using OpenAI Whisper. Used as fallback when Web Speech API
 * is not available (e.g. Firefox). Expects multipart/form-data with "file" field.
 */
export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file')

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: 'Missing audio file in form field "file"' },
        { status: 400 }
      )
    }

    // Whisper accepts: mp3, mp4, mpeg, mpga, m4a, wav, webm
    const ext = file.name?.split('.').pop() || 'webm'
    const mimeMap: Record<string, string> = {
      webm: 'audio/webm',
      ogg: 'audio/ogg',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      m4a: 'audio/mp4'
    }
    const mimeType = mimeMap[ext] || 'audio/webm'

    const openai = new OpenAI({ apiKey })
    const transcription = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file: new File([file], `audio.${ext}`, { type: mimeType }),
      language: 'en'
    })

    return NextResponse.json({ text: transcription.text })
  } catch (error) {
    console.error('Transcribe error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: `Transcription failed: ${message}` },
      { status: 500 }
    )
  }
}
