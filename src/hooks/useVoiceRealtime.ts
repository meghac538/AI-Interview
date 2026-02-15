import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Conversation } from '@elevenlabs/client'

interface VoiceRealtimeConfig {
  sessionId: string
  personaId?: string
  scenarioId?: string
  difficulty?: number
}

interface TranscriptItem {
  role: 'user' | 'assistant'
  text: string
  timestamp: number
}

// Batch sending configuration
const BATCH_SIZE = 10 // Send every 10 messages
const BATCH_INTERVAL = 30000 // Or every 30 seconds

export function useVoiceRealtime(config: VoiceRealtimeConfig) {
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [transcript, setTranscript] = useState<TranscriptItem[]>([])
  const [error, setError] = useState<string | null>(null)

  // Batch management state
  const [transcriptBatch, setTranscriptBatch] = useState<TranscriptItem[]>([])
  const batchTimerRef = useRef<NodeJS.Timeout | null>(null)

  const conversationRef = useRef<Conversation | null>(null)
  const audioStreamRef = useRef<MediaStream | null>(null)

  // Send transcript batch to API
  const sendTranscriptBatch = useCallback(
    async (messages: TranscriptItem[]) => {
      if (messages.length === 0) return { success: false }

      try {
        await fetch('/api/voice/transcript', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: config.sessionId,
            round_number: 1,
            messages: messages.map((m) => ({
              role: m.role,
              text: m.text,
              timestamp: m.timestamp
            }))
          })
        })
        console.log(`📤 Sent ${messages.length} transcript messages to API`)
        return { success: true }
      } catch (err) {
        console.error('Failed to send transcript batch:', err)
        return { success: false }
      }
    },
    [config.sessionId]
  )

  // Connect to ElevenLabs Conversational AI via SDK
  const connect = useCallback(async () => {
    if (isConnecting || isConnected) return

    setIsConnecting(true)
    setError(null)

    try {
      // Step 1: Get agent ID from our API
      const sessionResponse = await fetch('/api/voice/elevenlabs-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: config.sessionId,
          difficulty: config.difficulty || 3
        })
      })

      if (!sessionResponse.ok) {
        const errorData = await sessionResponse.json()
        throw new Error(errorData.error || 'Failed to get ElevenLabs session')
      }

      const { agent_id } = await sessionResponse.json()
      console.log('🎯 Connecting to ElevenLabs agent:', agent_id)

      // Step 2: Get user's microphone
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })
      audioStreamRef.current = stream

      // Step 3: Create conversation using ElevenLabs SDK
      // @ts-expect-error - ElevenLabs SDK API may vary by version; agentId mode vs conversationToken
      const conversation = await Conversation.startSession({
        agentId: agent_id,
        // Use WebRTC for lowest latency (SDK handles everything)
        clientTools: {},
        onConnect: () => {
          console.log('✅ Connected to ElevenLabs')
          setIsConnected(true)
          setIsConnecting(false)
        },
        onDisconnect: () => {
          console.log('🔌 Disconnected from ElevenLabs')
          setIsConnected(false)
        },
        onError: (error: unknown) => {
          console.error('❌ ElevenLabs error:', error)
          setError(error instanceof Error ? error.message : String(error))
        },
        onModeChange: (mode) => {
          console.log('🔄 Mode changed:', mode)
          setIsSpeaking(mode.mode === 'speaking')
        },
        onMessage: (message) => {
          console.log('📨 Message:', message)

          // SDK message format: {source: 'user'|'ai', role: 'user'|'agent', message: '...'}
          if (!message.message) return

          // Handle user messages
          if (message.role === 'user' || message.source === 'user') {
            const newItem: TranscriptItem = {
              role: 'user',
              text: message.message,
              timestamp: Date.now()
            }

            setTranscript((prev) => [...prev, newItem])

            // Add to batch for API sending
            setTranscriptBatch((prev) => {
              const newBatch = [...prev, newItem]

              // Send if batch reaches size limit
              if (newBatch.length >= BATCH_SIZE) {
                sendTranscriptBatch(newBatch).then(({ success }) => {
                  if (success) {
                    setTranscriptBatch([]) // Only clear on success
                  }
                })
              }

              return newBatch
            })

            // Publish to live_events
            void Promise.resolve(
              supabase
                .from('live_events')
                .insert({
                  session_id: config.sessionId,
                  event_type: 'voice_transcript',
                  payload: {
                    role: 'user',
                    text: message.message,
                    timestamp: newItem.timestamp
                  }
                })
            )
              .then(() => console.log('📝 User transcript published'))
              .catch((err) => console.error('Failed to publish transcript:', err))
          }

          // Handle agent messages
          if (message.role === 'agent' || message.source === 'ai') {
            const newItem: TranscriptItem = {
              role: 'assistant',
              text: message.message,
              timestamp: Date.now()
            }

            setTranscript((prev) => [...prev, newItem])

            // Add to batch for API sending
            setTranscriptBatch((prev) => {
              const newBatch = [...prev, newItem]

              // Send if batch reaches size limit
              if (newBatch.length >= BATCH_SIZE) {
                sendTranscriptBatch(newBatch).then(({ success }) => {
                  if (success) {
                    setTranscriptBatch([]) // Only clear on success
                  }
                })
              }

              return newBatch
            })

            // Publish to live_events
            void Promise.resolve(
              supabase
                .from('live_events')
                .insert({
                  session_id: config.sessionId,
                  event_type: 'voice_transcript',
                  payload: {
                    role: 'assistant',
                    text: message.message,
                    timestamp: newItem.timestamp
                  }
                })
            )
              .then(() => console.log('📝 Agent transcript published'))
              .catch((err: unknown) => console.error('Failed to publish transcript:', err))
          }
        }
      })

      conversationRef.current = conversation

      // SDK handles audio streaming automatically!
      console.log('🎤 SDK handling audio streaming')
    } catch (err: any) {
      console.error('Connection error:', err)
      setError(err.message)
      setIsConnecting(false)
      cleanup()
    }
  }, [config, isConnecting, isConnected])

  // Disconnect and cleanup
  const disconnect = useCallback(async () => {
    // Send any remaining batched messages
    if (transcriptBatch.length > 0) {
      await sendTranscriptBatch(transcriptBatch)
    }

    cleanup()
    setIsConnected(false)
  }, [transcriptBatch, sendTranscriptBatch])

  const cleanup = () => {
    if (conversationRef.current) {
      conversationRef.current.endSession()
      conversationRef.current = null
    }

    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop())
      audioStreamRef.current = null
    }
  }

  // Batch timer: send partial batches every 30 seconds
  useEffect(() => {
    if (!isConnected) return

    const intervalId = setInterval(() => {
      // Use functional state update to access current batch without closure
      setTranscriptBatch((currentBatch) => {
        if (currentBatch.length > 0) {
          // Send but DON'T clear immediately - wait for success
          sendTranscriptBatch(currentBatch).then(({ success }) => {
            if (success) {
              setTranscriptBatch([]) // Clear only on success
            }
          })
        }
        return currentBatch // Don't clear here - let the promise handler do it
      })
    }, BATCH_INTERVAL)

    return () => clearInterval(intervalId)
  }, [isConnected, sendTranscriptBatch])

  // Subscribe to voice commands from interviewer
  useEffect(() => {
    if (!isConnected) return

    const channel = supabase
      .channel(`voice-commands-${config.sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'voice_commands',
          filter: `session_id=eq.${config.sessionId}`
        },
        (payload) => {
          const command = payload.new as any
          handleVoiceCommand(command)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [isConnected, config.sessionId])

  // Handle voice commands from interviewer (difficulty/curveball)
  const handleVoiceCommand = (command: any) => {
    if (!conversationRef.current) {
      console.warn('Conversation not ready for command:', command)
      return
    }

    console.log('📡 Received voice command:', command)

    try {
      if (command.command_type === 'difficulty_change') {
        const difficulty = command.payload.difficulty

        // Send context update via SDK
        // @ts-expect-error - sendText exists at runtime but not in SDK types
        conversationRef.current.sendText(
          `[System note: Adjust your questioning style to difficulty level ${difficulty}. ${getDifficultyHint(difficulty)}]`
        )

        console.log(`✅ Difficulty changed to ${difficulty}`)
      } else if (command.command_type === 'curveball_inject') {
        const curveball = command.payload.curveball
        const label = command.payload.label || curveball

        // Inject curveball via SDK
        // @ts-expect-error - sendText exists at runtime but not in SDK types
        conversationRef.current.sendText(getCurveballPrompt(curveball, label))

        console.log(`✅ Curveball injected: ${label}`)
      }
    } catch (err) {
      console.error('Failed to send command:', err)
    }
  }

  // Get difficulty adjustment hint
  const getDifficultyHint = (difficulty: number): string => {
    const hints: Record<number, string> = {
      1: 'Be friendly and receptive.',
      2: 'Show mild interest but ask 1-2 simple questions.',
      3: 'Be moderately skeptical and push for details.',
      4: 'Be highly critical and demand proof.',
      5: 'Be adversarial and extremely difficult to convince.'
    }
    return hints[difficulty] || hints[3]
  }

  // Generate curveball prompts
  const getCurveballPrompt = (curveball: string, label: string): string => {
    const prompts: Record<string, string> = {
      budget_cut:
        '[Immediately inject this objection] My budget was just cut by 50%. How can I justify this spend?',
      timeline_urgent:
        '[Immediately inject this objection] My boss needs a decision by end of day. Can you commit to that timeline?',
      competitor_cheaper:
        '[Immediately inject this objection] I just got a quote from a competitor for half your price. Why should I pay more?',
      stakeholder_veto:
        '[Immediately inject this objection] My CTO/CFO is pushing back on this approach. How do I convince them?',
      technical_concern:
        '[Immediately inject this objection] I just realized we have a technical blocker with integration. How would you handle that?'
    }

    return prompts[curveball] || `[Immediately inject this objection] ${label}`
  }

  // Trigger AI assessments periodically during call
  useEffect(() => {
    if (!isConnected || transcript.length < 4) return

    const interval = setInterval(async () => {
      if (transcript.length > 0) {
        try {
          await fetch('/api/ai/assess', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: config.sessionId,
              round_number: 1,
              transcript: transcript.slice(-10) // Last 10 messages
            })
          })
          console.log('🤖 AI assessment triggered')
        } catch (err) {
          console.error('Assessment trigger failed:', err)
        }
      }
    }, 30000) // Every 30 seconds

    return () => clearInterval(interval)
  }, [isConnected, transcript, config.sessionId])

  // Save transcript to artifacts when call ends
  const saveTranscript = useCallback(async () => {
    if (transcript.length === 0) {
      console.warn('No transcript to save')
      return
    }

    try {
      // Save transcript artifact
      await supabase.from('artifacts').insert({
        session_id: config.sessionId,
        round_number: 1,
        artifact_type: 'transcript',
        content: { items: transcript }
      })
      console.log('✅ Transcript saved to artifacts')

      // Trigger final scoring
      await fetch('/api/score/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: config.sessionId,
          round_number: 1
        })
      })
      console.log('🎯 Final scoring triggered')
    } catch (err) {
      console.error('Failed to save transcript or trigger scoring:', err)
    }
  }, [transcript, config.sessionId])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (transcript.length > 0) {
        saveTranscript()
      }
      cleanup()
    }
  }, [])

  return {
    isConnected,
    isConnecting,
    isSpeaking,
    transcript,
    error,
    connect,
    disconnect,
    saveTranscript
  }
}
