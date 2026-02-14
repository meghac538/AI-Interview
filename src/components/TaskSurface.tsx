'use client'

import { VoiceCallUI } from '@/components/rounds/VoiceCallUI'
import { EmailThreadUI } from '@/components/rounds/EmailThreadUI'
import { TextResponseUI } from '@/components/rounds/TextResponseUI'
import { MultiChannelUI } from '@/components/rounds/MultiChannelUI'
import type { Round } from '@/lib/types/database'

export function TaskSurface({ round }: { round: Round }) {
  return (
    <div className="space-y-4">
      {round.round_type === 'voice' && <VoiceCallUI round={round} />}
      {round.round_type === 'email' && <EmailThreadUI round={round} />}
      {round.round_type === 'text' && <TextResponseUI round={round} />}
      {round.round_type === 'multi_channel' && <MultiChannelUI round={round} />}
      {round.round_type === 'code' && (
        <div className="rounded-2xl bg-ink-50 px-4 py-3">
          <p className="text-sm text-ink-600">Code editor UI coming in future phases...</p>
        </div>
      )}
    </div>
  )
}
