'use client'

import { useState } from 'react'
import { MessageSquareText, Send, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useSession } from '@/contexts/SessionContext'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const TRACK_CONFIG: Record<string, { starter: string; permissions: string[]; restrictions: string[] }> = {
  sales: {
    starter: 'I can help outline discovery questions, summarize objections, or flag overpromising risks. What would you like guidance on?',
    permissions: ['Summarize objections', 'Suggest frameworks', 'Flag risks'],
    restrictions: ['No complete scripts', 'No exact copy', 'Outline-only']
  },
  implementation: {
    starter: 'I can help outline de-escalation frameworks, suggest risk mitigation structures, or flag scope concerns. What would you like guidance on?',
    permissions: ['De-escalation frameworks', 'Risk structures', 'Scope analysis'],
    restrictions: ['No complete emails', 'No technical answers', 'Outline-only']
  }
}

export function SidekickPanel({ role, track = 'sales' }: { role: string; track?: string }) {
  const { session, currentRound } = useSession()
  const config = TRACK_CONFIG[track] || TRACK_CONFIG.sales

  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: config.starter }
  ])
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
          round_id: currentRound?.round_number,
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
            <p className="text-xs text-ink-600">
              Can help with: {config.permissions.join(' / ')}
            </p>
            <p className="text-xs text-ink-500">
              Restrictions: {config.restrictions.join(' | ')}
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
            <div className="flex items-end gap-2">
              <Textarea
                rows={2}
                placeholder="Ask for outline guidance... (Shift+Enter for new line)"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading || queriesRemaining === 0}
                className="resize-none"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={sendMessage}
                disabled={loading || queriesRemaining === 0 || !draft.trim()}
                className="shrink-0"
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
