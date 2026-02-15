import { NextResponse } from 'next/server'
import { runScoringForArtifact } from '@/lib/ai/score-runner'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const { artifact_id, session_id, round_number } = await request.json()

    // Support both artifact_id (legacy) and session_id/round_number (new)
    let artifactId = artifact_id

    if (!artifactId && session_id && round_number) {
      // Find transcript artifact for this session/round
      const { data: artifact } = await supabaseAdmin
        .from('artifacts')
        .select('id')
        .eq('session_id', session_id)
        .eq('round_number', round_number)
        .eq('artifact_type', 'transcript')
        .single()

      if (artifact) {
        artifactId = artifact.id
      } else {
        return NextResponse.json(
          { error: 'No transcript artifact found for this session/round' },
          { status: 404 }
        )
      }
    }

    if (!artifactId) {
      return NextResponse.json(
        { error: 'Missing required field: artifact_id or session_id/round_number' },
        { status: 400 }
      )
    }

    const result = await runScoringForArtifact(artifactId)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Scoring error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
