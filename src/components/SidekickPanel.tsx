'use client'

import { useState } from 'react'
import { MessageSquareText, Send, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useSession } from '@/contexts/SessionContext'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const STARTER_MESSAGE: Message = {
  role: 'assistant',
  content: 'I can help outline discovery questions, summarize objections, or flag overpromising risks. What would you like guidance on?'
}

const PERMISSIONS = [
  'Summarize objections',
  'Suggest frameworks',
  'Flag risks'
]

const RESTRICTIONS = [
  'No complete scripts',
  'No exact copy',
  'Outline-only'
]

export function SidekickPanel({ role }: { role: string }) {
  const { session, currentRound } = useSession()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([STARTER_MESSAGE])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [queriesRemaining, setQueriesRemaining] = useState(6)

  const sendMessage = async () => {
    if (!draft.trim() || loading) return

    const userMessage: Message = { role: 'user', content: draft }
    setMessages((prev) => [...prev, userMessage])
    setDraft('')
    setLoading(true)

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session?.id,
          round_id: currentRound?.id,
          query: draft,
          history: messages
        })
      })

      const data = await response.json()

      if (data.error) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `Error: ${data.error}` }
        ])
      } else if (data.limit_reached) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: data.response }
        ])
        setQueriesRemaining(0)
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: data.response }
        ])
        setQueriesRemaining(data.remaining_queries)
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }
      ])
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-skywash-700" />
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-500">
            AI Assistant
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setOpen((prev) => !prev)}>
          {open ? 'Hide' : 'Show'}
        </Button>
      </div>

      {!open && (
        <div className="flex items-center gap-3 rounded-2xl border border-ink-100 bg-white/70 px-4 py-3 text-sm text-ink-600">
          <MessageSquareText className="h-4 w-4 text-skywash-700" />
          Sidekick available for outline guidance ({queriesRemaining} queries left)
        </div>
      )}

      {open && (
        <Card className="bg-white/90">
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Role: {role}</h3>
              <Badge tone="signal">{queriesRemaining} queries left</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {PERMISSIONS.map((item) => (
                <Badge key={item} tone="sky">
                  {item}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-ink-500">
              Restrictions: {RESTRICTIONS.join(' | ')}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-h-96 space-y-3 overflow-y-auto">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`rounded-2xl px-4 py-3 text-sm ${
                    message.role === 'assistant'
                      ? 'bg-skywash-50 text-ink-700'
                      : 'bg-ink-100 text-ink-900'
                  }`}
                >
                  {message.content}
                </div>
              ))}
              {loading && (
                <div className="rounded-2xl bg-skywash-50 px-4 py-3 text-sm text-ink-700">
                  Thinking...
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Ask for outline guidance..."
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading || queriesRemaining === 0}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={sendMessage}
                disabled={loading || queriesRemaining === 0 || !draft.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
