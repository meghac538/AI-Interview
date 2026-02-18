import { supabaseAdmin } from '@/lib/supabase/server'

/**
 * Generates session-specific assessment blueprints from fallback round templates.
 *
 * The blueprints are inserted into `assessment_blueprints` with a `session_id` so
 * they're linked to this specific session. The existing `buildRoundsFromBlueprints`
 * flow then picks them up and uses `generatePromptFromBlueprint` to produce
 * AI-generated, role-specific prompts.
 */
export async function generateSessionBlueprints(
  sessionId: string,
  track: string,
  role: string,
  level: string,
  roleSignals: any,
  roundTemplates: Array<Record<string, any>>
): Promise<any[]> {
  if (!roundTemplates || roundTemplates.length === 0) {
    return []
  }

  const blueprints: any[] = []

  for (const template of roundTemplates) {
    // Skip rounds that shouldn't become blueprints
    if (shouldSkip(template)) continue

    const blueprintRow = {
      session_id: sessionId,
      track,
      competency: template.config?.competency || template.title || 'General Assessment',
      difficulty: template.config?.difficulty || level || 'L2',
      format: mapRoundTypeToFormat(template.round_type),
      scoring_rubric: template.config?.scoring_rubric || {},
      red_flags: template.config?.red_flags || {},
      anti_cheat_constraints: template.config?.anti_cheat_constraints || {},
      evidence_requirements: template.config?.evidence_requirements || {},
      time_limit_minutes: template.duration_minutes || 10
    }

    blueprints.push(blueprintRow)
  }

  if (blueprints.length === 0) return []

  // Batch insert all blueprints
  const { data: inserted, error } = await supabaseAdmin
    .from('assessment_blueprints')
    .insert(blueprints)
    .select()

  if (error) {
    console.error('Blueprint insertion failed:', error.message)
    return []
  }

  return inserted || []
}

/**
 * Fetches validated question items for a track to use as few-shot context.
 * These are added to roleSignals so generatePromptFromBlueprint can reference them.
 */
export async function getValidatedQuestionContext(track: string): Promise<any[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('generated_question_items')
      .select('competency, prompt, expected_output, format, difficulty')
      .eq('track', track)
      .eq('status', 'validated')
      .order('created_at', { ascending: false })
      .limit(5)

    if (error) {
      console.warn('Could not fetch validated questions:', error.message)
      return []
    }

    return data || []
  } catch {
    return []
  }
}

function shouldSkip(template: Record<string, any>): boolean {
  // voice-realtime prompts are AI prospect system instructions, not assessment blueprints
  if (template.round_type === 'voice-realtime') return false // Keep — blueprint drives prompt generation
  // Optional wrap-up rounds are too light for blueprints
  if (template.config?.optional === true) return true
  return false
}

function mapRoundTypeToFormat(roundType: string): string {
  // Preserve exact round types so they survive the blueprint→round conversion
  switch (roundType) {
    case 'code': return 'code'
    case 'mcq': return 'mcq'
    case 'email': return 'email'
    case 'voice': return 'voice'
    case 'voice-realtime': return 'voice-realtime'
    case 'agentic': return 'agentic'
    default: return 'short_answer'
  }
}
