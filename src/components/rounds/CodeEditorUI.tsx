'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { useSession } from '@/contexts/SessionContext'
import type { Round } from '@/lib/types/database'

export function CodeEditorUI({ round }: { round: Round }) {
  const { session } = useSession()
  const initialCode = typeof round.config?.starter_code === 'string' ? round.config.starter_code : ''
  const languageOptions = Array.isArray(round.config?.languages)
    ? round.config.languages
    : round.config?.language
      ? [round.config.language]
      : []

  const [code, setCode] = useState(initialCode)
  const [language, setLanguage] = useState(languageOptions[0] || 'plaintext')
  const [isSaving, setIsSaving] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const lineCount = useMemo(() => code.split(/\n/).length, [code])

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [])

  const saveDraft = async (payload: { code: string; language: string }) => {
    if (!session) return
    setIsSaving(true)
    await fetch('/api/artifact/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: session.id,
        round_number: round.round_number,
        artifact_type: 'code_response',
        content: payload.code,
        metadata: {
          draft: true,
          language: payload.language,
          line_count: payload.code.split(/\n/).length,
          char_count: payload.code.length
        }
      })
    })
    setLastSavedAt(new Date())
    setIsSaving(false)
  }

  const scheduleSave = (nextCode: string, nextLanguage = language) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveDraft({ code: nextCode, language: nextLanguage })
    }, 700)
  }

  const handleCodeChange = (value: string) => {
    setCode(value)
    scheduleSave(value)
  }

  const handleLanguageChange = (value: string) => {
    setLanguage(value)
    scheduleSave(code, value)
  }

  if (!session) return null

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-ink-100 bg-white px-4 py-3 text-sm text-ink-600">
        Use the editor below to write your solution. It will autosave as you type.
      </div>

      {languageOptions.length > 0 && (
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-500">
            Language
          </label>
          <Select value={language} onChange={(e) => handleLanguageChange(e.target.value)}>
            {languageOptions.map((lang: string) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </Select>
        </div>
      )}

      <Textarea
        rows={18}
        value={code}
        onChange={(e) => handleCodeChange(e.target.value)}
        placeholder="Write your solution here..."
        className="min-h-[320px] font-mono text-xs"
      />

      <div className="flex flex-wrap items-center justify-between rounded-2xl border border-ink-100 bg-white px-4 py-3 text-xs text-ink-500">
        <span>Lines: {lineCount} • Characters: {code.length}</span>
        <span>
          {isSaving
            ? 'Saving…'
            : lastSavedAt
              ? `Saved at ${lastSavedAt.toLocaleTimeString()}`
              : 'Draft not saved yet'}
        </span>
      </div>

      {round.config?.evaluation_focus && (
        <div className="rounded-2xl border border-ink-100 bg-white px-4 py-3 text-sm text-ink-600">
          <strong className="text-ink-800">Evaluation focus:</strong> {round.config.evaluation_focus}
        </div>
      )}
    </div>
  )
}
