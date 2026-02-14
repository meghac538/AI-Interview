'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Send, Loader2 } from 'lucide-react'
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
  const isImplementation = round.config?.track === 'implementation'
  const initialEmail = round.config?.initial_email
  const personaType = round.config?.persona_type

  const [emailThread, setEmailThread] = useState<EmailMessage[]>([
    {
      from: 'prospect',
      subject: initialEmail?.subject || 'Re: Pricing Discussion',
      body: initialEmail?.body || `Hi there,

Thanks for the proposal. We're very interested but I need to be honest - your pricing is about 20% higher than we budgeted for this project.

Is there any flexibility here? Also, we'd need to implement by end of Q1 which is 6 weeks away. Can you guarantee that timeline?

Looking forward to your response.

Best,
Sarah Chen
VP of Operations, MidSize Tech Corp`,
      timestamp: new Date(Date.now() - 3600000).toISOString()
    }
  ])

  const senderName = initialEmail?.from || 'Sarah Chen'
  const senderTitle = initialEmail?.title || 'Prospect'

  const [draftSubject, setDraftSubject] = useState(
    `Re: ${initialEmail?.subject || 'Pricing Discussion'}`
  )
  const [draftBody, setDraftBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [waitingForReply, setWaitingForReply] = useState(false)

  const sendEmail = async () => {
    if (!draftBody.trim() || !session) return

    setSubmitting(true)

    const newEmail: EmailMessage = {
      from: 'candidate',
      subject: draftSubject,
      body: draftBody,
      timestamp: new Date().toISOString()
    }

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

    setDraftBody('')
    setSubmitting(false)

    // Get AI response for the prospect's reply
    if (emailThread.length === 1) {
      setWaitingForReply(true)
      try {
        const aiResponse = await fetch('/api/ai/prospect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: session.id,
            round_number: round.round_number,
            message: draftBody,
            conversation_history: [],
            persona_state: 'neutral',
            metrics: {},
            persona_type: personaType || 'sales_prospect'
          })
        })
        const data = await aiResponse.json()
        setEmailThread((prev) => [
          ...prev,
          {
            from: 'prospect',
            subject: `Re: ${draftSubject}`,
            body: data.response || 'Thank you for your response. I need to review this further.',
            timestamp: new Date().toISOString()
          }
        ])
      } catch {
        setEmailThread((prev) => [
          ...prev,
          {
            from: 'prospect',
            subject: `Re: ${draftSubject}`,
            body: 'Thank you for your response. Let me review and get back to you with follow-up questions.',
            timestamp: new Date().toISOString()
          }
        ])
      } finally {
        setWaitingForReply(false)
      }
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
                {email.from === 'candidate' ? 'You' : `${senderName} (${senderTitle})`}
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
        {waitingForReply && (
          <div className="flex items-center gap-2 rounded-2xl border border-skywash-200 bg-skywash-50 px-4 py-3">
            <Loader2 className="h-4 w-4 animate-spin text-skywash-600" />
            <span className="text-sm text-skywash-700">{senderName} is typing a response...</span>
          </div>
        )}
      </div>

      {/* Email Composer */}
      {emailThread.length < 3 && !waitingForReply && (
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
            placeholder={isImplementation
              ? `Draft your response to the client...

Tips:
- Acknowledge their concerns directly
- Be transparent about current status
- Provide specific next steps with timelines
- Assign ownership for each action item
- Avoid legal overreach or vague reassurances`
              : `Draft your professional response...

Tips:
- Acknowledge their concerns
- Justify your value proposition
- Address timeline realistically
- Protect your margins
- Be firm but collaborative`}
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
            <strong>Round Complete:</strong> You&apos;ve sent both responses. Click &quot;Submit &amp; Next&quot; to complete this round.
          </p>
        </div>
      )}

      {/* Scoring Criteria */}
      <div className="rounded-2xl bg-ink-50/60 px-4 py-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-500">Evaluation Criteria</h3>
        {isImplementation ? (
          <ul className="space-y-1.5 text-xs text-ink-500">
            <li>&#8226; <strong className="text-ink-600">Tone & Clarity:</strong> Calm, professional, empathetic</li>
            <li>&#8226; <strong className="text-ink-600">De-escalation:</strong> Validate concerns without being defensive</li>
            <li>&#8226; <strong className="text-ink-600">Commitment Accuracy:</strong> Realistic, specific promises</li>
            <li>&#8226; <strong className="text-ink-600">Next Steps:</strong> Clear actions with owners and timelines</li>
          </ul>
        ) : (
          <ul className="space-y-1.5 text-xs text-ink-500">
            <li>&#8226; <strong className="text-ink-600">Negotiation posture:</strong> Firm but collaborative</li>
            <li>&#8226; <strong className="text-ink-600">Professionalism:</strong> Clear, respectful tone</li>
            <li>&#8226; <strong className="text-ink-600">Rejection handling:</strong> No desperation or defensiveness</li>
            <li>&#8226; <strong className="text-ink-600">Margin protection:</strong> Justify value, don&apos;t cave on price</li>
            <li>&#8226; <strong className="text-ink-600">Realistic commitments:</strong> Only promise what you can deliver</li>
          </ul>
        )}
      </div>
    </div>
  )
}
