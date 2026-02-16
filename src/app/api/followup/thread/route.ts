import { NextResponse } from 'next/server'
import { fetchFollowupEvents } from '@/lib/db/helpers'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { session_id } = await request.json()

    if (!session_id) {
      return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })
    }

    const { questions, answers, manualQuestions } = await fetchFollowupEvents(session_id, 500)

    const questionItems = [
      ...(questions || []).map((event: any) => ({
        id: event.payload?.question_id,
        question: event.payload?.question || '',
        round_number: event.payload?.round_number ?? null,
        source: event.payload?.source || 'auto',
        created_at: event.created_at
      })),
      ...manualQuestions.map((event: any) => ({
        id: event.payload?.question_id || `manual-${event.id}`,
        question: event.payload?.question,
        round_number: event.payload?.round_number ?? null,
        source: 'manual',
        created_at: event.created_at
      }))
    ]
      .filter((item) => item.id && item.question)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

    // Dual answer matching: by question_id (UUID) AND by question text
    const answerByIdMap = new Map<string, string>()
    const answerByTextMap = new Map<string, string>()
    for (const answer of answers || []) {
      const ans = answer.payload?.answer || ''
      if (answer.payload?.question_id) {
        answerByIdMap.set(answer.payload.question_id, ans)
      }
      const qText = String(answer.payload?.question || '').toLowerCase().trim()
      if (qText) {
        answerByTextMap.set(qText, ans)
      }
    }

    // Deduplicate by ID first, then by question text
    const seenIds = new Set<string>()
    const seenTexts = new Set<string>()
    const deduped: typeof questionItems = []
    for (const item of questionItems) {
      if (item.id && seenIds.has(item.id)) continue
      const textKey = (item.question || '').toLowerCase().trim()
      if (textKey && seenTexts.has(textKey)) continue
      if (item.id) seenIds.add(item.id)
      if (textKey) seenTexts.add(textKey)
      deduped.push(item)
    }

    const thread = deduped.map((item: any) => {
      const textKey = (item.question || '').toLowerCase().trim()
      const answeredById = item.id ? answerByIdMap.has(item.id) : false
      const answeredByText = textKey ? answerByTextMap.has(textKey) : false
      const isAnswered = answeredById || answeredByText
      return {
        id: item.id,
        question: item.question,
        round_number: item.round_number,
        source: item.source,
        answered: isAnswered,
        answer: answeredById
          ? answerByIdMap.get(item.id)
          : answeredByText
            ? answerByTextMap.get(textKey)
            : undefined
      }
    })

    return NextResponse.json({ thread })
  } catch (error: any) {
    console.error('Followup thread error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
