'use client'

import { AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { VoiceCallUI } from '@/components/rounds/VoiceCallUI'
import { VoiceRealtimeUI } from '@/components/rounds/VoiceRealtimeUI'
import { EmailThreadUI } from '@/components/rounds/EmailThreadUI'
import { TextResponseUI } from '@/components/rounds/TextResponseUI'
import { MultipleChoiceUI } from '@/components/rounds/MultipleChoiceUI'
import { CodeEditorUI } from '@/components/rounds/CodeEditorUI'
import { AgenticChatUI } from '@/components/rounds/AgenticChatUI'
import type { Event, Round } from '@/lib/types/database'
import { useMemo } from 'react'

// Round types where the AI handles curveballs in conversation — don't show to candidate
const CONVERSATIONAL_ROUNDS = new Set(['voice', 'voice-realtime', 'email', 'agentic'])

export function TaskSurface({ round, events }: { round: Round; events?: Event[] }) {
  const injectedCurveballs = Array.isArray(round.config?.injected_curveballs)
    ? round.config.injected_curveballs
    : []
  const showCurveballUpdates = injectedCurveballs.length > 0 && !CONVERSATIONAL_ROUNDS.has(round.round_type)
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
        <Badge variant="outline">{round.round_type.toUpperCase()}</Badge>
        <h2 className="text-xl font-semibold">{round.title}</h2>
      </div>

      {effectivePdfUrl && (
        <div className="rounded-xl border bg-muted/20 px-4 py-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {round.config?.pdf_title || 'Reference Document'}
          </div>
          <iframe
            title={round.config?.pdf_title || 'Reference document'}
            src={`${effectivePdfUrl}#toolbar=0&navpanes=0&scrollbar=0`}
            className="h-[480px] w-full rounded-xl border"
          />
        </div>
      )}

      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{round.prompt}</p>

      {showCurveballUpdates && (
        <div className="space-y-3">
          {injectedCurveballs.map((item: any, index: number) => (
            <Card
              key={`${item?.key || index}-${item?.injected_at || index}`}
              className="border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30 animate-in fade-in slide-in-from-top-2"
            >
              <CardContent className="flex items-start gap-3 pt-5 pb-4">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-amber-400 text-amber-700 dark:border-amber-600 dark:text-amber-300 text-[10px]">
                      Scenario Update
                    </Badge>
                    {item?.injected_at && (
                      <span className="text-[10px] text-amber-500 dark:text-amber-400/70">
                        {new Date(item.injected_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                    {item?.title || 'New constraint'}
                  </p>
                  {item?.detail && (
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      {item.detail}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {round.round_type === 'voice' && <VoiceCallUI round={round} />}
      {round.round_type === 'voice-realtime' && <VoiceRealtimeUI round={round} />}
      {round.round_type === 'email' && <EmailThreadUI round={round} />}
      {round.round_type === 'text' && <TextResponseUI round={round} />}
      {round.round_type === 'mcq' && <MultipleChoiceUI round={round} />}
      {round.round_type === 'code' && <CodeEditorUI round={round} />}
      {round.round_type === 'agentic' && <AgenticChatUI round={round} />}
    </div>
  )
}
