'use client'

import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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

Thanks for the proposal. We are interested, but your pricing is roughly 20% above our budget.

Is there flexibility? We also need implementation by end of Q1 (about 6 weeks). Can you support that timeline?

Best,
Sarah Chen
VP of Operations`,
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

    setEmailThread((prev) => [...prev, newEmail])

    // Signal content to parent
    window.dispatchEvent(
      new CustomEvent('round-content-change', {
        detail: { round_number: round.round_number, hasContent: true }
      })
    )

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

    if (emailThread.length === 1) {
      setTimeout(() => {
        setEmailThread((prev) => [
          ...prev,
          {
            from: 'prospect',
            subject: 'Re: Pricing Discussion',
            body: `Thanks for the quick response.

Timeline and cost are still concerns. Can you confirm Q1 delivery and match our budget? Otherwise I need alternatives.

Please send a final answer by end of day.

Sarah`,
            timestamp: new Date().toISOString()
          }
        ])
      }, 3000)
    }
  }

  // Auto-save on timer expiry: save unsent draft
  const draftBodyRef = useRef(draftBody)
  draftBodyRef.current = draftBody
  const draftSubjectRef = useRef(draftSubject)
  draftSubjectRef.current = draftSubject
  const threadLengthRef = useRef(emailThread.length)
  threadLengthRef.current = emailThread.length

  useEffect(() => {
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.round_number !== round.round_number || !session?.id) return
      if (!draftBodyRef.current.trim()) return
      await fetch('/api/artifact/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.id,
          round_number: round.round_number,
          artifact_type: 'email_draft',
          content: draftBodyRef.current,
          metadata: {
            draft: false,
            auto_saved: true,
            subject: draftSubjectRef.current,
            thread_position: threadLengthRef.current
          }
        })
      }).catch(() => {})
    }
    window.addEventListener('round-auto-save', handler)
    return () => window.removeEventListener('round-auto-save', handler)
  }, [round.round_number, session?.id])

  if (!session) return null

  const wordCount = draftBody.split(/\s+/).filter(Boolean).length

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Negotiation Thread</CardTitle>
          <CardDescription>Draft concise, professional responses while protecting scope and margin.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {emailThread.map((email, index) => (
            <div
              key={index}
              className={`rounded-lg border p-4 ${email.from === 'candidate' ? 'bg-primary/5' : 'bg-secondary/40'}`}
            >
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Badge variant={email.from === 'candidate' ? 'default' : 'secondary'}>
                    {email.from === 'candidate' ? 'You' : 'Prospect'}
                  </Badge>
                  <span>{email.from === 'candidate' ? 'Candidate reply' : 'Sarah Chen (VP Operations)'}</span>
                </div>
                <span>{new Date(email.timestamp).toLocaleString()}</span>
              </div>
              <p className="mt-2 text-sm font-semibold">{email.subject}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{email.body}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {emailThread.length < 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your Draft {emailThread.length === 2 ? '2' : '1'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Subject" value={draftSubject} onChange={(event) => setDraftSubject(event.target.value)} />
            <Textarea
              rows={10}
              placeholder="Write your response. Address budget and timeline directly, justify value, and avoid overpromising."
              value={draftBody}
              onChange={(event) => setDraftBody(event.target.value)}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Word count: {wordCount}</span>
              <Button size="sm" onClick={sendEmail} disabled={!draftBody.trim() || submitting}>
                <Send className="h-4 w-4" />
                {submitting ? 'Sending...' : 'Send Draft'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {emailThread.length === 3 && (
        <Card className="border-emerald-500/40 bg-emerald-500/10">
          <CardContent className="pt-6 text-sm">
            Round complete. You sent both draft responses. Continue with Submit and Next.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evaluation Criteria</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Negotiation posture: firm and collaborative</li>
            <li>Professional tone and structure</li>
            <li>Clear handling of objections and pressure</li>
            <li>Scope and margin protection</li>
            <li>Realistic commitments only</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
