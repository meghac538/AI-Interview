import { NextResponse } from 'next/server'
import { getAIClient, mapModel } from '@/lib/ai/client'

type DimensionInput = { label: string; score: number; max?: number }
type RedFlagInput = { label: string; detail?: string; severity?: string }
type TruthLogInput = { dimension: string; quote: string }

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { overall, confidence, dimensions, redFlags, truthLog, followups } = body as {
      overall?: number
      confidence?: number
      dimensions?: DimensionInput[]
      redFlags?: RedFlagInput[]
      truthLog?: TruthLogInput[]
      followups?: string[]
    }

    const hasData =
      (overall !== undefined && overall > 0) ||
      (dimensions && dimensions.some((d) => (d.score ?? 0) > 0)) ||
      (redFlags && redFlags.length > 0) ||
      (truthLog && truthLog.length > 0)

    if (!hasData) {
      return NextResponse.json({
        summary: 'No scores or evidence yet. Complete rounds and trigger scoring to generate an AI summary.'
      })
    }

    const dimensionText =
      dimensions && dimensions.length > 0
        ? dimensions
            .map((d) => `${d.label}: ${d.score}/${d.max ?? 100}`)
            .join('; ')
        : 'No dimension scores'

    const redFlagText =
      redFlags && redFlags.length > 0
        ? redFlags.map((f) => `- ${f.label}: ${f.detail || ''}`).join('\n')
        : 'None'

    const evidenceText =
      truthLog && truthLog.length > 0
        ? truthLog
            .map((e) => `[${e.dimension}]: "${e.quote}"`)
            .join('\n')
        : 'None'

    const followupText =
      followups && followups.length > 0 ? followups.join('; ') : 'None'

    const prompt = `You are an experienced hiring manager reviewing interview scores in real time. Write a brief, professional summary (2–4 sentences) of how the interview is going based on this data.

Dimension scores: ${dimensionText}
Overall score: ${overall ?? 'N/A'} (confidence: ${confidence != null ? Math.round(confidence * 100) : 'N/A'}%)

Red flags:
${redFlagText}

Evidence excerpts:
${evidenceText}

Suggested follow-ups: ${followupText}

Write a concise narrative that highlights strengths, concerns, and next steps. Be direct and actionable. Do not use bullet points—use flowing prose.`

    const completion = await getAIClient().chat.completions.create({
      model: mapModel('gpt-4o'),
      messages: [
        {
          role: 'system',
          content:
            'You summarize interview performance data concisely for hiring managers. Use clear, professional language. Output only the summary text, no headers or labels.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.5,
      max_tokens: 400
    })

    const summary =
      completion.choices[0]?.message?.content?.trim() ||
      'Unable to generate summary.'

    return NextResponse.json({ summary })
  } catch (error: any) {
    console.error('Interview summary error:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to generate summary' },
      { status: 500 }
    )
  }
}
