'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Mail, MessageSquare, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useSession } from '@/contexts/SessionContext'
import type { Round } from '@/lib/types/database'

interface AgentConfig {
  agent_id: string
  name: string
  role: string
  avatar_color: string
  persona: string
}

interface ChatMessage {
  speaker: 'candidate' | string
  agent_name?: string
  text: string
  timestamp: string
}

function buildScoringContent(
  chatHistories: Record<string, ChatMessage[]>,
  customerResponse: string
): string {
  let content = '=== INTERNAL COORDINATION ===\n\n'
  for (const [agentId, messages] of Object.entries(chatHistories)) {
    content += `--- Chat with ${agentId} ---\n`
    for (const msg of messages) {
      content += `${msg.speaker === 'candidate' ? 'Candidate' : msg.agent_name || agentId}: ${msg.text}\n`
    }
    content += '\n'
  }
  content += '=== CUSTOMER RESPONSE ===\n\n'
  content += customerResponse
  return content
}

export function MultiChannelUI({ round }: { round: Round }) {
  const { session } = useSession()
  const config = round.config || {}
  const customerEmail = config.customer_email
  const agents: AgentConfig[] = config.internal_agents || []

  // State
  const [activeTab, setActiveTab] = useState<'research' | 'compose'>('research')
  const [selectedAgent, setSelectedAgent] = useState<string>(agents[0]?.agent_id || '')
  const [chatHistories, setChatHistories] = useState<Record<string, ChatMessage[]>>({})
  const [messageInput, setMessageInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [customerResponse, setCustomerResponse] = useState('')
  const [customerSubject, setCustomerSubject] = useState(
    `Re: ${customerEmail?.subject || 'Integration Questions'}`
  )
  const [submitted, setSubmitted] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [chatHistories, selectedAgent])

  const currentChat = chatHistories[selectedAgent] || []
  const agentsConsulted = Object.keys(chatHistories).filter(
    (id) => (chatHistories[id]?.length || 0) > 0
  )

  const sendMessage = async () => {
    if (!messageInput.trim() || !session || loading) return

    const msg: ChatMessage = {
      speaker: 'candidate',
      text: messageInput,
      timestamp: new Date().toISOString()
    }

    setChatHistories((prev) => ({
      ...prev,
      [selectedAgent]: [...(prev[selectedAgent] || []), msg]
    }))

    const messageToSend = messageInput
    setMessageInput('')
    setLoading(true)

    const agent = agents.find((a) => a.agent_id === selectedAgent)

    try {
      const response = await fetch('/api/ai/internal-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.id,
          round_number: round.round_number,
          agent_id: selectedAgent,
          agent_name: agent?.name,
          message: messageToSend,
          conversation_history: chatHistories[selectedAgent] || [],
          agent_persona: agent?.persona || ''
        })
      })

      const data = await response.json()

      const reply: ChatMessage = {
        speaker: selectedAgent,
        agent_name: agent?.name || selectedAgent,
        text: data.response || 'Sorry, I didn\'t catch that. Could you rephrase?',
        timestamp: new Date().toISOString()
      }

      setChatHistories((prev) => ({
        ...prev,
        [selectedAgent]: [...(prev[selectedAgent] || []), reply]
      }))
    } catch {
      const errorReply: ChatMessage = {
        speaker: selectedAgent,
        agent_name: agent?.name || selectedAgent,
        text: 'Sorry, I\'m having trouble connecting. Please try again.',
        timestamp: new Date().toISOString()
      }

      setChatHistories((prev) => ({
        ...prev,
        [selectedAgent]: [...(prev[selectedAgent] || []), errorReply]
      }))
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

  const submitCustomerResponse = async () => {
    if (!customerResponse.trim() || !session) return

    setSubmitted(true)

    const combinedContent = buildScoringContent(chatHistories, customerResponse)

    await fetch('/api/artifact/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: session.id,
        round_number: round.round_number,
        artifact_type: 'multi_channel_response',
        content: combinedContent,
        metadata: {
          customer_response: customerResponse,
          customer_subject: customerSubject,
          internal_chats: chatHistories,
          agents_consulted: agentsConsulted,
          total_internal_messages: Object.values(chatHistories).flat().length
        }
      })
    })
  }

  if (!session) return null

  return (
    <div className="space-y-4">
      {/* Customer Email (read-only) */}
      <div className="rounded-2xl border border-skywash-200 bg-skywash-50 px-4 py-4">
        <div className="flex items-center gap-2 mb-2">
          <Mail className="h-4 w-4 text-skywash-600" />
          <span className="text-xs font-semibold text-skywash-700">Customer Email</span>
        </div>
        <div className="flex items-center justify-between text-xs text-ink-500">
          <span className="font-semibold">
            {customerEmail?.from || 'Customer'} ({customerEmail?.title || ''})
          </span>
        </div>
        <div className="mt-1 font-semibold text-sm text-ink-900">
          {customerEmail?.subject || 'Integration Questions'}
        </div>
        <p className="mt-3 whitespace-pre-wrap text-sm text-ink-700">
          {customerEmail?.body || ''}
        </p>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-2 border-b border-ink-200 pb-0">
        <button
          onClick={() => setActiveTab('research')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'research'
              ? 'border-skywash-500 text-skywash-700'
              : 'border-transparent text-ink-500 hover:text-ink-700'
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          Research (Internal Team)
        </button>
        <button
          onClick={() => setActiveTab('compose')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'compose'
              ? 'border-skywash-500 text-skywash-700'
              : 'border-transparent text-ink-500 hover:text-ink-700'
          }`}
        >
          <Mail className="h-4 w-4" />
          Compose Customer Response
        </button>
      </div>

      {/* Research Tab */}
      {activeTab === 'research' && (
        <div className="flex gap-4 min-h-[400px]">
          {/* Agent Selector */}
          <div className="w-44 shrink-0 space-y-1">
            <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide mb-2">Internal Team</p>
            {agents.map((agent) => {
              const hasMessages = (chatHistories[agent.agent_id]?.length || 0) > 0
              const isSelected = selectedAgent === agent.agent_id
              return (
                <button
                  key={agent.agent_id}
                  onClick={() => setSelectedAgent(agent.agent_id)}
                  className={`w-full text-left rounded-xl px-3 py-2.5 transition-colors ${
                    isSelected
                      ? 'bg-skywash-50'
                      : 'hover:bg-ink-50/80'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`h-7 w-7 rounded-lg flex items-center justify-center text-[10px] font-bold ${agent.avatar_color}`}>
                      {agent.name.split(' ').map((n) => n[0]).join('')}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate ${isSelected ? 'text-skywash-800' : 'text-ink-800'}`}>{agent.name}</p>
                      <p className="text-[11px] text-ink-400 truncate">{agent.role}</p>
                    </div>
                    {hasMessages && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-signal-500 shrink-0 ml-auto" />
                    )}
                  </div>
                </button>
              )
            })}

            <div className="h-px bg-ink-100 my-3" />

            {/* Requirements — inline checklist */}
            <div className="space-y-1.5 px-1">
              <div className="flex items-center gap-2 text-[11px]">
                {agentsConsulted.length >= 2 ? (
                  <CheckCircle2 className="h-3 w-3 text-signal-500 shrink-0" />
                ) : (
                  <div className="h-3 w-3 rounded-full border border-ink-300 shrink-0" />
                )}
                <span className={agentsConsulted.length >= 2 ? 'text-signal-600' : 'text-ink-500'}>
                  Consult both agents
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                {customerResponse.trim().length > 0 ? (
                  <CheckCircle2 className="h-3 w-3 text-signal-500 shrink-0" />
                ) : (
                  <div className="h-3 w-3 rounded-full border border-ink-300 shrink-0" />
                )}
                <span className={customerResponse.trim().length > 0 ? 'text-signal-600' : 'text-ink-500'}>
                  Draft response
                </span>
              </div>
            </div>
          </div>

          {/* Chat Area */}
          <div className="flex-1 flex flex-col rounded-2xl border border-ink-100 bg-white overflow-hidden">
            {/* Chat Header */}
            <div className="border-b border-ink-100 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-ink-800">
                  {agents.find((a) => a.agent_id === selectedAgent)?.name || 'Select an agent'}
                </span>
                <span className="text-xs text-ink-400">
                  {agents.find((a) => a.agent_id === selectedAgent)?.role || ''}
                </span>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 max-h-[300px]">
              {currentChat.length === 0 && (
                <p className="text-xs text-ink-400 text-center py-12">
                  Ask {agents.find((a) => a.agent_id === selectedAgent)?.name || 'this agent'} questions to gather info for your response.
                </p>
              )}
              {currentChat.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.speaker === 'candidate' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                      msg.speaker === 'candidate'
                        ? 'bg-ink-100 text-ink-900'
                        : 'bg-skywash-50 border border-skywash-200 text-ink-900'
                    }`}
                  >
                    <p className="text-xs font-semibold mb-1 text-ink-500">
                      {msg.speaker === 'candidate' ? 'You' : msg.agent_name || msg.speaker}
                    </p>
                    <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl bg-skywash-50 border border-skywash-200 px-4 py-2.5">
                    <Loader2 className="h-3 w-3 animate-spin text-skywash-600" />
                    <span className="text-xs text-skywash-700">
                      {agents.find((a) => a.agent_id === selectedAgent)?.name} is typing...
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-ink-100 px-4 py-3">
              <div className="flex items-end gap-2">
                <Textarea
                  rows={3}
                  placeholder={`Ask ${agents.find((a) => a.agent_id === selectedAgent)?.name || 'the agent'} a question... (Shift+Enter for new line)`}
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                  className="resize-none"
                />
                <Button
                  size="sm"
                  onClick={sendMessage}
                  disabled={!messageInput.trim() || loading}
                  className="shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Compose Tab */}
      {activeTab === 'compose' && (
        <div className="space-y-4">
          {submitted ? (
            <div className="rounded-2xl bg-signal-50 border border-signal-200 px-4 py-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-signal-600" />
                <p className="text-sm font-medium text-signal-800">
                  Customer response submitted. Click &quot;Submit &amp; Next&quot; to complete this round.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3 rounded-2xl border border-ink-200 bg-white px-4 py-4">
              <h3 className="text-sm font-semibold">Compose Response to Customer</h3>
              <p className="text-xs text-ink-500">
                Use the information gathered from your internal team to craft an accurate, professional response.
              </p>
              <Input
                placeholder="Subject line"
                value={customerSubject}
                onChange={(e) => setCustomerSubject(e.target.value)}
              />
              <Textarea
                rows={14}
                placeholder={`Draft your response to ${customerEmail?.from || 'the customer'}...

Address each of their questions with specific, accurate answers:
1. Bulk API capabilities
2. Webhook authentication mechanism
3. Sandbox environment provisioning
4. Custom workflow engine details

Include:
- Specific answers based on what you learned from internal team
- Realistic timelines and expectations
- Any risks or limitations to flag
- Proposed next steps`}
                value={customerResponse}
                onChange={(e) => setCustomerResponse(e.target.value)}
              />
              <div className="flex justify-between items-center">
                <span className="text-xs text-ink-500">
                  Word count: {customerResponse.split(/\s+/).filter(Boolean).length}
                </span>
                <Button
                  size="sm"
                  onClick={submitCustomerResponse}
                  disabled={!customerResponse.trim()}
                >
                  <Send className="mr-2 h-4 w-4" />
                  Submit Response
                </Button>
              </div>
            </div>
          )}

          {/* Summary of research */}
          {agentsConsulted.length > 0 && (
            <div className="rounded-2xl border border-ink-100 bg-white px-4 py-4">
              <h3 className="mb-2 text-sm font-semibold">Research Summary</h3>
              <p className="text-xs text-ink-500 mb-3">
                You consulted {agentsConsulted.length} of {agents.length} internal team members
                ({Object.values(chatHistories).flat().length} total messages).
              </p>
              {agents.map((agent) => {
                const msgs = chatHistories[agent.agent_id] || []
                if (msgs.length === 0) return null
                return (
                  <div key={agent.agent_id} className="mb-3">
                    <p className="text-xs font-medium text-ink-700">{agent.name} ({agent.role})</p>
                    <p className="text-xs text-ink-500">{msgs.filter((m) => m.speaker !== 'candidate').length} responses</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Evaluation Criteria */}
      <div className="rounded-2xl bg-ink-50/60 px-4 py-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-500">Evaluation Criteria</h3>
        <ul className="space-y-1.5 text-xs text-ink-500">
          <li>&#8226; <strong>Internal Coordination:</strong> Targeted questions to the right stakeholders</li>
          <li>&#8226; <strong>Technical Comprehension:</strong> Accurate understanding and relay of details</li>
          <li>&#8226; <strong>Customer Communication:</strong> Clear, professional response addressing all questions</li>
          <li>&#8226; <strong>Risk Identification:</strong> Proactive flagging of gaps and realistic expectations</li>
        </ul>
      </div>
    </div>
  )
}
