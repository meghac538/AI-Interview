'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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

    // Signal content to parent
    window.dispatchEvent(
      new CustomEvent('round-content-change', {
        detail: { round_number: round.round_number, hasContent: true }
      })
    )

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

  // Auto-save on timer expiry: submit final non-draft selection
  const selectedRef = useRef(selected)
  selectedRef.current = selected

  useEffect(() => {
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.round_number !== round.round_number || !session?.id) return
      if (!selectedRef.current) return
      const opt = options.find((o) => o.id === selectedRef.current)
      if (!opt) return
      await fetch('/api/artifact/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.id,
          round_number: round.round_number,
          artifact_type: 'mcq_response',
          content: opt.value,
          metadata: {
            draft: false,
            auto_saved: true,
            option_id: opt.id,
            option_label: opt.label
          }
        })
      }).catch(() => {})
    }
    window.addEventListener('round-auto-save', handler)
    return () => window.removeEventListener('round-auto-save', handler)
  }, [round.round_number, session?.id, options])

  if (!session) return null

  if (!options.length) {
    return (
      <div className="rounded-2xl border bg-card px-4 py-3 text-sm text-muted-foreground">
        Multiple-choice options are missing for this round. Please notify the interviewer.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card px-4 py-3 text-sm text-muted-foreground">
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
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border bg-card hover:border-primary/30'
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Option {String.fromCharCode(65 + index)}
                  </div>
                  {option.label && (
                    <div className="mt-2 text-sm font-semibold text-foreground">
                      {option.label}
                    </div>
                  )}
                </div>
                {isSelected && (
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase text-primary">
                    Selected
                  </span>
                )}
              </div>

              {option.description && (
                <p className="mt-2 text-sm text-muted-foreground">{option.description}</p>
              )}

              {option.code && (
                <pre className="mt-3 overflow-auto rounded-xl bg-muted p-3 text-xs text-foreground">
                  <code className="font-mono">{option.code}</code>
                </pre>
              )}
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-between rounded-2xl border bg-card px-4 py-3 text-xs text-muted-foreground">
        <span>{selected ? `Selected: ${selected}` : 'No option selected yet.'}</span>
        <span>{isSaving ? 'Saving selection...' : 'Selection autosaved'}</span>
      </div>
    </div>
  )
}
