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

    // Insert artifact with content + round_number as proper columns
    const { data: artifact, error } = await supabaseAdmin
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

    if (error) throw error

    // Log event (live_events table)
    await supabaseAdmin.from('live_events').insert({
      session_id,
      event_type: 'artifact_submitted',
      actor: 'candidate',
      payload: { artifact_id: artifact.id, artifact_type, round_number }
    })

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
