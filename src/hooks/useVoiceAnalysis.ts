import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

interface SayMeter {
  id: string
  score: number
  factors: {
    rapport: number
    discovery: number
    objection_handling: number
    value_articulation: number
    closing_momentum: number
  }
  meter_reasoning: string
  created_at: string
}

interface Suggestion {
  id: string
  text: string
  category: 'context_injection' | 'curveball' | 'followup_question'
  priority: 'low' | 'medium' | 'high' | 'critical'
  dismissed: boolean
  created_at: string
}

interface UseVoiceAnalysisConfig {
  sessionId: string
  enabled?: boolean
}

export function useVoiceAnalysis(config: UseVoiceAnalysisConfig) {
  const [sayMeter, setSayMeter] = useState<SayMeter | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch initial data
  useEffect(() => {
    if (!config.enabled || config.enabled === false) return

    const fetchInitialData = async () => {
      try {
        setLoading(true)

        // Fetch latest Say Meter
        const { data: meterData, error: meterError } = await supabase
          .from('voice_analysis')
          .select('*')
          .eq('session_id', config.sessionId)
          .eq('analysis_type', 'say_meter')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (meterError && meterError.code !== 'PGRST116') {
          // PGRST116 is "not found" - acceptable
          console.error('Failed to fetch Say Meter:', meterError)
          setError(meterError.message)
        } else if (meterData) {
          setSayMeter({
            id: meterData.id,
            score: meterData.meter_score,
            factors: meterData.meter_factors,
            meter_reasoning: meterData.meter_reasoning || '',
            created_at: meterData.created_at
          })
        }

        // Fetch suggestions
        const { data: suggestionsData, error: suggestionsError } = await supabase
          .from('voice_analysis')
          .select('*')
          .eq('session_id', config.sessionId)
          .eq('analysis_type', 'suggestion')
          .order('created_at', { ascending: false })
          .limit(10)

        if (suggestionsError) {
          console.error('Failed to fetch suggestions:', suggestionsError)
          setError(suggestionsError.message)
        } else if (suggestionsData) {
          setSuggestions(
            suggestionsData.map((s) => ({
              id: s.id,
              text: s.suggestion_text,
              category: s.suggestion_category,
              priority: s.priority,
              dismissed: s.dismissed || false,
              created_at: s.created_at
            }))
          )
        }
      } catch (err: any) {
        console.error('Error fetching initial analysis:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchInitialData()
  }, [config.sessionId, config.enabled])

  // Subscribe to real-time updates
  useEffect(() => {
    if (!config.enabled || config.enabled === false) return

    const channel = supabase
      .channel(`voice-analysis-${config.sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'voice_analysis',
          filter: `session_id=eq.${config.sessionId}`
        },
        (payload) => {
          const record = payload.new as any

          if (record.analysis_type === 'say_meter') {
            setSayMeter({
              id: record.id,
              score: record.meter_score,
              factors: record.meter_factors,
              meter_reasoning: record.meter_reasoning || '',
              created_at: record.created_at
            })
            console.log('📊 Say Meter updated:', record.meter_score)
          } else if (record.analysis_type === 'suggestion') {
            const newSuggestion: Suggestion = {
              id: record.id,
              text: record.suggestion_text,
              category: record.suggestion_category,
              priority: record.priority,
              dismissed: record.dismissed || false,
              created_at: record.created_at
            }
            setSuggestions((prev) => [newSuggestion, ...prev].slice(0, 10))
            console.log('💡 New suggestion:', newSuggestion.category)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'voice_analysis',
          filter: `session_id=eq.${config.sessionId}`
        },
        (payload) => {
          const record = payload.new as any

          // Handle suggestion dismissal
          if (record.analysis_type === 'suggestion') {
            setSuggestions((prev) =>
              prev.map((s) =>
                s.id === record.id ? { ...s, dismissed: record.dismissed } : s
              )
            )
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [config.sessionId, config.enabled])

  // Dismiss a suggestion
  const dismissSuggestion = async (suggestionId: string) => {
    try {
      const { error } = await supabase
        .from('voice_analysis')
        .update({ dismissed: true })
        .eq('id', suggestionId)

      if (error) {
        console.error('Failed to dismiss suggestion:', error)
        throw error
      }

      console.log('✅ Suggestion dismissed:', suggestionId)
    } catch (err: any) {
      console.error('Error dismissing suggestion:', err)
      throw err
    }
  }

  return {
    sayMeter,
    suggestions: suggestions.filter((s) => !s.dismissed), // Only return active suggestions
    allSuggestions: suggestions, // Include dismissed for history
    loading,
    error,
    dismissSuggestion
  }
}
