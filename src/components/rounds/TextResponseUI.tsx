'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { useSession } from '@/contexts/SessionContext'
import type { Round } from '@/lib/types/database'

export function TextResponseUI({ round }: { round: Round }) {
  const { session } = useSession()
  const [response, setResponse] = useState('')
  const [outputs, setOutputs] = useState<Record<string, string>>({})
  const [workflow, setWorkflow] = useState<Record<string, { details: string; quality: string }>>({})
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reset all input state when the round changes
  useEffect(() => {
    setResponse('')
    setOutputs({})
    setWorkflow({})
  }, [round.round_number])

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [])

  const handleChange = (value: string) => {
    setResponse(value)

    // Signal to parent whether we have content
    window.dispatchEvent(
      new CustomEvent('round-content-change', {
        detail: { round_number: round.round_number, hasContent: value.trim().length > 0 }
      })
    )

    // Debounce auto-save: wait 800ms after last keystroke
    if (saveTimer.current) clearTimeout(saveTimer.current)
    if (value.length > 0 && session) {
      saveTimer.current = setTimeout(() => {
        fetch('/api/artifact/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: session.id,
            round_number: round.round_number,
            artifact_type: 'text_response',
            content: value,
            metadata: {
              draft: true,
              word_count: value.split(/\s+/).filter(Boolean).length
            }
          })
        }).catch(() => {})
      }, 800)
    }
  }

  const structuredContent = useMemo(() => {
    if (round.config?.outputs) {
      return JSON.stringify({ outputs })
    }
    if (round.config?.workflow_stages) {
      return JSON.stringify({ workflow })
    }
    return response
  }, [outputs, workflow, response, round.config?.outputs, round.config?.workflow_stages])

  const structuredSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (structuredSaveTimer.current) clearTimeout(structuredSaveTimer.current)
    }
  }, [])

  const saveStructured = (payload: Record<string, any>) => {
    if (!session) return
    if (structuredSaveTimer.current) clearTimeout(structuredSaveTimer.current)
    structuredSaveTimer.current = setTimeout(() => {
      fetch('/api/artifact/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.id,
          round_number: round.round_number,
          artifact_type: 'structured_response',
          content: JSON.stringify(payload),
          metadata: {
            draft: true,
            schema: payload.schema,
            word_count: structuredContent.split(/\s+/).filter(Boolean).length
        }
      })
    }).catch(() => {})
    }, 800)
  }

  // Auto-save on timer expiry: submit final (non-draft) artifact
  const responseRef = useRef(response)
  responseRef.current = response
  const structuredRef = useRef(structuredContent)
  structuredRef.current = structuredContent

  useEffect(() => {
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.round_number !== round.round_number || !session?.id) return
      const content = round.config?.outputs || round.config?.workflow_stages
        ? structuredRef.current
        : responseRef.current
      if (!content || content.length === 0) return
      await fetch('/api/artifact/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.id,
          round_number: round.round_number,
          artifact_type: round.config?.outputs || round.config?.workflow_stages
            ? 'structured_response'
            : 'text_response',
          content,
          metadata: { draft: false, auto_saved: true, word_count: content.split(/\s+/).filter(Boolean).length }
        })
      }).catch(() => {})
    }
    window.addEventListener('round-auto-save', handler)
    return () => window.removeEventListener('round-auto-save', handler)
  }, [round.round_number, round.config?.outputs, round.config?.workflow_stages, session?.id])

  if (!session) return null

  const wordCount = (round.config?.outputs || round.config?.workflow_stages)
    ? structuredContent.split(/\s+/).filter(Boolean).length
    : response.split(/\s+/).filter(Boolean).length
  const status = wordCount < 50 ? 'Needs more detail' : wordCount < 200 ? 'Good depth' : 'Comprehensive'

  return (
    <div className="space-y-4">
      {round.config?.outputs && (
        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
            Provide each section clearly. These will be scored separately.
          </div>
          {round.config.outputs.map((label: string) => (
            <div key={label} className="space-y-2">
              <label className="text-sm font-semibold">{label}</label>
              <Textarea
                rows={4}
                placeholder={`Enter ${label.toLowerCase()}...`}
                value={outputs[label] || ''}
                onChange={(e) => {
                  const next = { ...outputs, [label]: e.target.value }
                  setOutputs(next)
                  saveStructured({ schema: 'marketing_campaign', outputs: next })
                }}
              />
            </div>
          ))}
        </div>
      )}

      {round.config?.workflow_stages && (
        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
            Build the pipeline and include quality gates at each step.
          </div>
          {round.config.workflow_stages.map((stage: string) => (
            <div key={stage} className="rounded-lg border bg-muted/20 px-4 py-4 space-y-3">
              <div className="text-sm font-semibold">{stage}</div>
              <Textarea
                rows={3}
                placeholder={`Describe ${stage.toLowerCase()} step...`}
                value={workflow[stage]?.details || ''}
                onChange={(e) => {
                  const next = {
                    ...workflow,
                    [stage]: {
                      details: e.target.value,
                      quality: workflow[stage]?.quality || ''
                    }
                  }
                  setWorkflow(next)
                  saveStructured({ schema: 'marketing_workflow', workflow: next })
                }}
              />
              <Textarea
                rows={2}
                placeholder="Quality control / brand consistency checks..."
                value={workflow[stage]?.quality || ''}
                onChange={(e) => {
                  const next = {
                    ...workflow,
                    [stage]: {
                      details: workflow[stage]?.details || '',
                      quality: e.target.value
                    }
                  }
                  setWorkflow(next)
                  saveStructured({ schema: 'marketing_workflow', workflow: next })
                }}
              />
            </div>
          ))}
        </div>
      )}

      {!round.config?.outputs && !round.config?.workflow_stages && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Written Response</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              rows={14}
              placeholder="Write your response here..."
              value={response}
              onChange={(event) => handleChange(event.target.value)}
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Word count: {wordCount}</p>
              <Badge variant={wordCount < 50 ? 'outline' : 'secondary'}>{status}</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {(round.config?.outputs || round.config?.workflow_stages) && (
        <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
          <span className="text-xs text-muted-foreground">Word count: {wordCount}</span>
          <Badge variant={wordCount < 50 ? 'outline' : 'secondary'}>{status}</Badge>
        </div>
      )}

      {round.config?.optional && (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Optional round. Completing it strengthens evidence for follow-up rigor and ownership.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Deal status and context</li>
            <li>Key commitments made during the interview</li>
            <li>Risks and open questions</li>
            <li>Next steps with owners and timelines</li>
            <li>Cross-functional handoff dependencies</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
