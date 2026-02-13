import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const { session_id, round_number, artifact_type, content, metadata } = await request.json()

    // Validate inputs
    if (!session_id || !round_number || !artifact_type || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: session_id, round_number, artifact_type, content' },
        { status: 400 }
      )
    }

    // Insert artifact (store content in metadata for MVP)
    const { data: artifact, error } = await supabaseAdmin
      .from('artifacts')
      .insert({
        session_id,
        artifact_type,
        url: '', // Empty for text-based artifacts in MVP
        metadata: {
          ...metadata,
          content, // Store content here for MVP
          round_number // Store round reference here
        }
      })
      .select()
      .single()

    if (error) throw error

    // Log event (live_events table)
    await supabaseAdmin.from('live_events').insert({
      session_id,
      event_type: 'artifact_submitted',
      actor: 'candidate',
      payload: { artifact_id: artifact.id, artifact_type, round_number }
    })

    // TODO: Trigger scoring (will be implemented in Phase 5)
    // await triggerScoring(artifact)

    return NextResponse.json(artifact)
  } catch (error: any) {
    console.error('Artifact submission error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
