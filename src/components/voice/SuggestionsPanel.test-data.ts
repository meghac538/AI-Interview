/**
 * Test data for SuggestionsPanel component
 * Use this for manual testing and development
 */

import type { Suggestion } from './types'

export const mockSuggestions: Suggestion[] = [
  {
    id: '1',
    text: 'The prospect mentioned budget concerns. Pivot to discussing ROI and value realization timeline to address their financial hesitation.',
    category: 'context_injection',
    priority: 'critical',
    dismissed: false,
    created_at: new Date().toISOString()
  },
  {
    id: '2',
    text: 'Ask: "What happens if you don\'t solve this problem in the next 6 months?" to create urgency and uncover pain points.',
    category: 'curveball',
    priority: 'high',
    dismissed: false,
    created_at: new Date().toISOString()
  },
  {
    id: '3',
    text: 'Follow up on their previous mention of Q2 deadlines. Ask: "How does your timeline for this project align with your Q2 goals?"',
    category: 'followup_question',
    priority: 'medium',
    dismissed: false,
    created_at: new Date().toISOString()
  },
  {
    id: '4',
    text: 'Great rapport building! Consider asking about their weekend plans to deepen the personal connection.',
    category: 'context_injection',
    priority: 'low',
    dismissed: false,
    created_at: new Date().toISOString()
  },
  {
    id: '5',
    text: 'They seem interested in the technical features. Ask: "Which of these capabilities would have the biggest impact on your team\'s workflow?"',
    category: 'followup_question',
    priority: 'high',
    dismissed: false,
    created_at: new Date().toISOString()
  }
]

export const mockEmptySuggestions: Suggestion[] = []

export const mockDismissedSuggestions: Suggestion[] = [
  {
    id: '6',
    text: 'This suggestion was dismissed',
    category: 'context_injection',
    priority: 'low',
    dismissed: true,
    created_at: new Date().toISOString()
  }
]

/**
 * Mock dismiss function for testing
 */
export const mockDismissSuggestion = async (id: string): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log('Dismissed suggestion:', id)
      resolve()
    }, 500) // Simulate network delay
  })
}

/**
 * Mock apply function for testing
 */
export const mockApplySuggestion = (suggestion: Suggestion): void => {
  console.log('Applied suggestion:', suggestion)
  // In real implementation, this would call an API endpoint
  // or trigger a voice command
}

/**
 * Usage example:
 *
 * import { SuggestionsPanel } from '@/components/voice/SuggestionsPanel'
 * import { mockSuggestions, mockDismissSuggestion, mockApplySuggestion } from './SuggestionsPanel.test-data'
 *
 * function TestPage() {
 *   return (
 *     <SuggestionsPanel
 *       suggestions={mockSuggestions}
 *       onDismiss={mockDismissSuggestion}
 *       onApply={mockApplySuggestion}
 *     />
 *   )
 * }
 */
