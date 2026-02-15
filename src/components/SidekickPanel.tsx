"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  Bot,
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2,
  Mic,
  Send,
  Sparkles,
  Wrench,
  X
} from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useSession } from "@/contexts/SessionContext"
import { AIInputPillButton } from "@/components/ai-input"
import {
  Message,
  MessageContent,
  MessageResponse
} from "@/components/ai-elements/message"
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorName,
  ModelSelectorTrigger
} from "@/components/ai-elements/model-selector"
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning"
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "@/components/ai-elements/tool"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"

type ChatRole = "user" | "assistant"

type ToolTrace = {
  name: string
  input: Record<string, unknown>
  output: Record<string, unknown> | string
}

interface ChatMessage {
  role: ChatRole
  content: string
  createdAt: string
  model?: string
  latencyMs?: number
  thinking?: boolean
  reasoning?: string
  tools?: ToolTrace[]
}

interface ModelOption {
  id: string
  model_key: string
  provider: string
}

const starterMessage: ChatMessage = {
  role: "assistant",
  content:
    "Astra is live. I can help you decompose, verify, and tighten your response quality while preserving candidate ownership.",
  createdAt: new Date().toISOString(),
  model: "gpt-4o"
}

export function SidekickPanel({ role }: { role: string }) {
  const { session, currentRound } = useSession()
  const [messages, setMessages] = useState<ChatMessage[]>([starterMessage])
  const [draft, setDraft] = useState("")
  const [loading, setLoading] = useState(false)
  const [selectedModel, setSelectedModel] = useState("gpt-4o")
  const [models, setModels] = useState<ModelOption[]>([])
  const [queriesRemaining, setQueriesRemaining] = useState<number | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isModelPickerOpen, setIsModelPickerOpen] = useState(false)
  const [pulseTab, setPulseTab] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null)
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    const handlePrefill = (event: Event) => {
      const custom = event as CustomEvent<{ open?: boolean; prompt?: string }>
      if (custom.detail?.open !== false) {
        setIsOpen(true)
      }
      if (typeof custom.detail?.prompt === "string") {
        setDraft(custom.detail.prompt)
      }
    }

    const handleOpen = () => setIsOpen(true)

    window.addEventListener("astra:prefill", handlePrefill as EventListener)
    window.addEventListener("astra:open", handleOpen)

    return () => {
      window.removeEventListener("astra:prefill", handlePrefill as EventListener)
      window.removeEventListener("astra:open", handleOpen)
    }
  }, [])

  useEffect(() => {
    const loadModels = async () => {
      const response = await fetch("/api/models?purpose=candidate_sidekick")
      if (!response.ok) return
      const data = await response.json()
      const rows = (data.models || []) as ModelOption[]
      setModels(rows)
      if (rows.length > 0) {
        setSelectedModel(rows[0].model_key)
      }
    }
    void loadModels()
  }, [])

  useEffect(() => {
    if (!isOpen) {
      setPulseTab(true)
      const timeout = setTimeout(() => setPulseTab(false), 1300)
      return () => clearTimeout(timeout)
    }

    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, loading, isOpen])

  // Cleanup speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
        recognitionRef.current = null
      }
      if (typeof window !== 'undefined') {
        window.speechSynthesis?.cancel()
      }
    }
  }, [])

  const toggleListening = () => {
    if (typeof window === 'undefined') return
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Voice input is not supported in this browser.',
          createdAt: new Date().toISOString(),
          model: 'system'
        }
      ])
      return
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop()
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript || ''
      setDraft((prev) => (prev ? `${prev} ${transcript}` : transcript))
    }

    recognition.onerror = () => {
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition
    setIsListening(true)
    recognition.start()
  }

  const sendMessage = async () => {
    if (!draft.trim() || loading || !session) return

    const nextUserMessage: ChatMessage = {
      role: "user",
      content: draft,
      createdAt: new Date().toISOString(),
      model: selectedModel
    }

    setMessages((prev) => [...prev, nextUserMessage])
    setDraft("")
    setLoading(true)

    const start = performance.now()

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: session.id,
          round_id: currentRound?.round_number,
          query: nextUserMessage.content,
          history: messages,
          model_key: selectedModel
        })
      })

      const data = await response.json()
      const toolNames: string[] = Array.isArray(data?.meta?.tools) ? data.meta.tools : []
      const toolTraces: ToolTrace[] = toolNames.map((name) => ({
        name,
        input: {
          round: currentRound?.round_number ?? null,
          query_preview: nextUserMessage.content.slice(0, 80)
        },
        output: {
          status: "ok",
          summary: `Tool ${name} provided context for this response.`
        }
      }))

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: data.response || data.error || "Unable to generate response.",
        createdAt: new Date().toISOString(),
        model: data?.meta?.model || selectedModel,
        latencyMs: data?.meta?.latency_ms || Math.round(performance.now() - start),
        thinking: Boolean(data?.meta?.thinking),
        reasoning: data?.meta?.thinking
          ? "I scored this request against policy, selected a concise structure, and prioritized verifiable guidance."
          : undefined,
        tools: toolTraces
      }

      setMessages((prev) => [...prev, assistantMessage])

      if (typeof data.remaining_queries === "number") {
        setQueriesRemaining(data.remaining_queries)
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sidekick request failed. Please retry.",
          createdAt: new Date().toISOString(),
          model: selectedModel
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  const usageSummary = useMemo(() => {
    const assistantCount = messages.filter((message) => message.role === "assistant").length
    const userCount = messages.filter((message) => message.role === "user").length
    return { assistantCount, userCount }
  }, [messages])

  const selectedModelMeta = models.find((model) => model.model_key === selectedModel)
  const modelProvider = (selectedModelMeta?.provider || "openai").toLowerCase()

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Open Astra sidekick"
        className="fixed right-0 top-1/2 z-40 hidden -translate-y-1/2 rounded-l-2xl border border-r-0 bg-card/95 px-3 py-3 shadow-lg backdrop-blur lg:flex lg:items-center lg:gap-2"
        animate={{ x: pulseTab ? [-4, 0, -4, 0] : 0 }}
        transition={{ duration: 0.9, ease: "easeInOut" }}
      >
        <Bot className="h-4 w-4 text-primary" />
        <div className="text-left">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Astra</p>
          <p className="text-xs font-semibold">Sidekick</p>
        </div>
        <ChevronLeft className="h-4 w-4 text-muted-foreground" />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Close sidekick"
              className="fixed inset-0 z-40 hidden bg-black/35 lg:block"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
            />

            <motion.aside
              initial={{ x: "100%", opacity: 0.7 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0.7 }}
              transition={{ type: "spring", damping: 26, stiffness: 260 }}
              className="fixed inset-y-0 right-0 z-50 w-full max-w-[440px] border-l bg-background/98 backdrop-blur"
            >
              <div className="flex h-full flex-col p-4">
                <Card className="flex h-full flex-col overflow-hidden border-primary/30">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Bot className="h-4 w-4 text-primary" />
                          Astra Sidekick
                        </CardTitle>
                        <CardDescription>
                          Auto-collapsed assistant for {role}. Full prompt and tool trace logging is enabled.
                        </CardDescription>
                      </div>

                      <div className="flex items-center gap-1">
                        <Badge variant="secondary">Live</Badge>
                        <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-md border px-2 py-1 text-muted-foreground">
                        Candidate prompts: <span className="font-semibold text-foreground">{usageSummary.userCount}</span>
                      </div>
                      <div className="rounded-md border px-2 py-1 text-muted-foreground">
                        Astra replies: <span className="font-semibold text-foreground">{usageSummary.assistantCount}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <ModelSelector open={isModelPickerOpen} onOpenChange={setIsModelPickerOpen}>
                        <ModelSelectorTrigger asChild>
                          <Button variant="outline" className="w-full justify-between">
                            <div className="flex items-center gap-2">
                              <ModelSelectorLogo provider={modelProvider} />
                              <span className="text-sm">{selectedModel}</span>
                            </div>
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </ModelSelectorTrigger>

                        <ModelSelectorContent title="Select sidekick model">
                          <ModelSelectorInput placeholder="Search model..." />
                          <ModelSelectorList>
                            <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
                            <ModelSelectorGroup heading="Available models">
                              {(models.length ? models : [{ id: "default", model_key: "gpt-4o", provider: "openai" }]).map(
                                (model) => (
                                  <ModelSelectorItem
                                    key={model.id}
                                    onSelect={() => {
                                      setSelectedModel(model.model_key)
                                      setIsModelPickerOpen(false)
                                    }}
                                  >
                                    <ModelSelectorLogo provider={(model.provider || "openai").toLowerCase()} />
                                    <ModelSelectorName>{model.provider} / {model.model_key}</ModelSelectorName>
                                    {selectedModel === model.model_key && <Check className="h-4 w-4" />}
                                  </ModelSelectorItem>
                                )
                              )}
                            </ModelSelectorGroup>
                          </ModelSelectorList>
                        </ModelSelectorContent>
                      </ModelSelector>
                    </div>
                  </CardHeader>

                  <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
                    <ScrollArea className="h-[52vh] rounded-lg border bg-muted/20 p-3">
                      <div className="space-y-4">
                        {messages.map((message, index) => {
                          const messageRole = message.role === "assistant" ? "assistant" : "user"

                          return (
                            <div key={`${message.createdAt}-${index}`} className="space-y-2">
                              <Message from={messageRole}>
                                <MessageContent>
                                  <MessageResponse>{message.content}</MessageResponse>
                                </MessageContent>
                              </Message>

                              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                <span>{message.role === "assistant" ? "Astra" : "You"}</span>
                                {message.model && <span>• {message.model}</span>}
                                {typeof message.latencyMs === "number" && <span>• {message.latencyMs}ms</span>}
                              </div>

                              {message.thinking && message.reasoning && (
                                <Reasoning defaultOpen={false} isStreaming={false}>
                                  <ReasoningTrigger />
                                  <ReasoningContent>{message.reasoning}</ReasoningContent>
                                </Reasoning>
                              )}

                              {(message.tools || []).map((trace) => (
                                <Tool key={`${message.createdAt}-${trace.name}`} defaultOpen={false}>
                                  <ToolHeader type="dynamic-tool" toolName={trace.name} state="output-available" />
                                  <ToolContent>
                                    <ToolInput input={trace.input} />
                                    <ToolOutput output={trace.output} errorText={undefined} />
                                  </ToolContent>
                                </Tool>
                              ))}
                            </div>
                          )
                        })}

                        {loading && (
                          <div className="rounded-xl border bg-background/80 p-3 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Astra is thinking...
                            </div>
                          </div>
                        )}
                        <div ref={scrollAnchorRef} />
                      </div>
                    </ScrollArea>

                    <Separator />

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <AIInputPillButton icon={Sparkles} className="text-xs">
                          Focused guidance
                        </AIInputPillButton>
                        <AIInputPillButton icon={Wrench} className="text-xs">
                          Tool traces
                        </AIInputPillButton>
                      </div>

                      <Textarea
                        rows={4}
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault()
                            void sendMessage()
                          }
                        }}
                        placeholder="Ask for decomposition, verification checks, and concise structure suggestions..."
                        disabled={loading}
                      />

                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          {queriesRemaining === null ? "Policy and query caps may apply." : `Queries remaining: ${queriesRemaining}`}
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant={isListening ? "secondary" : "outline"}
                            size="icon"
                            onClick={toggleListening}
                            disabled={loading}
                            aria-label={isListening ? "Stop voice input" : "Start voice input"}
                          >
                            <Mic className={`h-4 w-4 ${isListening ? "animate-pulse" : ""}`} />
                          </Button>
                          <Button onClick={sendMessage} disabled={loading || !draft.trim()}>
                            <Send className="h-4 w-4" />
                            Send
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
