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

    const answerMap = new Map<string, string>()
    for (const answer of answers || []) {
      if (answer.payload?.question_id) {
        answerMap.set(answer.payload.question_id, answer.payload?.answer || '')
      }
    }

    const deduped = new Map<string, any>()
    for (const item of questionItems) {
      if (!deduped.has(item.id)) {
        deduped.set(item.id, item)
      }
    }

    const thread = Array.from(deduped.values()).map((item: any) => ({
      id: item.id,
      question: item.question,
      round_number: item.round_number,
      source: item.source,
      answered: answerMap.has(item.id),
      answer: answerMap.get(item.id)
    }))

    return NextResponse.json({ thread })
  } catch (error: any) {
    console.error('Followup thread error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
