'use client'

import { Badge } from '@/components/ui/badge'
import { VoiceCallUI } from '@/components/rounds/VoiceCallUI'
import { VoiceRealtimeUI } from '@/components/rounds/VoiceRealtimeUI'
import { EmailThreadUI } from '@/components/rounds/EmailThreadUI'
import { TextResponseUI } from '@/components/rounds/TextResponseUI'
import { MultipleChoiceUI } from '@/components/rounds/MultipleChoiceUI'
import { CodeEditorUI } from '@/components/rounds/CodeEditorUI'
import type { Event, Round } from '@/lib/types/database'
import { useMemo } from 'react'

export function TaskSurface({ round, events }: { round: Round; events?: Event[] }) {
  const effectivePdfUrl = useMemo(() => {
    if (!round.config?.pdf_by_difficulty && !round.config?.pdf_url) {
      return undefined
    }

    const relevant = (events || [])
      .filter(
        (event: any) =>
          (event.event_type === 'difficulty_escalation' ||
            (event.event_type === 'interviewer_action' &&
              event.payload?.action_type === 'escalate_difficulty')) &&
          (event.payload?.target_round ?? event.payload?.round_number) === round.round_number
      )
      .sort(
        (a: any, b: any) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )

    const latest = relevant[relevant.length - 1]
    const overrideLevel = latest?.payload?.level || latest?.payload?.difficulty

    if (overrideLevel && round.config?.pdf_by_difficulty?.[overrideLevel]) {
      return round.config.pdf_by_difficulty[overrideLevel]
    }

    return round.config?.pdf_url
  }, [events, round])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone="sky">{round.round_type.toUpperCase()}</Badge>
        <h2 className="text-xl font-semibold text-ink-900">{round.title}</h2>
      </div>
      {effectivePdfUrl && (
        <div className="rounded-2xl border border-ink-100 bg-white px-4 py-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-ink-500">
            {round.config?.pdf_title || 'Reference Document'}
          </div>
          <iframe
            title={round.config?.pdf_title || 'Reference document'}
            src={`${effectivePdfUrl}#toolbar=0&navpanes=0&scrollbar=0`}
            className="h-[480px] w-full rounded-xl border border-ink-100"
          />
        </div>
      )}
      <p className="text-sm text-ink-600 whitespace-pre-wrap">{round.prompt}</p>

      {round.round_type === 'voice' && <VoiceCallUI round={round} />}
      {round.round_type === 'voice-realtime' && <VoiceRealtimeUI round={round} />}
      {round.round_type === 'email' && <EmailThreadUI round={round} />}
      {round.round_type === 'text' && <TextResponseUI round={round} />}
      {round.round_type === 'mcq' && <MultipleChoiceUI round={round} />}
      {round.round_type === 'code' && <CodeEditorUI round={round} />}
    </div>
  )
}
