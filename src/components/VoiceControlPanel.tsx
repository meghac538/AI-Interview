'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Zap } from 'lucide-react'
import { getCurveballsForTrack } from '@/lib/constants/curveball-library'

interface VoiceControlPanelProps {
  sessionId: string
  isCallActive: boolean
  track?: string
}

export function VoiceControlPanel({ sessionId, isCallActive, track }: VoiceControlPanelProps) {
  const [difficulty, setDifficulty] = useState(3)
  const [commandSent, setCommandSent] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [customText, setCustomText] = useState('')

  const curveballs = getCurveballsForTrack(track || 'sales')

  // Send difficulty change command
  const handleDifficultyChange = async (newDifficulty: number) => {
    setDifficulty(newDifficulty)
    setSending(true)

    const { error } = await supabase.from('voice_commands').insert({
      session_id: sessionId,
      command_type: 'difficulty_change',
      payload: { difficulty: newDifficulty }
    })

    // Also log to live_events for audit trail
    await supabase.from('live_events').insert({
      session_id: sessionId,
      event_type: 'interviewer_action',
      actor: 'interviewer',
      payload: { action_type: 'escalate_difficulty', difficulty: newDifficulty, source: 'voice_control_panel' }
    })

    if (error) {
      console.error('Failed to send difficulty command:', error)
      setCommandSent('Command failed')
    } else {
      setCommandSent(`Difficulty set to ${newDifficulty}`)
    }

    setSending(false)
    setTimeout(() => setCommandSent(null), 3000)
  }

  // Send curveball injection command
  const handleCurveballInject = async (curveballKey: string, label: string, customCurveballText?: string) => {
    setSending(true)

    const { error } = await supabase.from('voice_commands').insert({
      session_id: sessionId,
      command_type: 'curveball_inject',
      payload: {
        curveball: curveballKey,
        label: customCurveballText || label,
        custom_text: customCurveballText || undefined,
      }
    })

    // Also log to live_events for audit trail and dashboard feedback
    await supabase.from('live_events').insert({
      session_id: sessionId,
      event_type: 'interviewer_action',
      actor: 'interviewer',
      payload: {
        action_type: 'inject_curveball',
        curveball: curveballKey,
        custom_text: customCurveballText || undefined,
        source: 'voice_control_panel',
      }
    })

    if (error) {
      console.error('Failed to send curveball command:', error)
      setCommandSent('Curveball failed')
    } else {
      setCommandSent(`Curveball: ${customCurveballText || label}`)
    }

    setSending(false)
    setTimeout(() => setCommandSent(null), 3000)
  }

  return (
    <div className="space-y-4">
      {/* Difficulty Dial */}
      <Card className="bg-card/90">
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">Difficulty Level</h3>
            {!isCallActive && (
              <span className="text-xs text-muted-foreground">Call must be active</span>
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
              className="flex-1 accent-primary disabled:opacity-40"
            />
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
              {difficulty}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Easy</span>
            <span>Moderate</span>
            <span>Hard</span>
          </div>

          <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-foreground">
            {difficulty === 1 && 'Friendly, minimal resistance, easy to convince'}
            {difficulty === 2 && 'Mild pushback, reasonable objections'}
            {difficulty === 3 && 'Moderate resistance, multiple objections'}
            {difficulty === 4 && 'Strong objections, skeptical, hard to convince'}
            {difficulty === 5 && 'Adversarial, aggressive pushback, hostile'}
          </div>
        </CardContent>
      </Card>

      {/* Curveball Injection — Track-Aware */}
      <Card className="bg-card/90">
        <CardHeader>
          <h3 className="text-base font-semibold text-foreground">Inject Curveball</h3>
          <p className="text-xs text-muted-foreground">
            Throw unexpected objections to test adaptability
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {curveballs.map((cb) => (
            <Button
              key={cb.key}
              onClick={() => handleCurveballInject(cb.key, cb.title)}
              disabled={!isCallActive || sending}
              variant="outline"
              size="sm"
              className="w-full justify-start text-left hover:bg-red-50 hover:border-red-300 dark:hover:bg-red-950/30 dark:hover:border-red-700"
              title={cb.detail}
            >
              <Zap className="mr-2 h-4 w-4 flex-shrink-0" />
              <span className="truncate">{cb.title}</span>
            </Button>
          ))}

          {/* Custom curveball input */}
          <div className="flex items-center gap-2 pt-2 border-t">
            <Input
              className="h-8 text-xs"
              placeholder="Custom curveball..."
              value={customText}
              disabled={!isCallActive || sending}
              onChange={(e) => setCustomText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && customText.trim()) {
                  handleCurveballInject('custom', customText.trim(), customText.trim())
                  setCustomText('')
                }
              }}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={!isCallActive || sending || !customText.trim()}
              onClick={() => {
                handleCurveballInject('custom', customText.trim(), customText.trim())
                setCustomText('')
              }}
            >
              Send
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Command Feedback */}
      {commandSent && (
        <div className="animate-in fade-in slide-in-from-top-2 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40 px-4 py-3">
          <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">{commandSent}</p>
        </div>
      )}

      {/* Instructions */}
      <div className="rounded-lg bg-muted px-4 py-3 text-xs text-muted-foreground">
        <p className="font-semibold mb-1">How it works:</p>
        <ul className="space-y-1 list-disc list-inside">
          <li>Difficulty changes apply on the AI&apos;s next response</li>
          <li>Curveballs inject into the conversation context immediately</li>
          <li>Commands sync in real-time via Supabase</li>
        </ul>
      </div>
    </div>
  )
}
