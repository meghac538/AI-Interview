'use client'

import { Badge } from '@/components/ui/badge'
import { VoiceCallUI } from '@/components/rounds/VoiceCallUI'
import { EmailThreadUI } from '@/components/rounds/EmailThreadUI'
import { TextResponseUI } from '@/components/rounds/TextResponseUI'
import type { Round } from '@/lib/types/database'

export function TaskSurface({ round }: { round: Round }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone="sky">{round.round_type.toUpperCase()}</Badge>
        <h2 className="text-xl font-semibold text-ink-900">{round.title}</h2>
      </div>
      <p className="text-sm text-ink-600">{round.prompt}</p>

      {round.round_type === 'voice' && <VoiceCallUI round={round} />}
      {round.round_type === 'email' && <EmailThreadUI round={round} />}
      {round.round_type === 'text' && <TextResponseUI round={round} />}
      {round.round_type === 'code' && (
        <div className="rounded-2xl bg-ink-50 px-4 py-3">
          <p className="text-sm text-ink-600">Code editor UI coming in future phases...</p>
        </div>
      )}
    </div>
  )
}
