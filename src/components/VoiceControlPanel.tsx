'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { AlertCircle, Zap, TrendingUp, TrendingDown, DollarSign } from 'lucide-react'

interface VoiceControlPanelProps {
  sessionId: string
  isCallActive: boolean
}

export function VoiceControlPanel({ sessionId, isCallActive }: VoiceControlPanelProps) {
  const [difficulty, setDifficulty] = useState(3)
  const [commandSent, setCommandSent] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  // Send difficulty change command
  const handleDifficultyChange = async (newDifficulty: number) => {
    setDifficulty(newDifficulty)
    setSending(true)

    const { error } = await supabase.from('voice_commands').insert({
      session_id: sessionId,
      command_type: 'difficulty_change',
      payload: { difficulty: newDifficulty }
    })

    if (error) {
      console.error('Failed to send difficulty command:', error)
      setCommandSent('❌ Command failed')
    } else {
      setCommandSent(`✅ Difficulty → ${newDifficulty}`)
    }

    setSending(false)
    setTimeout(() => setCommandSent(null), 3000)
  }

  // Send curveball injection command
  const handleCurveballInject = async (curveball: string, label: string) => {
    setSending(true)

    const { error } = await supabase.from('voice_commands').insert({
      session_id: sessionId,
      command_type: 'curveball_inject',
      payload: { curveball, label }
    })

    if (error) {
      console.error('Failed to send curveball command:', error)
      setCommandSent('❌ Curveball failed')
    } else {
      setCommandSent(`✅ Curveball: ${label}`)
    }

    setSending(false)
    setTimeout(() => setCommandSent(null), 3000)
  }

  const curveballs = [
    { id: 'budget_cut', label: 'Budget Cut by 50%', icon: TrendingDown, description: 'Client announces sudden budget reduction' },
    { id: 'timeline_urgent', label: 'Need Answer Today', icon: AlertCircle, description: 'Decision timeline compressed to immediate' },
    { id: 'competitor_cheaper', label: 'Competitor is Cheaper', icon: DollarSign, description: 'Mentions competitor offering lower price' },
    { id: 'stakeholder_veto', label: 'Stakeholder Pushback', icon: TrendingUp, description: 'New stakeholder enters with objections' },
    { id: 'technical_concern', label: 'Technical Blocker', icon: Zap, description: 'Raises integration or technical concern' }
  ]

  return (
    <div className="space-y-4">
      {/* Difficulty Dial */}
      <Card className="bg-white/90">
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-ink-900">Difficulty Level</h3>
            {!isCallActive && (
              <span className="text-xs text-ink-500">Call must be active</span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="1"
              max="5"
              value={difficulty}
              onChange={(e) => handleDifficultyChange(parseInt(e.target.value))}
              disabled={!isCallActive || sending}
              className="flex-1 accent-skywash-500 disabled:opacity-40"
            />
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-skywash-100 text-lg font-bold text-skywash-700">
              {difficulty}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-ink-600">
            <span>Easy</span>
            <span>Moderate</span>
            <span>Hard</span>
          </div>

          <div className="rounded-lg bg-skywash-50 px-3 py-2 text-xs text-ink-700">
            {difficulty === 1 && '🟢 Friendly, minimal resistance, easy to convince'}
            {difficulty === 2 && '🟡 Mild pushback, reasonable objections'}
            {difficulty === 3 && '🟠 Moderate resistance, multiple objections'}
            {difficulty === 4 && '🔴 Strong objections, skeptical, hard to convince'}
            {difficulty === 5 && '⚫ Adversarial, aggressive pushback, hostile'}
          </div>
        </CardContent>
      </Card>

      {/* Curveball Injection */}
      <Card className="bg-white/90">
        <CardHeader>
          <h3 className="text-base font-semibold text-ink-900">Inject Curveball</h3>
          <p className="text-xs text-ink-500">
            Throw unexpected objections to test adaptability
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {curveballs.map((curveball) => {
            const Icon = curveball.icon
            return (
              <Button
                key={curveball.id}
                onClick={() => handleCurveballInject(curveball.id, curveball.label)}
                disabled={!isCallActive || sending}
                variant="outline"
                size="sm"
                className="w-full justify-start text-left hover:bg-signal-50 hover:border-signal-300"
                title={curveball.description}
              >
                <Icon className="mr-2 h-4 w-4 flex-shrink-0" />
                <span className="truncate">{curveball.label}</span>
              </Button>
            )
          })}
        </CardContent>
      </Card>

      {/* Command Feedback */}
      {commandSent && (
        <div className="animate-in fade-in slide-in-from-top-2 rounded-lg border border-skywash-200 bg-skywash-50 px-4 py-3">
          <p className="text-sm font-semibold text-skywash-900">{commandSent}</p>
        </div>
      )}

      {/* Instructions */}
      <div className="rounded-lg bg-ink-50 px-4 py-3 text-xs text-ink-600">
        <p className="font-semibold mb-1">How it works:</p>
        <ul className="space-y-1 list-disc list-inside">
          <li>Difficulty changes apply on the AI's next response</li>
          <li>Curveballs inject into the conversation context immediately</li>
          <li>Commands sync in real-time via Supabase</li>
        </ul>
      </div>
    </div>
  )
}
