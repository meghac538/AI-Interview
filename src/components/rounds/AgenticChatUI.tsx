'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, Users, MessageSquare, ArrowRightLeft, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSession } from '@/contexts/SessionContext'
import type { Round } from '@/lib/types/database'

type Channel = 'customer' | 'internal'

interface AgenticMessage {
  speaker: 'candidate' | 'customer' | 'presales_engineer' | 'product_owner'
  name: string
  text: string
  timestamp: string
}

const SPEAKER_CONFIG: Record<string, { label: string; color: string; bgColor: string; avatarBg: string; avatarText: string }> = {
  customer: {
    label: 'Jordan Rivera (Customer)',
    color: 'text-blue-900 dark:text-blue-100',
    bgColor: 'bg-blue-100 dark:bg-blue-900/40',
    avatarBg: 'bg-blue-200 dark:bg-blue-800',
    avatarText: 'JR'
  },
  presales_engineer: {
    label: 'Alex Chen (Solutions Architect)',
    color: 'text-purple-900 dark:text-purple-100',
    bgColor: 'bg-purple-100 dark:bg-purple-900/40',
    avatarBg: 'bg-purple-200 dark:bg-purple-800',
    avatarText: 'AC'
  },
  product_owner: {
    label: 'Sam Patel (Product Director)',
    color: 'text-amber-900 dark:text-amber-100',
    bgColor: 'bg-amber-100 dark:bg-amber-900/40',
    avatarBg: 'bg-amber-200 dark:bg-amber-800',
    avatarText: 'SP'
  },
  candidate: {
    label: 'You',
    color: 'text-primary-foreground',
    bgColor: 'bg-primary',
    avatarBg: 'bg-primary',
    avatarText: 'You'
  }
}

