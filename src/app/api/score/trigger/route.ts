import { NextResponse } from 'next/server'
import { runScoringForArtifact } from '@/lib/ai/score-runner'

export async function POST(request: Request) {
  try {
    const { artifact_id } = await request.json()

    if (!artifact_id) {
      return NextResponse.json(
        { error: 'Missing required field: artifact_id' },
        { status: 400 }
      )
    }

    const result = await runScoringForArtifact(artifact_id)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Scoring error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
