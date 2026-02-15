/**
 * Inter-round adaptive difficulty engine.
 * After scoring Round N, adjusts Round N+1's difficulty based on performance.
 */

interface DimensionScores {
  [key: string]: number
}

interface ScoreInput {
  overall_score: number
  dimension_scores: DimensionScores
  recommendation: 'proceed' | 'caution' | 'stop'
}

interface RoundConfig {
  difficulty?: string
  pdf_by_difficulty?: Record<string, string>
  pdf_url?: string
  adapted_from?: object
  [key: string]: any
}

interface Round {
  round_number: number
  status?: string
  config: RoundConfig
  [key: string]: any
}

interface AdaptationResult {
  updatedPlan: Round[]
  adaptation: {
    round_adapted: number
    from_difficulty: string
    to_difficulty: string
    adaptation_type: 'escalate' | 'de-escalate' | 'hold'
    weak_dimensions: string[]
    trigger_score: number
    trigger_recommendation: string
  } | null
}

const DIFFICULTY_ORDER = ['L1', 'L2', 'L3'] as const

export function adaptNextRound(
  roundPlan: Round[],
  completedRoundNumber: number,
  score: ScoreInput
): AdaptationResult {
  const nextRound = roundPlan.find(
    r => r.round_number === completedRoundNumber + 1 && r.status === 'pending'
  )

  if (!nextRound) {
    return { updatedPlan: roundPlan, adaptation: null }
  }

  const currentDifficulty = nextRound.config?.difficulty || 'L2'
  let newDifficultyIndex = DIFFICULTY_ORDER.indexOf(
    currentDifficulty as typeof DIFFICULTY_ORDER[number]
  )
  if (newDifficultyIndex < 0) newDifficultyIndex = 1 // default to L2

  let adaptationType: 'escalate' | 'de-escalate' | 'hold'

  if (score.recommendation === 'proceed' && score.overall_score >= 75) {
    // Strong performance → escalate next round
    newDifficultyIndex = Math.min(newDifficultyIndex + 1, 2)
    adaptationType = 'escalate'
  } else if (score.recommendation === 'stop' || score.overall_score < 55) {
    // Weak performance → de-escalate next round
    newDifficultyIndex = Math.max(newDifficultyIndex - 1, 0)
    adaptationType = 'de-escalate'
  } else {
    // Caution range or moderate → keep same difficulty
    adaptationType = 'hold'
  }

  const newDifficulty = DIFFICULTY_ORDER[newDifficultyIndex]

  // Identify weakest dimensions to inform next round focus
  const weakDimensions = Object.entries(score.dimension_scores)
    .filter(([_, v]) => v < 15)
    .map(([k]) => k)

  const updatedPlan = roundPlan.map(r => {
    if (r.round_number !== completedRoundNumber + 1) return r

    const updatedConfig: RoundConfig = {
      ...r.config,
      difficulty: newDifficulty,
      adapted_from: {
        previous_round: completedRoundNumber,
        previous_score: score.overall_score,
        previous_recommendation: score.recommendation,
        weak_dimensions: weakDimensions,
        adaptation_type: adaptationType
      }
    }

    // Update PDF URL if difficulty changed and pdf_by_difficulty mapping exists
    if (r.config?.pdf_by_difficulty?.[newDifficulty]) {
      updatedConfig.pdf_url = r.config.pdf_by_difficulty[newDifficulty]
    }

    return { ...r, config: updatedConfig }
  })

  return {
    updatedPlan,
    adaptation: {
      round_adapted: completedRoundNumber + 1,
      from_difficulty: currentDifficulty,
      to_difficulty: newDifficulty,
      adaptation_type: adaptationType,
      weak_dimensions: weakDimensions,
      trigger_score: score.overall_score,
      trigger_recommendation: score.recommendation
    }
  }
}
