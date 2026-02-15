'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, CheckCircle, Info } from 'lucide-react'

interface AIAssessment {
  id: string
  session_id: string
  round_number: number
  timestamp: string
  observation: string
  dimension: string
  severity: 'info' | 'concern' | 'red_flag'
  created_at: string
}

export function AIAssessmentsPanel({ sessionId }: { sessionId: string }) {
  const [assessments, setAssessments] = useState<AIAssessment[]>([])
  const [loading, setLoading] = useState(true)

  // Load existing assessments
  useEffect(() => {
    async function loadAssessments() {
      const { data } = await supabase
        .from('ai_assessments')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })

      if (data) {
        setAssessments(data as AIAssessment[])
      }
      setLoading(false)
    }

    loadAssessments()
  }, [sessionId])

  // Subscribe to new assessments
  useEffect(() => {
    const channel = supabase
      .channel(`ai-assessments-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ai_assessments',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => {
          const newAssessment = payload.new as AIAssessment
          setAssessments(prev => [newAssessment, ...prev])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId])

  const getSeverityConfig = (severity: string) => {
    switch (severity) {
      case 'red_flag':
        return {
          icon: AlertCircle,
          color: 'text-signal-700',
          bg: 'bg-signal-50',
          border: 'border-signal-200',
          badge: 'signal'
        }
      case 'concern':
        return {
          icon: Info,
          color: 'text-caution-700',
          bg: 'bg-caution-50',
          border: 'border-caution-200',
          badge: 'caution'
        }
      default: // info
        return {
          icon: CheckCircle,
          color: 'text-emerald-700',
          bg: 'bg-emerald-50',
          border: 'border-emerald-200',
          badge: 'emerald'
        }
    }
  }

  const groupedAssessments = assessments.reduce((acc, assessment) => {
    const dimension = assessment.dimension
    if (!acc[dimension]) acc[dimension] = []
    acc[dimension].push(assessment)
    return acc
  }, {} as Record<string, AIAssessment[]>)

  return (
    <Card className="bg-white/90">
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">AI Observations</h3>
          <Badge tone="sky">Live</Badge>
        </div>
        <p className="text-xs text-ink-500">
          Real-time performance analysis
        </p>
      </CardHeader>
      <CardContent className="max-h-96 space-y-3 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-8 text-sm text-ink-500">
            Loading assessments...
          </div>
        )}

        {!loading && assessments.length === 0 && (
          <div className="rounded-2xl bg-ink-50 px-4 py-8 text-center text-sm text-ink-500">
            AI observations will appear here during the call
          </div>
        )}

        {Object.entries(groupedAssessments).map(([dimension, items]) => (
          <div key={dimension} className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-600">
              {dimension.replace(/_/g, ' ')}
            </h4>
            {items.slice(0, 3).map((assessment) => {
              const config = getSeverityConfig(assessment.severity)
              const Icon = config.icon

              return (
                <div
                  key={assessment.id}
                  className={`flex gap-3 rounded-lg border ${config.border} ${config.bg} px-3 py-2`}
                >
                  <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${config.color}`} />
                  <div className="flex-1">
                    <p className="text-sm text-ink-800">{assessment.observation}</p>
                    <p className="mt-1 text-xs text-ink-500">
                      {new Date(assessment.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        ))}

        {/* Summary Stats */}
        {assessments.length > 0 && (
          <div className="mt-4 flex gap-2 border-t border-ink-100 pt-3">
            <Badge tone="signal">
              {assessments.filter(a => a.severity === 'info').length} Positive
            </Badge>
            <Badge tone="sky">
              {assessments.filter(a => a.severity === 'concern').length} Concerns
            </Badge>
            <Badge tone="signal">
              {assessments.filter(a => a.severity === 'red_flag').length} Red Flags
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