export function AgenticChatUI({ round }: { round: Round }) {
  const { session } = useSession()
  const [activeChannel, setActiveChannel] = useState<Channel>('customer')
  const [customerMessages, setCustomerMessages] = useState<AgenticMessage[]>([])
  const [internalMessages, setInternalMessages] = useState<AgenticMessage[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [started, setStarted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [customerUnread, setCustomerUnread] = useState(0)
  const [internalUnread, setInternalUnread] = useState(0)
  const [latestCustomerQuestion, setLatestCustomerQuestion] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const activeMessages = activeChannel === 'customer' ? customerMessages : internalMessages

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [customerMessages, internalMessages, activeChannel])

  // Clear unread when switching tabs
  useEffect(() => {
    if (activeChannel === 'customer') setCustomerUnread(0)
    if (activeChannel === 'internal') setInternalUnread(0)
  }, [activeChannel])

  // Save transcript artifact on every message change
  const saveTranscript = useCallback(async (custMsgs: AgenticMessage[], intMsgs: AgenticMessage[]) => {
    if (!session || (custMsgs.length === 0 && intMsgs.length === 0)) return

    await fetch('/api/artifact/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: session.id,
        round_number: round.round_number,
        artifact_type: 'agentic_transcript',
        content: JSON.stringify({
          customer_channel: custMsgs,
          internal_channel: intMsgs
        }),
        metadata: {
          draft: true,
          customer_messages: custMsgs.length,
          internal_messages: intMsgs.length
        }
      })
    })
  }, [session, round.round_number])

  // Start the conversation — customer sends first message
  const startConversation = async () => {
    if (!session) return
    setStarted(true)
    setLoading(true)

    try {
      setError(null)
      const response = await fetch('/api/ai/agentic-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.id,
          round_number: round.round_number,
          channel: 'customer',
          message: '__start__',
          customer_history: [],
          internal_history: []
        })
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || `Server error (${response.status}). Check your OpenAI API key configuration.`)
        return
      }

      if (data.responses?.length > 0) {
        const firstMsg: AgenticMessage = {
          speaker: 'customer',
          name: data.responses[0].name,
          text: data.responses[0].text,
          timestamp: new Date().toISOString()
        }
        setCustomerMessages([firstMsg])
        setLatestCustomerQuestion(firstMsg.text)
        saveTranscript([firstMsg], [])
      }
    } catch (err) {
      console.error('Failed to start agentic conversation:', err)
      setError('Failed to connect to the AI service. Please check your network and API configuration.')
    } finally {
      setLoading(false)
    }
  }

  const sendMessage = async () => {
    if (!draft.trim() || loading || !session) return

    // Signal content to parent
    window.dispatchEvent(
      new CustomEvent('round-content-change', {
        detail: { round_number: round.round_number, hasContent: true }
      })
    )

    const candidateMsg: AgenticMessage = {
      speaker: 'candidate',
      name: 'You',
      text: draft,
      timestamp: new Date().toISOString()
    }

    // Add candidate message to active channel
    let newCustomerMsgs = customerMessages
    let newInternalMsgs = internalMessages

    if (activeChannel === 'customer') {
      newCustomerMsgs = [...customerMessages, candidateMsg]
      setCustomerMessages(newCustomerMsgs)
    } else {
      newInternalMsgs = [...internalMessages, candidateMsg]
      setInternalMessages(newInternalMsgs)
    }

    setDraft('')
    setLoading(true)

    try {
      setError(null)
      const response = await fetch('/api/ai/agentic-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.id,
          round_number: round.round_number,
          channel: activeChannel,
          message: draft,
          customer_history: newCustomerMsgs.map((m) => ({ speaker: m.speaker, text: m.text })),
          internal_history: newInternalMsgs.map((m) => ({ speaker: m.speaker, text: m.text }))
        })
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || `Server error (${response.status}). The AI agents could not respond.`)
        return
      }

      if (data.responses?.length > 0) {
        if (activeChannel === 'customer') {
          const agentMsgs: AgenticMessage[] = data.responses.map((r: any) => ({
            speaker: r.agent as AgenticMessage['speaker'],
            name: r.name,
            text: r.text,
            timestamp: new Date().toISOString()
          }))
          newCustomerMsgs = [...newCustomerMsgs, ...agentMsgs]
          setCustomerMessages(newCustomerMsgs)

          // Track latest customer question for internal channel hint
          const lastCustomerMsg = agentMsgs.find((m) => m.speaker === 'customer')
          if (lastCustomerMsg) {
            setLatestCustomerQuestion(lastCustomerMsg.text)
          }
        } else {
          const agentMsgs: AgenticMessage[] = data.responses.map((r: any) => ({
            speaker: r.agent as AgenticMessage['speaker'],
            name: r.name,
            text: r.text,
            timestamp: new Date().toISOString()
          }))
          newInternalMsgs = [...newInternalMsgs, ...agentMsgs]
          setInternalMessages(newInternalMsgs)
        }
      }

      // Save transcript after each exchange
      saveTranscript(newCustomerMsgs, newInternalMsgs)
    } catch (err) {
      console.error('Failed to send agentic message:', err)
      setError('Failed to send message. Please check your connection and try again.')
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

  // Auto-save on timer expiry: submit final non-draft transcript
  const customerMsgsRef = useRef(customerMessages)
  customerMsgsRef.current = customerMessages
  const internalMsgsRef = useRef(internalMessages)
  internalMsgsRef.current = internalMessages

  useEffect(() => {
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.round_number !== round.round_number || !session?.id) return
      const custMsgs = customerMsgsRef.current
      const intMsgs = internalMsgsRef.current
      if (custMsgs.length === 0 && intMsgs.length === 0) return
      await fetch('/api/artifact/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.id,
          round_number: round.round_number,
          artifact_type: 'agentic_transcript',
          content: JSON.stringify({ customer_channel: custMsgs, internal_channel: intMsgs }),
          metadata: {
            draft: false,
            auto_saved: true,
            customer_messages: custMsgs.length,
            internal_messages: intMsgs.length
          }
        })
      }).catch(() => {})
    }
    window.addEventListener('round-auto-save', handler)
    return () => window.removeEventListener('round-auto-save', handler)
  }, [round.round_number, session?.id])

  if (!session) return null

  // Pre-start state
  if (!started) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border bg-card px-6 py-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/40">
            <Users className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Multi-Agent Integration Chat</h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            You&apos;ll manage two channels simultaneously: a <strong>Customer Chat</strong> with a VP of Engineering
            asking technical integration questions, and an <strong>Internal Team Chat</strong> with your Solutions Architect
            and Product Director.
          </p>
          <div className="mt-4 flex items-center justify-center gap-6 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-blue-400" />
              Customer Channel
            </span>
            <ArrowRightLeft className="h-4 w-4 text-muted-foreground/50" />
            <span className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-purple-400" />
              Internal Team
            </span>
          </div>
          <Button className="mt-6" size="lg" onClick={startConversation} disabled={loading}>
            <MessageSquare className="mr-2 h-4 w-4" />
            {loading ? 'Connecting...' : 'Start Conversation'}
          </Button>
        </div>

        {/* Scoring criteria */}
        <div className="rounded-2xl border bg-card px-4 py-4">
          <h3 className="mb-3 text-sm font-semibold">Evaluation Criteria</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>&#8226; <strong>Internal coordination:</strong> Quality of questions to your team and synthesis of answers</li>
            <li>&#8226; <strong>Technical comprehension:</strong> Accuracy of technical details relayed to customer</li>
            <li>&#8226; <strong>Customer communication:</strong> Professional, clear, timely responses</li>
            <li>&#8226; <strong>Risk identification:</strong> Flagging gaps, setting expectations, identifying risks</li>
          </ul>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Channel tabs */}
      <div className="flex gap-2 rounded-xl border bg-card p-1">
        <button
          onClick={() => setActiveChannel('customer')}
          className={`relative flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
            activeChannel === 'customer'
              ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <MessageSquare className="mr-1.5 inline h-4 w-4" />
          Customer Chat
          {customerUnread > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
              {customerUnread}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveChannel('internal')}
          className={`relative flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
            activeChannel === 'internal'
              ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200 shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Users className="mr-1.5 inline h-4 w-4" />
          Internal Team
          {internalUnread > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
              {internalUnread}
            </span>
          )}
        </button>
      </div>

      {/* Cross-channel hint (shows on Internal tab when customer has a pending question) */}
      {activeChannel === 'internal' && latestCustomerQuestion && (
        <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 px-4 py-2.5">
          <p className="text-xs text-blue-700 dark:text-blue-300">
            <strong>Customer is asking:</strong> &quot;{latestCustomerQuestion.length > 120
              ? latestCustomerQuestion.slice(0, 120) + '...'
              : latestCustomerQuestion}&quot;
          </p>
        </div>
      )}

      {/* Messages area */}
      <div
        ref={scrollRef}
        className="max-h-[420px] min-h-[300px] space-y-3 overflow-y-auto rounded-2xl border bg-card px-4 py-4"
      >
        {activeMessages.length === 0 && (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            {activeChannel === 'internal'
              ? 'Ask your team for help with the customer\'s questions'
              : 'Waiting for messages...'}
          </div>
        )}

        {activeMessages.map((message, index) => {
          const isCandidate = message.speaker === 'candidate'
          const speakerCfg = SPEAKER_CONFIG[message.speaker] || SPEAKER_CONFIG.candidate

          return (
            <div
              key={index}
              className={`flex items-end gap-2.5 ${isCandidate ? 'justify-end' : 'justify-start'}`}
            >
              {/* Avatar (non-candidate) */}
              {!isCandidate && (
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${speakerCfg.avatarBg}`}>
                  <span className="text-[10px] font-bold text-foreground">{speakerCfg.avatarText}</span>
                </div>
              )}

              {/* Message bubble */}
              <div className={`max-w-[75%] ${isCandidate ? 'text-right' : 'text-left'}`}>
                {!isCandidate && (
                  <div className="mb-1 text-[11px] font-medium text-muted-foreground">{speakerCfg.label}</div>
                )}
                <div className={`rounded-2xl px-4 py-2.5 text-sm ${speakerCfg.bgColor} ${speakerCfg.color}`}>
                  {message.text}
                </div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">
                  {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              {/* Avatar (candidate) */}
              {isCandidate && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
                  <span className="text-[10px] font-bold text-primary-foreground">You</span>
                </div>
              )}
            </div>
          )
        })}

        {/* Loading indicator */}
        {loading && (
          <div className="flex items-end gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
              <span className="h-2 w-2 animate-pulse rounded-full bg-muted-foreground" />
            </div>
            <div className="rounded-2xl bg-muted px-4 py-2.5">
              <p className="text-sm text-muted-foreground">
                {activeChannel === 'customer' ? 'Customer is typing...' : 'Team is responding...'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div className="flex-1">
            <p className="text-sm font-medium text-destructive">{error}</p>
            <button
              onClick={() => setError(null)}
              className="mt-1 text-xs text-muted-foreground hover:text-foreground underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Message input */}
      <div className="flex items-center gap-2 rounded-xl border bg-card p-2">
        <Input
          placeholder={
            activeChannel === 'customer'
              ? 'Reply to customer...'
              : 'Ask your team...'
          }
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          className="border-0 bg-transparent shadow-none focus-visible:ring-0"
        />
        <Button
          size="icon"
          onClick={sendMessage}
          disabled={loading || !draft.trim()}
          className="h-9 w-9 shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>

      {/* Channel indicator */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Sending to: <strong className={activeChannel === 'customer' ? 'text-blue-600' : 'text-purple-600'}>
            {activeChannel === 'customer' ? 'Customer' : 'Internal Team'}
          </strong>
        </span>
        <span>
          {customerMessages.filter((m) => m.speaker === 'candidate').length + internalMessages.filter((m) => m.speaker === 'candidate').length} messages sent
        </span>
      </div>
    </div>
  )
}
