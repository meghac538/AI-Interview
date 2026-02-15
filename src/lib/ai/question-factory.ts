import OpenAI from 'openai'
import { supabaseAdmin } from '@/lib/supabase/server'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function generateQuestionFromBlueprint(blueprint: any, roleSignals: any) {
  const prompt = `You are generating a live interview question from a blueprint.

Blueprint:
${JSON.stringify(blueprint)}

Role signals:
${JSON.stringify(roleSignals)}

Requirements:
- Provide a clear prompt and expected output format
- Must be time-bound to ${blueprint.time_limit_minutes} minutes
- Enforce anti-cheat constraints
- Require reasoning (no trivia)
- Align to competency and difficulty

Return JSON:
{"prompt":"...","expected_output":"..."}`

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.4,
    response_format: { type: 'json_object' },
    max_tokens: 600
  })

  const result = JSON.parse(completion.choices[0].message.content || '{}')
  return {
    prompt: result.prompt || 'Provide a structured response based on the blueprint constraints.',
    expected_output: result.expected_output || ''
  }
}

export async function generateAnswerSet(promptText: string, blueprint: any) {
  const prompt = `You are generating answer samples for validation.

Question prompt:
${promptText}

Rubric:
${JSON.stringify(blueprint.scoring_rubric)}

Return JSON:
{
  "gold": "...",
  "borderline": ["...", "..."],
  "bad": ["...", "..."]
}`

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.5,
    response_format: { type: 'json_object' },
    max_tokens: 800
  })

  const result = JSON.parse(completion.choices[0].message.content || '{}')
  return {
    gold: result.gold || '',
    borderline: Array.isArray(result.borderline) ? result.borderline : [],
    bad: Array.isArray(result.bad) ? result.bad : []
  }
}

export async function validateAnswerRanking(promptText: string, blueprint: any, answers: any) {
  const prompt = `You are the scoring model. Rank these answers using the rubric.

Prompt:
${promptText}

Rubric:
${JSON.stringify(blueprint.scoring_rubric)}

Answers:
Gold: ${answers.gold}
Borderline A: ${answers.borderline?.[0] || ''}
Borderline B: ${answers.borderline?.[1] || ''}
Bad A: ${answers.bad?.[0] || ''}
Bad B: ${answers.bad?.[1] || ''}

Return JSON:
{
  "ranked": ["gold", "borderline_a", "borderline_b", "bad_a", "bad_b"],
  "reason": "short explanation"
}`

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
    response_format: { type: 'json_object' },
    max_tokens: 300
  })

  return JSON.parse(completion.choices[0].message.content || '{}')
}

export async function runLeakageCheck(promptText: string) {
  const prompt = `Check if this question is easily googleable or trivia.
Prompt: ${promptText}
Return JSON: {"is_trivia": true/false, "reason": "short"}`

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1,
    response_format: { type: 'json_object' },
    max_tokens: 120
  })

  return JSON.parse(completion.choices[0].message.content || '{}')
}

export async function runBiasCheck(promptText: string) {
  const prompt = `Check if this question risks protected attributes or biased phrasing.
Prompt: ${promptText}
Return JSON: {"has_bias_risk": true/false, "reason": "short"}`

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1,
    response_format: { type: 'json_object' },
    max_tokens: 120
  })

  return JSON.parse(completion.choices[0].message.content || '{}')
}

export async function runStructuralCheck(promptText: string, expectedOutput: string, timeLimit: number) {
  const prompt = `Validate structural quality of this interview question.

Prompt: ${promptText}
Expected output: ${expectedOutput || '(missing)'}
Time limit minutes: ${timeLimit}

Return JSON:
{
  "clear_prompt": true/false,
  "clear_output": true/false,
  "time_bound": true/false,
  "ambiguous_scoring": true/false,
  "reason": "short"
}`

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1,
    response_format: { type: 'json_object' },
    max_tokens: 180
  })

  return JSON.parse(completion.choices[0].message.content || '{}')
}

export async function runAnswerabilityCheck(promptText: string, rubric: any, answers: any) {
  const prompt = `Score each answer using the rubric and return a strict ordering.

Prompt:
${promptText}

Rubric:
${JSON.stringify(rubric)}

Answers:
Gold: ${answers.gold}
Borderline A: ${answers.borderline?.[0] || ''}
Borderline B: ${answers.borderline?.[1] || ''}
Bad A: ${answers.bad?.[0] || ''}
Bad B: ${answers.bad?.[1] || ''}

Return JSON:
{
  "scores": {
    "gold": <0-100>,
    "borderline_a": <0-100>,
    "borderline_b": <0-100>,
    "bad_a": <0-100>,
    "bad_b": <0-100>
  },
  "ordered": ["gold", "borderline_a", "borderline_b", "bad_a", "bad_b"],
  "reason": "short"
}`

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
    response_format: { type: 'json_object' },
    max_tokens: 280
  })

  return JSON.parse(completion.choices[0].message.content || '{}')
}

export async function storeQuestionItem(blueprint: any, generated: any, validation: any) {
  const hash = createHash(`${blueprint.id}:${generated.prompt}:${generated.expected_output}`)
  const version = await getNextVersion(blueprint.id)

  const status = validation.passed ? 'validated' : 'rejected'

  const { data, error } = await supabaseAdmin
    .from('generated_question_items')
    .insert({
      blueprint_id: blueprint.id,
      track: blueprint.track,
      competency: blueprint.competency,
      difficulty: blueprint.difficulty,
      format: blueprint.format,
      prompt: generated.prompt,
      expected_output: generated.expected_output,
      scoring_rubric: blueprint.scoring_rubric,
      red_flags: blueprint.red_flags,
      anti_cheat_constraints: blueprint.anti_cheat_constraints,
      evidence_requirements: blueprint.evidence_requirements,
      time_limit_minutes: blueprint.time_limit_minutes,
      version,
      hash,
      status,
      validation_report: validation.report
    })
    .select()
    .single()

  if (error) throw error
  return data
}

async function getNextVersion(blueprintId: string) {
  const { data } = await supabaseAdmin
    .from('generated_question_items')
    .select('version')
    .eq('blueprint_id', blueprintId)
    .order('version', { ascending: false })
    .limit(1)

  const current = data?.[0]?.version || 0
  return current + 1
}

function createHash(input: string) {
  let hash = 0
  for (let i = 0; i < input.length; i += 1) {
    const chr = input.charCodeAt(i)
    hash = (hash << 5) - hash + chr
    hash |= 0
  }
  return `h_${Math.abs(hash)}`
}
