import { supabaseAdmin } from '@/lib/supabase/server'
import { generateFollowups, scoreArtifact, STANDARD_DIMENSIONS } from '@/lib/ai/score-smith'
import { emitRedFlag, fetchScopePackage } from '@/lib/db/helpers'

export async function runScoringForArtifact(artifactId: string) {
  // Get artifact
  const { data: artifact, error } = await supabaseAdmin
    .from('artifacts')
    .select('*')
    .eq('id', artifactId)
    .single()

  if (error) throw error

  const scopePackage = await fetchScopePackage(artifact.session_id)

  // Support both metadata-based and direct column-based artifacts
  const rawContent = artifact.metadata?.content ?? artifact.content ?? ''
  const roundNumber = artifact.metadata?.round_number ?? artifact.round_number

  if (!roundNumber) {
    throw new Error('Artifact round number missing')
  }

  // Convert transcript JSONB to string format (including voice format)
  let contentString: string
  if (typeof rawContent === 'string') {
    contentString = rawContent
  } else if (rawContent?.items && Array.isArray(rawContent.items)) {
    // Voice transcript format: { items: [{ role, text, timestamp }] }
    contentString = rawContent.items
      .map((item: any) => {
        const speaker = item.role === 'user' ? 'Candidate' : 'Prospect'
        return `${speaker}: ${item.text}`
      })
      .join('\n\n')
  } else {
    contentString = rawContent ? JSON.stringify(rawContent) : ''
  }

  const round = scopePackage.round_plan.find((r: any) => r.round_number === roundNumber)

  if (!round) {
    throw new Error('Round not found in scope package')
  }

  const dimensions = getDimensionsForRound(round)
  const track = scopePackage.track || ''

  // Handle empty/very short content: emit red flag and return early with zero score
  const wordCount = String(contentString).trim().split(/\s+/).filter(Boolean).length
  if (!contentString || wordCount < 3) {
    await emitRedFlag(artifact.session_id, {
      flag_type: 'insufficient_response',
      severity: 'warning',
      description: contentString ? 'Response too short to evaluate' : 'No response submitted',
      auto_stop: false,
      round_number: roundNumber,
      evidence: contentString ? [{ quote: String(contentString).slice(0, 120) }] : [],
    })

    const { error: earlyScoreErr } = await supabaseAdmin.from('scores').insert({
      session_id: artifact.session_id,
      round: roundNumber,
      overall_score: 0,
      dimension_scores: {},
      red_flags: [{ flag_type: 'insufficient_response', severity: 'warning', description: contentString ? 'Response too short' : 'No response' }],
      confidence: 0,
      evidence_quotes: [],
      recommendation: 'stop',
      recommended_followups: ['Ask the candidate to elaborate on their response.']
    })
    if (earlyScoreErr) {
      await supabaseAdmin.from('scores').insert({
        session_id: artifact.session_id,
        round_number: roundNumber,
        overall_score: 0,
        dimension_scores: {},
        recommendation: 'stop'
      })
    }

    await supabaseAdmin.from('live_events').insert({
      session_id: artifact.session_id,
      event_type: 'scoring_completed',
      actor: 'system',
      payload: { artifact_id: artifact.id, round_number: roundNumber, dimensions: 0 }
    })

    return { results: [], overall_score: 0 }
  }

  const results = await scoreArtifact(
    artifact.session_id,
    roundNumber,
    artifact.id,
    contentString,
    dimensions,
    track
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
    if (key === 'role_depth' && value < 15) return true
    if (key === 'reasoning' && value < 10) return true
    if (key === 'verification' && value < 10) return true
    if (key === 'communication' && value < 8) return true
    if (key === 'reliability' && value < 8) return true
    return false
  })

  // Build red flags locally (stored in scores.red_flags jsonb column)
  const redFlags: Array<{ flag_type: string; severity: string; description: string; evidence?: any[] }> = []

  if (wordCount < 5) {
    redFlags.push({
      flag_type: 'insufficient_response',
      severity: 'high',
      description: 'Response too short to evaluate reliably',
      evidence: [{ quote: String(contentString).slice(0, 120), timestamp: 'n/a' }]
    })
  }

  if (evidenceQuotes.length === 0) {
    redFlags.push({
      flag_type: 'no_evidence',
      severity: 'high',
      description: 'No evidence quotes available for scoring'
    })
  }

  // Emit local red flags as live events for realtime propagation
  for (const flag of redFlags) {
    await emitRedFlag(artifact.session_id, {
      flag_type: flag.flag_type,
      severity: (flag.severity === 'high' ? 'warning' : flag.severity) as 'warning' | 'critical',
      description: flag.description,
      auto_stop: false,
      round_number: round.round_number,
      evidence: flag.evidence || [],
    })
  }

  const hasMajorRedFlag = redFlags.some((flag) => {
    if (flag.severity === 'critical') return true
    return [
      'unsafe_data_handling',
      'overconfident_without_verification',
      'overpromising',
      'no_testing_mindset',
      'conflict_escalation'
    ].includes(flag.flag_type)
  })

  const recommendation =
    overallScore >= 75 && !hasMajorRedFlag
      ? 'proceed'
      : overallScore >= 65 && overallScore <= 74 && !hasMajorRedFlag && !criticalWeak
        ? 'caution'
        : 'stop'

  const followups = await generateFollowups(
    contentString,
    dimensionScores,
    evidenceQuotes.map((item) => ({ dimension: item.dimension, quote: item.quote }))
  )

  // Try insert with full columns first (Schema A: column = "round"), fallback to minimal (Schema B: column = "round_number")
  const fullPayload = {
    session_id: artifact.session_id,
    round: round.round_number,
    overall_score: overallScore,
    dimension_scores: dimensionScores,
    red_flags: redFlags,
    confidence,
    evidence_quotes: evidenceQuotes,
    recommendation,
    recommended_followups: followups
  }

  const { error: insertError } = await supabaseAdmin.from('scores').insert(fullPayload)

  if (insertError) {
    console.error('Score insert (full) failed, trying minimal:', insertError.message)
    // Fallback: try with round_number column and fewer fields
    const { error: fallbackError } = await supabaseAdmin.from('scores').insert({
      session_id: artifact.session_id,
      round_number: round.round_number,
      overall_score: overallScore,
      dimension_scores: dimensionScores,
      recommendation
    })
    if (fallbackError) {
      console.error('Score insert (minimal) also failed:', fallbackError.message)
    }
  }

  await supabaseAdmin.from('live_events').insert({
    session_id: artifact.session_id,
    event_type: 'scoring_completed',
    actor: 'system',
    payload: {
      artifact_id: artifact.id,
      round_number: round.round_number,
      overall_score: overallScore,
      dimensions: results.length,
      recommendation
    }
  })

  // Check for critical auto-stop red flags emitted during scoring
  try {
    const { data: autoStopEvents } = await supabaseAdmin
      .from('live_events')
      .select('id, payload')
      .eq('session_id', artifact.session_id)
      .eq('event_type', 'red_flag_detected')
      .order('created_at', { ascending: false })
      .limit(20)

    const hasAutoStop = (autoStopEvents || []).some(
      (e: any) => e.payload?.auto_stop === true && e.payload?.severity === 'critical'
    )

    if (hasAutoStop) {
      const { forceStopSession } = await import('@/lib/db/helpers')
      await forceStopSession(
        artifact.session_id,
        'Critical red flag detected during scoring'
      )
    }
  } catch (autoStopError) {
    console.error('Auto-stop check error:', autoStopError)
  }

  return { results, overall_score: overallScore }
}

function getDimensionsForRound(round: any) {
  const rubricDimensions = round?.config?.scoring_rubric?.dimensions
  if (Array.isArray(rubricDimensions) && rubricDimensions.length > 0) {
    return rubricDimensions.map((dimension: any) => ({
      name: dimension.name,
      description: dimension.description || '',
      maxScore: dimension.maxScore || 20,
      scoringCriteria: dimension.scoringCriteria || []
    }))
  }

  return STANDARD_DIMENSIONS
}
