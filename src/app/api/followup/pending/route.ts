import { NextResponse } from 'next/server'
import { fetchFollowupEvents } from '@/lib/db/helpers'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { session_id, round_number } = await request.json()

    if (!session_id) {
      return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })
    }

    const roundNumber = round_number ?? null
    const { combined: allQuestions, answers } = await fetchFollowupEvents(session_id)

    const filteredQuestions = allQuestions.filter((event: any) => {
      if (roundNumber == null) return true
      return (
        Number(event.payload?.round_number) === Number(roundNumber) ||
        event.payload?.round_number == null
      )
    })

    const filteredAnswers = (answers || []).filter((event: any) => {
      if (roundNumber == null) return true
      return (
        Number(event.payload?.round_number) === Number(roundNumber) ||
        event.payload?.round_number == null
      )
    })

    const answeredIds = new Set(
      filteredAnswers.map((event: any) => event.payload?.question_id).filter(Boolean)
    )

    const unanswered = filteredQuestions.filter(
      (event: any) => event.payload?.question_id && !answeredIds.has(event.payload.question_id)
    )

    const unansweredForRound = roundNumber == null
      ? unanswered
      : unanswered.filter((event: any) => Number(event.payload?.round_number) === Number(roundNumber))

    const unansweredFallback = roundNumber == null
      ? unanswered
      : unanswered.filter((event: any) => event.payload?.round_number == null)

    const byNewest = (a: any, b: any) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()

    const manualForRound = unansweredForRound
      .filter((event: any) => event.payload?.source === 'manual')
      .sort(byNewest)

    const manualFallback = unansweredFallback
      .filter((event: any) => event.payload?.source === 'manual')
      .sort(byNewest)

    const pending =
      manualForRound[0] ||
      manualFallback[0] ||
      unansweredForRound.sort(byNewest)[0] ||
      unansweredFallback.sort(byNewest)[0]

    if (!pending) {
      return NextResponse.json({ pending: false })
    }

    return NextResponse.json({
      pending: true,
      question_id: pending.payload?.question_id,
      question: pending.payload?.question,
      round_number: pending.payload?.round_number ?? null
    })
  } catch (error: any) {
    console.error('Pending followup error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
