'use client'

import { useMemo, useState } from 'react'
import { useSession } from '@/contexts/SessionContext'
import type { Round } from '@/lib/types/database'
import { cn } from '@/lib/utils'

interface MCQOption {
  id: string
  label: string
  value: string
  code?: string
  description?: string
}

function buildOptions(config: Record<string, any>): MCQOption[] {
  const raw = config?.options || config?.choices || config?.mcq?.options || []

  if (!Array.isArray(raw)) return []

  return raw
    .map((option, index) => {
      const fallbackId = String.fromCharCode(65 + index)

      if (typeof option === 'string') {
        return {
          id: fallbackId,
          label: option,
          value: option
        }
      }

      if (typeof option !== 'object' || option === null) return null

      const label = option.label || option.text || option.title || ''
      const code = option.code || option.snippet || ''
      const value = option.value || option.answer || label || code || fallbackId

      return {
        id: String(option.id || option.key || fallbackId),
        label,
        value,
        code: code || undefined,
        description: option.description || undefined
      }
    })
    .filter(Boolean) as MCQOption[]
}

export function MultipleChoiceUI({ round }: { round: Round }) {
  const { session } = useSession()
  const [selected, setSelected] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const options = useMemo(() => buildOptions(round.config || {}), [round.config])

  const handleSelect = async (option: MCQOption) => {
    setSelected(option.id)

    if (!session) return

    setIsSaving(true)
    await fetch('/api/artifact/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: session.id,
        round_number: round.round_number,
        artifact_type: 'mcq_response',
        content: option.value,
        metadata: {
          draft: true,
          option_id: option.id,
          option_label: option.label,
          option_code: option.code || null,
          option_description: option.description || null
        }
      })
    })
    setIsSaving(false)
  }

  if (!session) return null

  if (!options.length) {
    return (
      <div className="rounded-2xl border border-ink-100 bg-white px-4 py-3 text-sm text-ink-600">
        Multiple-choice options are missing for this round. Please notify the interviewer.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-ink-100 bg-white px-4 py-3 text-sm text-ink-600">
        Select the best answer. You can change your selection before submitting the round.
      </div>

      <div className="space-y-3">
        {options.map((option, index) => {
          const isSelected = selected === option.id
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => handleSelect(option)}
              className={cn(
                'w-full rounded-2xl border px-4 py-4 text-left transition',
                isSelected
                  ? 'border-skywash-400 bg-skywash-50 shadow-sm'
                  : 'border-ink-100 bg-white hover:border-ink-200'
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-ink-500">
                    Option {String.fromCharCode(65 + index)}
                  </div>
                  {option.label && (
                    <div className="mt-2 text-sm font-semibold text-ink-900">
                      {option.label}
                    </div>
                  )}
                </div>
                {isSelected && (
                  <span className="rounded-full bg-skywash-100 px-3 py-1 text-[11px] font-semibold uppercase text-skywash-700">
                    Selected
                  </span>
                )}
              </div>

              {option.description && (
                <p className="mt-2 text-sm text-ink-600">{option.description}</p>
              )}

              {option.code && (
                <pre className="mt-3 overflow-auto rounded-xl bg-ink-50 p-3 text-xs text-ink-800">
                  <code className="font-mono">{option.code}</code>
                </pre>
              )}
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-ink-100 bg-white px-4 py-3 text-xs text-ink-500">
        <span>{selected ? `Selected: ${selected}` : 'No option selected yet.'}</span>
        <span>{isSaving ? 'Saving selection…' : 'Selection autosaved'}</span>
      </div>
    </div>
  )
}
