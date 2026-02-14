'use client'

import { useState, useEffect, useRef } from 'react'
import { MessageSquare, Send, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
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

  if (!session) return null

  // Auto-scroll messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const startChat = async () => {
    setChatActive(true)
    setLoading(true)

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

      // Save as conversation start
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

    // Save full conversation as artifact
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

    setMessages(prev => [...prev, candidateMessage])
    setDraft('')
    setLoading(true)

    try {
          // Call AI prospect API
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

      setMessages(prev => [...prev, prospectMessage])

      // Update persona state and metrics
      if (data.persona_state) setPersonaState(data.persona_state)
      if (data.metrics) setConversationMetrics(data.metrics)

    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const getPersonaColor = () => {
    switch (personaState) {
      case 'interested':
        return 'bg-signal-500'
      case 'skeptical':
        return 'bg-caution-500'
      default:
        return 'bg-ink-300'
    }
  }

  return (
    <div className="space-y-4">
      {/* Chat Controls */}
      <div className="flex items-center justify-between rounded-2xl border border-ink-100 bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <div className={`h-3 w-3 rounded-full ${chatActive ? `animate-pulse ${getPersonaColor()}` : 'bg-ink-300'}`} />
          <span className="text-sm font-semibold">
            {chatActive ? 'Conversation in progress' : 'Ready to start'}
          </span>
        </div>

        <Button
          variant={chatActive ? 'danger' : 'primary'}
          size="sm"
          onClick={chatActive ? endChat : startChat}
          className={chatActive ? 'bg-signal-500 hover:bg-signal-600' : ''}
        >
          {chatActive ? (
            <>
              <MessageSquare className="mr-2 h-4 w-4" />
              End Conversation
            </>
          ) : (
            <>
              <MessageSquare className="mr-2 h-4 w-4" />
              Start Conversation
            </>
          )}
        </Button>
      </div>

      {/* Persona State Indicator */}
      {chatActive && (
        <div className="flex items-center gap-2 rounded-2xl bg-skywash-50 px-4 py-3">
          <Badge tone="sky">{personaState.toUpperCase()}</Badge>
          <span className="text-sm text-ink-600">
            {personaState === 'neutral' && 'Prospect is listening. Start your discovery questions.'}
            {personaState === 'skeptical' && 'Prospect is skeptical. Address concerns with confidence.'}
            {personaState === 'interested' && 'Prospect is interested! Continue building value.'}
          </span>
        </div>
      )}

      {/* Conversation Messages */}
      {chatActive && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Live Conversation</h3>
          <div
            ref={scrollRef}
            className="max-h-96 space-y-4 overflow-y-auto rounded-2xl border border-ink-100 bg-white px-4 py-4"
          >
            {messages.map((message, index) => {
              const isCandidate = message.speaker === 'candidate'
              return (
                <div
                  key={index}
                  className={`flex items-end gap-3 ${isCandidate ? 'justify-end' : 'justify-start'}`}
                >
                  {!isCandidate && (
                    <div
                      aria-label="Prospect"
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-skywash-100"
                    >
                      <span className="h-2.5 w-2.5 rounded-full bg-skywash-600" />
                    </div>
                  )}
                  <div className={`max-w-[75%] ${isCandidate ? 'text-right' : 'text-left'}`}>
                    <div
                      className={`rounded-2xl px-4 py-3 text-sm ${
                        isCandidate
                          ? 'bg-ink-900 text-white'
                          : 'bg-skywash-50 text-ink-800'
                      }`}
                    >
                      {message.text}
                    </div>
                    <div className="mt-1 text-xs text-ink-500">
                      {isCandidate ? 'You' : 'Prospect'} • {new Date(message.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                  {isCandidate && (
                    <div
                      aria-label="You"
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-900"
                    >
                      <span className="h-2.5 w-2.5 rounded-full bg-white" />
                    </div>
                  )}
                </div>
              )
            })}
            {loading && (
              <div className="flex items-end gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-skywash-100">
                <span className="h-2.5 w-2.5 rounded-full bg-skywash-600" />
              </div>
                <div className="rounded-2xl bg-skywash-50 px-4 py-3">
                  <p className="text-sm text-ink-600">Prospect is typing...</p>
                </div>
              </div>
            )}
          </div>

          {/* Message Input */}
          <div className="flex items-end gap-2">
            <Textarea
              rows={3}
              placeholder="Type your message... (Shift+Enter for new line)"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              className="resize-none"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={sendMessage}
              disabled={loading || !draft.trim()}
              className="shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Requirements Checklist */}
      <div className="rounded-2xl bg-ink-50/60 px-4 py-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-500">Round Requirements</h3>
        <ul className="space-y-2 text-xs">
          <li className="flex items-center gap-2">
            <div className={`h-4 w-4 rounded border flex items-center justify-center ${conversationMetrics.questionsAsked >= 5 ? 'bg-signal-500 border-signal-500' : 'border-ink-300'}`}>
              {conversationMetrics.questionsAsked >= 5 && <CheckCircle2 className="h-3 w-3 text-white" />}
            </div>
            <span>Ask at least 5 discovery questions ({conversationMetrics.questionsAsked}/5)</span>
          </li>
          <li className="flex items-center gap-2">
            <div className={`h-4 w-4 rounded border flex items-center justify-center ${conversationMetrics.valueQuantified ? 'bg-signal-500 border-signal-500' : 'border-ink-300'}`}>
              {conversationMetrics.valueQuantified && <CheckCircle2 className="h-3 w-3 text-white" />}
            </div>
            <span>Quantify value proposition</span>
          </li>
          <li className="flex items-center gap-2">
            <div className={`h-4 w-4 rounded border flex items-center justify-center ${conversationMetrics.objectionsHandled >= 3 ? 'bg-signal-500 border-signal-500' : 'border-ink-300'}`}>
              {conversationMetrics.objectionsHandled >= 3 && <CheckCircle2 className="h-3 w-3 text-white" />}
            </div>
            <span>Handle at least 3 objections ({conversationMetrics.objectionsHandled}/3)</span>
          </li>
          <li className="flex items-center gap-2">
            <div className="h-4 w-4 rounded border border-ink-300 flex items-center justify-center">
              <CheckCircle2 className="h-3 w-3 text-transparent" />
            </div>
            <span>Professional closing attempt</span>
          </li>
        </ul>
      </div>

      {/* Chat Instructions */}
      {!chatActive && (
        <div className="rounded-2xl bg-skywash-50 px-4 py-4">
          <p className="text-sm text-ink-700">
            <strong>Instructions:</strong> This is a live text conversation with a prospect.
            Conduct discovery, handle objections, and close for next steps. The prospect will raise objections and you may encounter curveballs during the conversation.
          </p>
        </div>
      )}
    </div>
  )
}
