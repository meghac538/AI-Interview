/**
 * Prompt Template Renderer
 *
 * Replaces placeholder tokens in persona prompt templates with actual values
 * from persona and scenario data.
 *
 * Supported placeholders:
 * - {persona.name}, {persona.role}, {persona.company_context}, etc.
 * - {scenario.title}, {scenario.description}, {scenario.industry}, etc.
 */

interface RenderContext {
  persona: {
    name: string
    role: string
    company_context?: string
    personality_traits?: string[]
    communication_style?: string
    objection_patterns?: string[]
    difficulty: number
  }
  scenario?: {
    title?: string
    description?: string
    industry?: string
    company_size?: string
    pain_points?: string[]
    budget_range?: string
    decision_timeline?: string
  }
}

export function renderPromptTemplate(
  template: string,
  context: RenderContext
): string {
  let rendered = template

  // Replace persona placeholders
  rendered = rendered.replace(/{persona\.name}/g, context.persona.name)
  rendered = rendered.replace(/{persona\.role}/g, context.persona.role)
  rendered = rendered.replace(
    /{persona\.company_context}/g,
    context.persona.company_context || ''
  )
  rendered = rendered.replace(
    /{persona\.personality_traits}/g,
    context.persona.personality_traits?.join(', ') || ''
  )
  rendered = rendered.replace(
    /{persona\.communication_style}/g,
    context.persona.communication_style || ''
  )
  rendered = rendered.replace(
    /{persona\.objection_patterns}/g,
    context.persona.objection_patterns?.join('\n') || ''
  )
  rendered = rendered.replace(
    /{persona\.difficulty}/g,
    context.persona.difficulty.toString()
  )

  // Replace scenario placeholders (if provided)
  if (context.scenario) {
    rendered = rendered.replace(
      /{scenario\.title}/g,
      context.scenario.title || ''
    )
    rendered = rendered.replace(
      /{scenario\.description}/g,
      context.scenario.description || ''
    )
    rendered = rendered.replace(
      /{scenario\.industry}/g,
      context.scenario.industry || ''
    )
    rendered = rendered.replace(
      /{scenario\.company_size}/g,
      context.scenario.company_size || ''
    )
    rendered = rendered.replace(
      /{scenario\.pain_points}/g,
      context.scenario.pain_points?.join('\n- ') || ''
    )
    rendered = rendered.replace(
      /{scenario\.budget_range}/g,
      context.scenario.budget_range || ''
    )
    rendered = rendered.replace(
      /{scenario\.decision_timeline}/g,
      context.scenario.decision_timeline || ''
    )
  }

  return rendered
}
