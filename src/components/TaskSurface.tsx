'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { VoiceCallUI } from '@/components/rounds/VoiceCallUI'
import { VoiceRealtimeUI } from '@/components/rounds/VoiceRealtimeUI'
import { EmailThreadUI } from '@/components/rounds/EmailThreadUI'
import { TextResponseUI } from '@/components/rounds/TextResponseUI'
import { MultipleChoiceUI } from '@/components/rounds/MultipleChoiceUI'
import { CodeEditorUI } from '@/components/rounds/CodeEditorUI'
import type { Event, Round } from '@/lib/types/database'
import { useMemo } from 'react'

function formatPersonaLabel(value: string) {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) return null
  return normalized
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function TaskSurface({ round, events }: { round: Round; events?: Event[] }) {
  const config = (round as any)?.config || {}
  const persona = config.persona_override || config.persona
  const injectedCurveballs = Array.isArray(config.injected_curveballs) ? config.injected_curveballs : []

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

      {(persona || injectedCurveballs.length > 0) && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="space-y-3 pt-6">
            {persona ? (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="secondary">Persona</Badge>
                <span className="font-medium">{formatPersonaLabel(persona) || String(persona)}</span>
              </div>
            ) : null}

            {injectedCurveballs.length > 0 ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="outline">Injected constraints</Badge>
                  <span className="text-muted-foreground">Added live by the interviewer.</span>
                </div>
                <div className="grid gap-2">
                  {injectedCurveballs.slice(-3).map((item: any, index: number) => (
                    <div key={`${item?.key || item?.title || index}`} className="rounded-lg border bg-background/40 p-3">
                      <p className="text-sm font-semibold">
                        {String(injectedCurveballs.length - Math.min(3, injectedCurveballs.length) + index + 1).padStart(2, '0')}.{' '}
                        {item?.title || item?.key || 'Constraint'}
                      </p>
                      {item?.detail ? (
                        <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {round.round_type === 'voice' && <VoiceCallUI round={round} />}
      {round.round_type === 'voice-realtime' && <VoiceRealtimeUI round={round} />}
      {round.round_type === 'email' && <EmailThreadUI round={round} />}
      {round.round_type === 'text' && <TextResponseUI round={round} />}
      {round.round_type === 'mcq' && <MultipleChoiceUI round={round} />}
      {round.round_type === 'code' && <CodeEditorUI round={round} />}
    </div>
  )
}
