import { supabaseAdmin } from '@/lib/supabase/server'
import { scoreArtifact, getDimensionsForRound } from '@/lib/ai/score-smith'

export async function runScoringForArtifact(artifactId: string) {
  // Get artifact
  const { data: artifact, error } = await supabaseAdmin
    .from('artifacts')
    .select('*')
    .eq('id', artifactId)
    .single()

  if (error) throw error

  // Get scope package to find round information
  const { data: scopePackage } = await supabaseAdmin
    .from('interview_scope_packages')
    .select('*')
    .eq('session_id', artifact.session_id)
    .single()

  if (!scopePackage) {
    throw new Error('Scope package not found')
  }

  const content = artifact.metadata?.content || ''
  const roundNumber = artifact.metadata?.round_number

  if (!content || !roundNumber) {
    throw new Error('Artifact content or round number missing')
  }

  const round = scopePackage.round_plan.find((r: any) => r.round_number === roundNumber)

  if (!round) {
    throw new Error('Round not found in scope package')
  }

  const track = scopePackage.track || 'sales'
  const dimensions = getDimensionsForRound(track, roundNumber)

  const results = await scoreArtifact(
    artifact.session_id,
    roundNumber,
    artifact.id,
    content,
    dimensions
  )

  const dimensionScores: Record<string, number> = {}
  const evidenceQuotes: Array<{ dimension: string; quote: string; line?: number }> = []
  let scoreSum = 0
  let maxSum = 0
  let confidenceSum = 0

  for (const result of results) {
    const dimension = result.dimension
    const score = Number(result.score) || 0
    const max = dimensions.find((d) => d.name === dimension)?.maxScore || 0

    dimensionScores[dimension] = score
    scoreSum += score
    maxSum += max
    confidenceSum += Number(result.confidence) || 0

    for (const evidence of result.evidence || []) {
      evidenceQuotes.push({
        dimension,
        quote: evidence.evidence,
        line: undefined
      })
    }
  }

  const overallScore = maxSum > 0 ? Math.round((scoreSum / maxSum) * 100) : 0
  const confidence = results.length > 0 ? Number((confidenceSum / results.length).toFixed(2)) : 0

  const criticalWeak = Object.entries(dimensionScores).some(([key, value]) => {
    const dim = dimensions.find(d => d.name === key)
    if (!dim) return false
    return value < dim.maxScore * 0.4
  })

  const redFlags: any[] = []

  const wordCount = String(content).trim().split(/\s+/).filter(Boolean).length
  if (wordCount < 5) {
    redFlags.push({
      flag_type: 'insufficient_response',
      severity: 'high',
      description: 'Response too short to evaluate reliably',
      evidence: [{ quote: String(content).slice(0, 120), timestamp: 'n/a' }]
    })
  }

  if (evidenceQuotes.length === 0) {
    redFlags.push({
      flag_type: 'no_evidence',
      severity: 'high',
      description: 'No evidence quotes available for scoring',
      evidence: []
    })
  }

  // Include red flags detected during dimension scoring
  for (const result of results) {
    const dim = dimensions.find(d => d.name === result.dimension)
    if (dim && result.score < dim.maxScore * 0.3) {
      redFlags.push({
        flag_type: `low_${result.dimension}`,
        severity: 'high',
        description: `Very low score on ${result.dimension}: ${result.reasoning}`,
        evidence: result.evidence?.slice(0, 2) || []
      })
    }
  }

  const hasMajorRedFlag = redFlags.some((flag: any) => {
    if (flag.severity === 'critical') return true
    const type = String(flag.flag_type || '')
    return [
      'unsafe_data_handling',
      'overconfident_without_verification',
      'overpromising',
      'no_testing_mindset',
      'conflict_escalation'
    ].includes(type)
  })

  const recommendation =
    overallScore >= 75 && !hasMajorRedFlag
      ? 'proceed'
      : overallScore >= 65 && overallScore <= 74 && !hasMajorRedFlag && !criticalWeak
        ? 'caution'
        : 'stop'

  const { error: scoreInsertError } = await supabaseAdmin.from('scores').insert({
    session_id: artifact.session_id,
    round: round.round_number,
    overall_score: overallScore,
    dimension_scores: dimensionScores,
    red_flags: redFlags,
    confidence,
    evidence_quotes: evidenceQuotes,
    recommendation
  })

  if (scoreInsertError) {
    console.error('Score insert error:', scoreInsertError)
    throw scoreInsertError
  }

  await supabaseAdmin.from('live_events').insert({
    session_id: artifact.session_id,
    event_type: 'scoring_completed',
    actor: 'system',
    payload: {
      artifact_id: artifact.id,
      round_number: round.round_number,
      overall_score: overallScore,
      recommendation,
      dimensions: results.length
    }
  })

  return { results, overall_score: overallScore }
}
