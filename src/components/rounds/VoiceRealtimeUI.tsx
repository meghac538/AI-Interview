'use client'

import { useState, useEffect } from 'react'
import { Mic, MicOff, Phone, PhoneOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useSession } from '@/contexts/SessionContext'
import { useVoiceRealtime } from '@/hooks/useVoiceRealtime'
import type { Round } from '@/lib/types/database'

export function VoiceRealtimeUI({ round }: { round: Round }) {
  const { session } = useSession()
  const [duration, setDuration] = useState(0)

  const {
    isConnected,
    isConnecting,
    isSpeaking,
    transcript,
    error,
    connect,
    disconnect,
    saveTranscript
  } = useVoiceRealtime({
    sessionId: session?.id || '',
    personaId: round.config.persona_id,
    scenarioId: round.config.scenario_id,
    difficulty: round.config.initial_difficulty || 3
  })

  // Handle disconnect with transcript save
  const handleDisconnect = async () => {
    // Save transcript and trigger scoring
    await saveTranscript()

    // Mark round as completed
    if (session?.id) {
      try {
        await fetch('/api/round/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: session.id,
            round_number: round.round_number
          })
        })
        console.log('Round marked as completed')
      } catch (err) {
        console.error('Failed to complete round:', err)
      }
    }

    // Disconnect WebRTC
    disconnect()
  }

  // Timer
  useEffect(() => {
    if (!isConnected) return

    const interval = setInterval(() => {
      setDuration(prev => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [isConnected])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (!session) return null

  return (
    <div className="space-y-5">
      {/* Connection Status */}
      <div className="flex items-center justify-between rounded-2xl border bg-card px-6 py-4">
        <div className="flex items-center gap-3">
          <div
            className={`h-3 w-3 rounded-full ${
              isConnected
                ? 'animate-pulse bg-emerald-500'
                : isConnecting
                ? 'animate-pulse bg-amber-500'
                : 'bg-muted-foreground'
            }`}
          />
          <span className="text-sm font-semibold">
            {isConnected ? `Live Call - ${formatTime(duration)}` : isConnecting ? 'Connecting...' : 'Ready to Start'}
          </span>
          {isConnected && isSpeaking && (
            <Badge variant="secondary" className="animate-pulse">
              AI Speaking
            </Badge>
          )}
        </div>

        <Button
          variant={isConnected ? 'destructive' : 'default'}
          size="sm"
          onClick={isConnected ? handleDisconnect : connect}
          disabled={isConnecting}
        >
          {isConnected ? (
            <>
              <PhoneOff className="mr-2 h-4 w-4" />
              End Call
            </>
          ) : (
            <>
              <Phone className="mr-2 h-4 w-4" />
              {isConnecting ? 'Connecting...' : 'Start Call'}
            </>
          )}
        </Button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/40 px-4 py-3">
          <p className="text-sm font-semibold text-red-800 dark:text-red-200">Connection Error</p>
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          <p className="mt-2 text-xs text-red-600 dark:text-red-400">
            Make sure you've allowed microphone access in your browser.
          </p>
        </div>
      )}

      {/* Audio Visualizer */}
      {isConnected && (
        <div className="rounded-2xl border bg-gradient-to-br from-blue-50 to-card dark:from-blue-950/30 px-6 py-8">
          <div className="flex items-center justify-center gap-2">
            {/* Simple audio visualizer bars */}
            {[...Array(7)].map((_, i) => (
              <div
                key={i}
                className={`w-2 rounded-full bg-blue-500 transition-all ${
                  isSpeaking ? 'animate-pulse' : ''
                }`}
                style={{
                  height: isSpeaking ? `${Math.random() * 40 + 20}px` : '20px',
                  animationDelay: `${i * 100}ms`
                }}
              />
            ))}
          </div>
          <div className="mt-4 text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-card px-4 py-2 shadow-sm">
              <Mic className={`h-4 w-4 ${isSpeaking ? 'text-emerald-500' : 'text-blue-600'}`} />
              <span className="text-sm font-medium text-foreground">
                {isSpeaking ? 'AI is speaking...' : 'Listening...'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Live Transcript */}
      {transcript.length > 0 && (
        <div className="rounded-2xl border bg-card px-4 py-4">
          <h3 className="mb-3 text-sm font-semibold">Live Transcript</h3>
          <div className="max-h-64 space-y-3 overflow-y-auto">
            {transcript.map((item, index) => (
              <div
                key={index}
                className={`rounded-lg px-3 py-2 text-sm ${
                  item.role === 'user'
                    ? 'bg-muted text-foreground'
                    : 'bg-blue-50 dark:bg-blue-950/30 text-foreground'
                }`}
              >
                <span className="font-semibold">
                  {item.role === 'user' ? 'You' : 'Prospect'}:
                </span>{' '}
                {item.text}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Instructions */}
      {!isConnected && (
        <div className="rounded-2xl bg-blue-50 dark:bg-blue-950/40 px-4 py-4">
          <p className="text-sm text-foreground">
            <strong>Instructions:</strong> Click "Start Call" to begin your voice conversation with an AI prospect.
            This is a live role-play exercise where you'll conduct a discovery call, handle objections, and
            demonstrate your sales skills. Speak naturally - the AI will respond in real-time.
          </p>
          <div className="mt-3 space-y-1 text-xs text-muted-foreground">
            <p>Your microphone will be activated when you connect</p>
            <p>The conversation is transcribed in real-time</p>
            <p>Duration: {round.duration_minutes} minutes</p>
            <p>Difficulty level: {round.config.initial_difficulty || 3}/5</p>
          </div>
        </div>
      )}

      {/* Round Requirements */}
      <div className="rounded-2xl border bg-card px-4 py-4">
        <h3 className="mb-3 text-sm font-semibold">Round Objectives</h3>
        <ul className="space-y-2 text-sm text-foreground">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-blue-500" />
            Ask discovery questions to understand their needs
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-blue-500" />
            Handle objections professionally and confidently
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-blue-500" />
            Demonstrate value and build rapport
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-blue-500" />
            Close for next steps
          </li>
        </ul>
      </div>
    </div>
  )
}
