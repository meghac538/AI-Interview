import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import {
  generateAnswerSet,
  generateQuestionFromBlueprint,
  runAnswerabilityCheck,
  runStructuralCheck,
  runBiasCheck,
  runLeakageCheck,
  storeQuestionItem,
  validateAnswerRanking
} from '@/lib/ai/question-factory'

export async function POST(request: Request) {
  try {
    const { blueprint_id, role_signals } = await request.json()

    if (!blueprint_id) {
      return NextResponse.json(
        { error: 'Missing required field: blueprint_id' },
        { status: 400 }
      )
    }

    const { data: blueprint, error } = await supabaseAdmin
      .from('assessment_blueprints')
      .select('*')
      .eq('id', blueprint_id)
      .single()

    if (error) throw error

    const generated = await generateQuestionFromBlueprint(blueprint, role_signals || {})

    const structural = await runStructuralCheck(
      generated.prompt,
      generated.expected_output,
      blueprint.time_limit_minutes
    )

    const answers = await generateAnswerSet(generated.prompt, blueprint)
    const ranking = await validateAnswerRanking(generated.prompt, blueprint, answers)
    const answerability = await runAnswerabilityCheck(
      generated.prompt,
      blueprint.scoring_rubric,
      answers
    )
    const leakage = await runLeakageCheck(generated.prompt)
    const bias = await runBiasCheck(generated.prompt)

    const ranked = Array.isArray(ranking.ranked) ? ranking.ranked : []
    const passedRanking =
      ranked[0] === 'gold' &&
      ranked.slice(-2).every((item: string) => item.startsWith('bad'))

    const scores = answerability?.scores || {}
    const passedAnswerability =
      scores.gold >= Math.max(scores.borderline_a || 0, scores.borderline_b || 0) &&
      (scores.bad_a || 0) <= (scores.borderline_a || 100) &&
      (scores.bad_b || 0) <= (scores.borderline_b || 100)

    const passedLeakage = leakage?.is_trivia === false
    const passedBias = bias?.has_bias_risk === false
    const passedStructural =
      structural?.clear_prompt === true &&
      structural?.clear_output === true &&
      structural?.time_bound === true &&
      structural?.ambiguous_scoring === false

    const passed = passedRanking && passedAnswerability && passedLeakage && passedBias && passedStructural

    const validationReport = {
      structural,
      answers,
      ranking,
      answerability,
      leakage,
      bias,
      passed
    }

    const stored = await storeQuestionItem(blueprint, generated, {
      passed,
      report: validationReport
    })

    return NextResponse.json({
      item: stored,
      validation: validationReport
    })
  } catch (error: any) {
    console.error('Question factory error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
