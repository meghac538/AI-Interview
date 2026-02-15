/**
 * Shared TypeScript types for voice interview components
 */

export interface Suggestion {
  id: string
  text: string
  category: 'context_injection' | 'curveball' | 'followup_question'
  priority: 'low' | 'medium' | 'high' | 'critical'
  dismissed: boolean
  created_at: string
}

export interface SayMeterFactors {
  rapport: number
  discovery: number
  objection_handling: number
  value_articulation: number
  closing_momentum: number
}

export interface SayMeter {
  id: string
  score: number
  factors: SayMeterFactors
  meter_reasoning: string
  created_at: string
}

export type SuggestionCategory = 'context_injection' | 'curveball' | 'followup_question'
export type SuggestionPriority = 'low' | 'medium' | 'high' | 'critical'
