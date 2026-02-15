import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { runScoringForArtifact } from '@/lib/ai/score-runner'

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

    // Create followup_answer event FIRST (before artifact insert which may fail
    // if the artifacts table schema doesn't have all expected columns)
    if (artifact_type === 'followup_answer' && metadata?.question_id) {
      await supabaseAdmin.from('live_events').insert({
        session_id,
        event_type: 'followup_answer',
        actor: 'candidate',
        payload: {
          round_number,
          question_id: metadata.question_id,
          question: metadata.question || null,
          answer: String(content).slice(0, 2000)
        }
      })
    }

    // Insert artifact — try with metadata column first, fall back without it
    let artifact: any = null
    const { data: withMeta, error: metaError } = await supabaseAdmin
      .from('artifacts')
      .insert({
        session_id,
        artifact_type,
        url: '',
        content,
        round_number,
        metadata: metadata || {}
      })
      .select()
      .single()

    if (metaError && metaError.code === 'PGRST204') {
      // metadata column doesn't exist — insert without it
      const { data: withoutMeta, error: fallbackError } = await supabaseAdmin
        .from('artifacts')
        .insert({
          session_id,
          artifact_type,
          url: '',
          content,
          round_number
        })
        .select()
        .single()

      if (fallbackError) throw fallbackError
      artifact = withoutMeta
    } else if (metaError) {
      throw metaError
    } else {
      artifact = withMeta
    }

    // Log event (live_events table)
    await supabaseAdmin.from('live_events').insert({
      session_id,
      event_type: 'artifact_submitted',
      actor: 'candidate',
      payload: { artifact_id: artifact.id, artifact_type, round_number }
    })

    // Only trigger scoring for final (non-draft) submissions like followup answers.
    // Draft auto-saves from TextResponseUI are scored at round completion time instead.
    if (!metadata?.draft) {
      runScoringForArtifact(artifact.id).catch((err) => {
        console.error('Background scoring error for artifact', artifact.id, err)
      })
    }

    return NextResponse.json(artifact)
  } catch (error: any) {
    console.error('Artifact submission error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
