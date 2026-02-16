'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { MessageSquare, Send, CheckCircle2, Circle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useSession } from '@/contexts/SessionContext'
import type { Round } from '@/lib/types/database'

interface Message {
  speaker: 'candidate' | 'prospect'
  text: string
  timestamp: string
}

export function VoiceCallUI({ round }: { round: Round }) {
  const { session } = useSession()
  const [chatActive, setChatActive] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [personaState, setPersonaState] = useState<'neutral' | 'skeptical' | 'interested'>('neutral')
  const [conversationMetrics, setConversationMetrics] = useState({
    questionsAsked: 0,
    objectionsHandled: 0,
    valueQuantified: false
  })
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading])

  // Auto-save on timer expiry: end chat and save transcript
  const messagesRef = useRef(messages)
  messagesRef.current = messages
  const chatActiveRef = useRef(chatActive)
  chatActiveRef.current = chatActive
  const metricsRef = useRef(conversationMetrics)
  metricsRef.current = conversationMetrics
  const personaRef = useRef(personaState)
  personaRef.current = personaState

  const saveTranscript = useCallback(async () => {
    if (!session?.id || messagesRef.current.length === 0) return
    await fetch('/api/artifact/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: session.id,
        round_number: round.round_number,
        artifact_type: 'chat_transcript',
        content: JSON.stringify(messagesRef.current),
        metadata: {
          conversation_complete: true,
          auto_saved: true,
          message_count: messagesRef.current.length,
          metrics: metricsRef.current,
          persona_state: personaRef.current
        }
      })
    }).catch(() => {})
  }, [session?.id, round.round_number])

  useEffect(() => {
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.round_number !== round.round_number || !session?.id) return
      if (chatActiveRef.current) {
        setChatActive(false)
      }
      await saveTranscript()
    }
    window.addEventListener('round-auto-save', handler)
    return () => window.removeEventListener('round-auto-save', handler)
  }, [round.round_number, session?.id, saveTranscript])

  if (!session) return null

  const startChat = async () => {
    setChatActive(true)
    setLoading(true)

    // Signal content to parent
    window.dispatchEvent(
      new CustomEvent('round-content-change', {
        detail: { round_number: round.round_number, hasContent: true }
      })
    )

    try {
      const response = await fetch('/api/ai/prospect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.id,
          round_number: round.round_number,
          message: '__start__',
          conversation_history: [],
          persona_state: personaState,
          metrics: conversationMetrics
        })
      })

      const data = await response.json()

      if (data.error) {
        console.error('Prospect AI error:', data.error)
        return
      }

      const welcomeMessage: Message = {
        speaker: 'prospect',
        text: data.response,
        timestamp: new Date().toISOString()
      }

      setMessages([welcomeMessage])

      if (data.persona_state) setPersonaState(data.persona_state)
      if (data.metrics) setConversationMetrics(data.metrics)

      await fetch('/api/artifact/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.id,
          round_number: round.round_number,
          artifact_type: 'chat_conversation',
          content: JSON.stringify([welcomeMessage]),
          metadata: {
            conversation_started: true,
            persona: 'Prospect'
          }
        })
      })
    } catch (error) {
      console.error('Error starting conversation:', error)
    } finally {
      setLoading(false)
    }
  }

  const endChat = async () => {
    setChatActive(false)

    await fetch('/api/artifact/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: session.id,
        round_number: round.round_number,
        artifact_type: 'chat_transcript',
        content: JSON.stringify(messages),
        metadata: {
          conversation_complete: true,
          message_count: messages.length,
          metrics: conversationMetrics,
          persona_state: personaState
        }
      })
    })
  }

  const sendMessage = async () => {
    if (!draft.trim() || loading) return

    const candidateMessage: Message = {
      speaker: 'candidate',
      text: draft,
      timestamp: new Date().toISOString()
    }

    setMessages((prev) => [...prev, candidateMessage])
    setDraft('')
    setLoading(true)

    try {
      const response = await fetch('/api/ai/prospect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.id,
          round_number: round.round_number,
          message: draft,
          conversation_history: messages,
          persona_state: personaState,
          metrics: conversationMetrics
        })
      })

      const data = await response.json()

      if (data.error) {
        console.error('Prospect AI error:', data.error)
        return
      }

      const prospectMessage: Message = {
        speaker: 'prospect',
        text: data.response,
        timestamp: new Date().toISOString()
      }

      setMessages((prev) => [...prev, prospectMessage])

      if (data.persona_state) setPersonaState(data.persona_state)
      if (data.metrics) setConversationMetrics(data.metrics)
    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void sendMessage()
    }
  }

  const personaMeta = {
    neutral: {
      label: 'Neutral',
      variant: 'outline' as const,
      helper: 'Prospect is listening. Start your discovery questions.',
      dotClass: 'bg-muted-foreground'
    },
    skeptical: {
      label: 'Skeptical',
      variant: 'secondary' as const,
      helper: 'Prospect is skeptical. Address concerns with evidence and confidence.',
      dotClass: 'bg-amber-500'
    },
    interested: {
      label: 'Interested',
      variant: 'default' as const,
      helper: 'Prospect is interested. Continue building concrete business value.',
      dotClass: 'bg-emerald-500'
    }
  }[personaState]

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-base">Live Persona Conversation</CardTitle>
              <CardDescription>
                Simulated prospect chat. Discovery quality, objection handling, and value framing are scored.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-1.5 text-xs">
              <span className={`h-2 w-2 rounded-full ${chatActive ? personaMeta.dotClass : 'bg-muted-foreground/60'}`} />
              <span>{chatActive ? 'Conversation live' : 'Ready to start'}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Button
            size="sm"
            variant={chatActive ? 'destructive' : 'default'}
            onClick={chatActive ? endChat : startChat}
            disabled={loading}
          >
            <MessageSquare className="h-4 w-4" />
            {chatActive ? 'End Conversation' : 'Start Conversation'}
          </Button>
        </CardContent>
      </Card>

      {chatActive && (
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <Badge variant={personaMeta.variant}>{personaMeta.label}</Badge>
            <p className="text-sm text-muted-foreground">{personaMeta.helper}</p>
          </CardContent>
        </Card>
      )}

      {chatActive && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conversation Stream</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div ref={scrollRef} className="max-h-96 space-y-4 overflow-y-auto rounded-lg border bg-muted/15 p-4">
              {messages.map((message, index) => {
                const isCandidate = message.speaker === 'candidate'
                return (
                  <div key={index} className={`flex items-end gap-2 ${isCandidate ? 'justify-end' : 'justify-start'}`}>
                    {!isCandidate && (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full border bg-background text-xs">
                        P
                      </div>
                    )}

                    <div className={`max-w-[78%] ${isCandidate ? 'text-right' : 'text-left'}`}>
                      <div
                        className={`rounded-2xl px-4 py-2.5 text-sm ${
                          isCandidate ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
                        }`}
                      >
                        {message.text}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {isCandidate ? 'You' : 'Prospect'} | {new Date(message.timestamp).toLocaleTimeString()}
                      </div>
                    </div>

                    {isCandidate && (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full border bg-primary text-xs text-primary-foreground">
                        Y
                      </div>
                    )}
                  </div>
                )
              })}

              {loading && (
                <div className="rounded-xl border bg-background px-3 py-2 text-sm text-muted-foreground">
                  Prospect is typing...
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Input
                placeholder="Type your message..."
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
              />
              <Button size="icon" variant="outline" onClick={sendMessage} disabled={loading || !draft.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Round Requirements</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2">
              {conversationMetrics.questionsAsked >= 5 ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground" />
              )}
              Ask at least 5 discovery questions ({conversationMetrics.questionsAsked}/5)
            </li>
            <li className="flex items-center gap-2">
              {conversationMetrics.valueQuantified ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground" />
              )}
              Quantify value proposition at least once
            </li>
            <li className="flex items-center gap-2">
              {conversationMetrics.objectionsHandled >= 3 ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground" />
              )}
              Handle at least 3 objections ({conversationMetrics.objectionsHandled}/3)
            </li>
            <li className="flex items-center gap-2">
              <Circle className="h-4 w-4 text-muted-foreground" />
              Close with a clear next-step ask
            </li>
          </ul>
        </CardContent>
      </Card>

      {!chatActive && (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Begin the conversation, lead discovery, handle objections, and close for a next step.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
