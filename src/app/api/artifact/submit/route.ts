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

    // Insert artifact using only columns present in all schema versions.
    // Some deployments may lack 'url' and/or 'metadata' columns.
    const baseRow: Record<string, unknown> = {
      session_id,
      artifact_type,
      content,
      round_number
    }

    let artifact: any = null
    let insertError: any = null

    // Try with all optional columns first, then progressively drop missing ones
    const columnSets = [
      { ...baseRow, url: '', metadata: metadata || {} },
      { ...baseRow, url: '' },
      { ...baseRow, metadata: metadata || {} },
      baseRow
    ]

    for (const columns of columnSets) {
      const { data, error } = await supabaseAdmin
        .from('artifacts')
        .insert(columns)
        .select()
        .single()

      if (!error) {
        artifact = data
        insertError = null
        break
      }

      if (error.code === 'PGRST204') {
        // Column not found — try next set with fewer columns
        insertError = error
        continue
      }

      // Different error — stop trying
      insertError = error
      break
    }

    if (insertError) throw insertError

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
