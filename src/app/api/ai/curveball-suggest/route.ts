import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getAIClient, mapModel } from '@/lib/ai/client'
import { fetchScopePackage, getActiveRoundNumber } from '@/lib/db/helpers'
import { randomUUID } from 'crypto'

export async function POST(request: Request) {
  try {
    const { session_id, round_number } = await request.json()

    if (!session_id) {
      return NextResponse.json({ error: 'session_id is required' }, { status: 400 })
    }

    // 1. Fetch scope package and find active round
    const scopePackage = await fetchScopePackage(session_id)
    const roundPlan = (scopePackage.round_plan || []) as Array<Record<string, any>>

    const targetRoundNumber = round_number ?? getActiveRoundNumber(roundPlan)
    const targetRound = roundPlan.find((r) => r.round_number === targetRoundNumber)

    if (!targetRound) {
      return NextResponse.json({ error: 'No active round found' }, { status: 404 })
    }

    // 2. Only text rounds supported
    if (targetRound.round_type !== 'text') {
      return NextResponse.json(
        { error: 'Curveball suggestions are only available for text rounds' },
        { status: 400 }
      )
    }

    // 3. Fetch candidate's latest written response
    const { data: artifacts } = await supabaseAdmin
      .from('artifacts')
      .select('content, metadata, artifact_type')
      .eq('session_id', session_id)
      .eq('round_number', targetRoundNumber)
      .in('artifact_type', ['text_response', 'structured_response'])
      .order('created_at', { ascending: false })
      .limit(1)

    const candidateContent = artifacts?.[0]?.content || ''
    const wordCount = candidateContent.split(/\s+/).filter(Boolean).length

    if (wordCount < 50) {
      return NextResponse.json({
        suggestions: [],
        context_summary: 'Candidate has not written enough yet to generate targeted suggestions.'
      })
    }

    // 4. Gather round context
    const track = targetRound.config?.track || scopePackage.simulation_payloads?.track || ''
    const competency = targetRound.config?.competency || targetRound.title || ''
    const scoringDimensions = targetRound.config?.scoring_rubric?.dimensions
      ?.map((d: any) => d.name)
      ?.join(', ') || ''
    const injectedCurveballs = Array.isArray(targetRound.config?.injected_curveballs)
      ? targetRound.config.injected_curveballs
      : []
    const alreadyInjected = injectedCurveballs.length > 0
      ? injectedCurveballs.map((c: any) => `- ${c.title}: ${c.detail}`).join('\n')
      : ''

    // 5. Build AI prompt
    const systemPrompt = `You are an interview design strategist. You analyze a candidate's in-progress written response during a live assessment and suggest targeted curveball challenges for the interviewer to inject.

A "curveball" is a surprise constraint, scenario change, or pressure test injected mid-round to evaluate how the candidate adapts under pressure. Good curveballs:
- Are SPECIFIC to what the candidate actually wrote (not generic)
- Target gaps, weak assumptions, or overconfidence visible in the candidate's response
- Test adaptability, composure, and problem-solving under changed conditions
- Are realistic scenarios that could happen in the actual role

Context about this interview round:
- Track: ${track}
- Round title: ${targetRound.title}
- Round prompt: ${(targetRound.prompt || '').slice(0, 800)}
- Competency being assessed: ${competency}
- Scoring dimensions: ${scoringDimensions}
${alreadyInjected ? `- Already injected curveballs (DO NOT repeat or suggest similar):\n${alreadyInjected}` : ''}

Candidate's current written response (${wordCount} words):
${candidateContent.slice(0, 3000)}

Generate 2-3 targeted curveball suggestions. Each must:
1. Reference something SPECIFIC the candidate wrote
2. Include a brief rationale explaining WHY this curveball is valuable now
3. Be actionable as a 1-2 sentence constraint the interviewer can inject

Return a JSON object:
{
  "suggestions": [
    {
      "title": "<short 3-6 word title>",
      "detail": "<1-2 sentence curveball text to show the candidate>",
      "rationale": "<why this curveball is valuable based on what the candidate wrote>",
      "priority": "<medium|high>",
      "source_evidence": "<brief quote from candidate's response that triggered this>"
    }
  ],
  "context_summary": "<1 sentence summary of what you observed in the candidate's work>"
}`

    // 6. Call AI
    const response = await getAIClient().chat.completions.create({
      model: mapModel('gpt-4o'),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Analyze the candidate response above and return the JSON object with curveball suggestions.' }
      ],
      temperature: 0.7,
      max_tokens: 800
    })

    let raw = response.choices[0]?.message?.content || '{}'
    // Strip markdown code fences if present
    raw = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
    let parsed: any
    try {
      parsed = JSON.parse(raw)
    } catch {
      console.error('Failed to parse curveball suggestions JSON:', raw)
      return NextResponse.json({
        suggestions: [],
        context_summary: 'AI returned invalid response format.'
      })
    }

    // 7. Add UUIDs and return
    const suggestions = Array.isArray(parsed.suggestions)
      ? parsed.suggestions.map((s: any) => ({
          id: randomUUID(),
          title: s.title || 'Curveball',
          detail: s.detail || '',
          rationale: s.rationale || '',
          priority: s.priority || 'medium',
          source_evidence: s.source_evidence || ''
        }))
      : []

    return NextResponse.json({
      suggestions,
      context_summary: parsed.context_summary || '',
      generated_at: new Date().toISOString()
    })
  } catch (error: any) {
    console.error('Curveball suggestion error:', error?.message || error)
    return NextResponse.json(
      { suggestions: [], context_summary: 'Failed to generate suggestions.', error: error?.message || 'Unknown error' },
      { status: 500 }
    )
  }
}
