'use client'

import { useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { useSession } from '@/contexts/SessionContext'
import type { Round } from '@/lib/types/database'

export function TextResponseUI({ round }: { round: Round }) {
  const { session } = useSession()
  const [response, setResponse] = useState('')

  const handleChange = async (value: string) => {
    setResponse(value)

    // Auto-save draft to backend
    if (value.length > 0 && session) {
      await fetch('/api/artifact/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.id,
          round_number: round.round_number,
          artifact_type: 'text_response',
          content: value,
          metadata: {
            draft: true,
            word_count: value.split(/\s+/).filter(Boolean).length
          }
        })
      })
    }
  }

  const wordCount = response.split(/\s+/).filter(Boolean).length

  if (!session) return null

  return (
    <div className="space-y-4">
      <Textarea
        rows={14}
        placeholder="Write your internal handoff note here...

Example structure:
- Deal summary (customer, opportunity size, timeline)
- Key commitments made
- Open questions or risks
- Next steps for the account team
- Who needs to be involved"
        value={response}
        onChange={(e) => handleChange(e.target.value)}
        className="font-sans"
      />

      <div className="rounded-2xl border border-ink-100 bg-white px-4 py-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-ink-500">Word count: {wordCount}</span>
          {wordCount > 0 && wordCount < 50 && (
            <span className="text-caution-600">Aim for at least 50 words</span>
          )}
          {wordCount >= 50 && wordCount < 200 && (
            <span className="text-signal-600">Good length</span>
          )}
          {wordCount >= 200 && (
            <span className="text-ink-500">Comprehensive</span>
          )}
        </div>
      </div>

      {round.config?.optional && (
        <div className="rounded-2xl bg-skywash-50 px-4 py-3">
          <p className="text-sm text-skywash-800">
            <strong>Note:</strong> This is an optional round. You may skip to complete the interview,
            but completing it demonstrates strong follow-up discipline.
          </p>
        </div>
      )}

      <div className="rounded-2xl border border-ink-100 bg-white px-4 py-4">
        <h3 className="mb-3 text-sm font-semibold">What to Include</h3>
        <ul className="space-y-2 text-sm text-ink-600">
          <li>✓ Deal status summary (where we are, what was discussed)</li>
          <li>✓ Key commitments made (timeline, pricing, deliverables)</li>
          <li>✓ Identified risks or red flags</li>
          <li>✓ Next steps with owners and deadlines</li>
          <li>✓ Who needs to be looped in (sales eng, legal, product)</li>
        </ul>
      </div>
    </div>
  )
}
