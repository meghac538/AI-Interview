'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Send } from 'lucide-react'
import { useSession } from '@/contexts/SessionContext'
import type { Round } from '@/lib/types/database'

interface EmailMessage {
  from: 'prospect' | 'candidate'
  subject: string
  body: string
  timestamp: string
}

export function EmailThreadUI({ round }: { round: Round }) {
  const { session } = useSession()
  const [emailThread, setEmailThread] = useState<EmailMessage[]>([
    {
      from: 'prospect',
      subject: 'Re: Pricing Discussion',
      body: `Hi there,

Thanks for the proposal. We're very interested but I need to be honest - your pricing is about 20% higher than we budgeted for this project.

Is there any flexibility here? Also, we'd need to implement by end of Q1 which is 6 weeks away. Can you guarantee that timeline?

Looking forward to your response.

Best,
Sarah Chen
VP of Operations, MidSize Tech Corp`,
      timestamp: new Date(Date.now() - 3600000).toISOString()
    }
  ])

  const [draftSubject, setDraftSubject] = useState('Re: Pricing Discussion')
  const [draftBody, setDraftBody] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const sendEmail = async () => {
    if (!draftBody.trim() || !session) return

    setSubmitting(true)

    const newEmail: EmailMessage = {
      from: 'candidate',
      subject: draftSubject,
      body: draftBody,
      timestamp: new Date().toISOString()
    }

    // Add to thread
    setEmailThread((prev) => [...prev, newEmail])

    // Submit to API
    await fetch('/api/artifact/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: session.id,
        round_number: round.round_number,
        artifact_type: 'email_draft',
        content: draftBody,
        metadata: {
          subject: draftSubject,
          thread_position: emailThread.length,
          timestamp: new Date().toISOString()
        }
      })
    })

    // Clear draft
    setDraftBody('')
    setSubmitting(false)

    // Simulate prospect response (will be AI-generated in Phase 5)
    if (emailThread.length === 1) {
      setTimeout(() => {
        setEmailThread((prev) => [
          ...prev,
          {
            from: 'prospect',
            subject: 'Re: Pricing Discussion',
            body: `Thanks for getting back to me.

I appreciate your response, but I'm still concerned about the timeline. Our CFO is also pushing back on any pricing above our original budget.

Can you guarantee Q1 delivery AND bring the price down to match our budget? Otherwise, I'll need to explore other options.

This is urgent - I need your final answer by EOD.

Sarah`,
            timestamp: new Date().toISOString()
          }
        ])
      }, 5000)
    }
  }

  if (!session) return null

  return (
    <div className="space-y-4">
      {/* Email Thread */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Email Thread</h3>
        {emailThread.map((email, index) => (
          <div
            key={index}
            className={`rounded-2xl border px-4 py-4 ${
              email.from === 'candidate'
                ? 'border-ink-200 bg-ink-50'
                : 'border-skywash-200 bg-skywash-50'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-ink-500">
              <span className="font-semibold">
                {email.from === 'candidate' ? 'You' : 'Sarah Chen (Prospect)'}
              </span>
              <span>{new Date(email.timestamp).toLocaleString()}</span>
            </div>
            <div className="mt-2 font-semibold text-sm text-ink-900">
              {email.subject}
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm text-ink-700">
              {email.body}
            </p>
          </div>
        ))}
      </div>

      {/* Email Composer */}
      {emailThread.length < 3 && (
        <div className="space-y-3 rounded-2xl border border-ink-200 bg-white px-4 py-4">
          <h3 className="text-sm font-semibold">
            Your Response {emailThread.length === 2 ? '(Draft 2)' : '(Draft 1)'}
          </h3>
          <Input
            placeholder="Subject line"
            value={draftSubject}
            onChange={(e) => setDraftSubject(e.target.value)}
          />
          <Textarea
            rows={12}
            placeholder="Draft your professional response...

Tips:
- Acknowledge their concerns
- Justify your value proposition
- Address timeline realistically
- Protect your margins
- Be firm but collaborative"
            value={draftBody}
            onChange={(e) => setDraftBody(e.target.value)}
          />
          <div className="flex justify-between items-center">
            <span className="text-xs text-ink-500">
              Word count: {draftBody.split(/\s+/).filter(Boolean).length}
            </span>
            <Button
              size="sm"
              onClick={sendEmail}
              disabled={!draftBody.trim() || submitting}
            >
              <Send className="mr-2 h-4 w-4" />
              {submitting ? 'Sending...' : 'Send Email'}
            </Button>
          </div>
        </div>
      )}

      {emailThread.length === 3 && (
        <div className="rounded-2xl bg-signal-50 border border-signal-200 px-4 py-3">
          <p className="text-sm text-signal-800">
            <strong>Round Complete:</strong> You've sent both responses. Click "Submit & Next" to complete this round.
          </p>
        </div>
      )}

      {/* Scoring Criteria */}
      <div className="rounded-2xl border border-ink-100 bg-white px-4 py-4">
        <h3 className="mb-3 text-sm font-semibold">Evaluation Criteria</h3>
        <ul className="space-y-2 text-sm text-ink-600">
          <li>• <strong>Negotiation posture:</strong> Firm but collaborative</li>
          <li>• <strong>Professionalism:</strong> Clear, respectful tone</li>
          <li>• <strong>Rejection handling:</strong> No desperation or defensiveness</li>
          <li>• <strong>Margin protection:</strong> Justify value, don't cave on price</li>
          <li>• <strong>Realistic commitments:</strong> Only promise what you can deliver</li>
        </ul>
      </div>
    </div>
  )
}
