# SuggestionsPanel Component - Usage Guide

## Overview

The `SuggestionsPanel` component displays AI-generated coaching suggestions for interviewers in real-time during voice interviews. It integrates with the `useVoiceAnalysis` hook to provide contextual guidance categorized by type and priority.

## Component Location

`/Users/shashankshandilya/Documents/oneorigin/pi-agentic-recruitment/AI-Interview-persona-interview/src/components/voice/SuggestionsPanel.tsx`

## Features

- **Real-time updates** via Supabase subscriptions
- **Priority indicators** (Critical, High, Medium, Low) with color-coded dots
- **Category badges** (Context Injection, Curveball, Follow-up Question)
- **Actionable buttons** (Apply, Dismiss)
- **Loading and empty states**
- **Optimistic updates** for dismissal actions

## API

### Props

```typescript
interface SuggestionsPanelProps {
  suggestions: Suggestion[]      // Array of active suggestions
  loading?: boolean               // Display loading skeleton
  onDismiss: (id: string) => Promise<void>  // Dismiss handler (required)
  onApply?: (suggestion: Suggestion) => void // Optional apply handler
}
```

### Suggestion Type

```typescript
interface Suggestion {
  id: string
  text: string
  category: 'context_injection' | 'curveball' | 'followup_question'
  priority: 'low' | 'medium' | 'high' | 'critical'
  dismissed: boolean
  created_at: string
}
```

## Usage Examples

### Basic Usage with useVoiceAnalysis Hook

```typescript
'use client'

import { SuggestionsPanel } from '@/components/voice/SuggestionsPanel'
import { useVoiceAnalysis } from '@/hooks/useVoiceAnalysis'

function InterviewerDashboard({ sessionId }: { sessionId: string }) {
  const { suggestions, loading, dismissSuggestion } = useVoiceAnalysis({
    sessionId,
    enabled: true
  })

  return (
    <div className="space-y-6">
      <SuggestionsPanel
        suggestions={suggestions}
        loading={loading}
        onDismiss={dismissSuggestion}
      />
    </div>
  )
}
```

### With Apply Handler

```typescript
'use client'

import { SuggestionsPanel } from '@/components/voice/SuggestionsPanel'
import { useVoiceAnalysis } from '@/hooks/useVoiceAnalysis'
import { useState } from 'react'

function InterviewerDashboard({ sessionId }: { sessionId: string }) {
  const { suggestions, loading, dismissSuggestion } = useVoiceAnalysis({
    sessionId,
    enabled: true
  })

  const [appliedSuggestions, setAppliedSuggestions] = useState<string[]>([])

  const handleApply = async (suggestion: Suggestion) => {
    // Send to voice_commands table or integrate with voice system
    try {
      const response = await fetch('/api/voice/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          command_type: suggestion.category,
          command_text: suggestion.text
        })
      })

      if (response.ok) {
        setAppliedSuggestions(prev => [...prev, suggestion.id])
        console.log('Suggestion applied:', suggestion)
      }
    } catch (error) {
      console.error('Failed to apply suggestion:', error)
    }
  }

  return (
    <div className="space-y-6">
      <SuggestionsPanel
        suggestions={suggestions}
        loading={loading}
        onDismiss={dismissSuggestion}
        onApply={handleApply}
      />

      {appliedSuggestions.length > 0 && (
        <div className="text-sm text-gray-600">
          Applied {appliedSuggestions.length} suggestion(s)
        </div>
      )}
    </div>
  )
}
```

### Side-by-Side with Say Meter

```typescript
'use client'

import { SuggestionsPanel } from '@/components/voice/SuggestionsPanel'
import { SayMeter } from '@/components/voice/SayMeter'
import { useVoiceAnalysis } from '@/hooks/useVoiceAnalysis'

function VoiceAnalysisDashboard({ sessionId }: { sessionId: string }) {
  const { sayMeter, suggestions, loading, dismissSuggestion } = useVoiceAnalysis({
    sessionId,
    enabled: true
  })

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left column: Say Meter */}
      <div>
        <SayMeter sayMeter={sayMeter} loading={loading} />
      </div>

      {/* Right column: Suggestions */}
      <div>
        <SuggestionsPanel
          suggestions={suggestions}
          loading={loading}
          onDismiss={dismissSuggestion}
        />
      </div>
    </div>
  )
}
```

## Visual Reference

### Priority Colors
- **Critical**: Red dot (`bg-red-500`)
- **High**: Orange dot (`bg-orange-500`)
- **Medium**: Yellow dot (`bg-yellow-500`)
- **Low**: Gray dot (`bg-gray-400`)

### Category Badges
- **Context Injection**: Blue badge (`bg-blue-100 text-blue-700`) - "Context"
- **Curveball**: Purple badge (`bg-purple-100 text-purple-700`) - "Curveball"
- **Follow-up Question**: Green badge (`bg-green-100 text-green-700`) - "Follow-up"

### States

#### Loading State
Shows 3 skeleton loaders with pulsing animation.

#### Empty State
Displays centered message:
- "No suggestions yet"
- "AI will provide coaching tips as the conversation progresses"

#### Active Suggestions
Each suggestion card includes:
- Priority dot (left edge)
- Category badge + priority label
- Suggestion text
- Apply button (if `onApply` prop provided)
- Dismiss button

## Integration with Database

Suggestions are stored in the `voice_analysis` table with:
- `analysis_type = 'suggestion'`
- `session_id` links to interview session
- `suggestion_text` contains the coaching tip
- `suggestion_category` defines the type
- `priority` indicates urgency
- `dismissed` boolean tracks user action

The `useVoiceAnalysis` hook automatically:
1. Fetches initial suggestions on mount
2. Subscribes to real-time INSERT events for new suggestions
3. Subscribes to UPDATE events for dismissal status
4. Filters out dismissed suggestions from the displayed list

## Error Handling

The component handles errors gracefully:
- Failed dismiss operations revert the optimistic update
- Errors are logged to console
- The component remains functional even if individual operations fail

## Performance Considerations

- Real-time subscriptions are automatically cleaned up on unmount
- Only active (non-dismissed) suggestions are displayed
- Maximum 10 suggestions shown at once (enforced by hook)
- Dismissed suggestions are filtered client-side for instant UI updates

## Testing Checklist

- [ ] Test with suggestions of all 4 priority levels
- [ ] Test with all 3 category types
- [ ] Verify dismiss functionality with network delay
- [ ] Test empty state display
- [ ] Test loading state display
- [ ] Verify apply callback is called with correct data
- [ ] Test real-time updates (add suggestion from database)
- [ ] Verify optimistic updates work correctly
- [ ] Test error handling for failed dismiss operations
- [ ] Check responsive layout on mobile devices
- [ ] Verify hover states on buttons
- [ ] Test accessibility (keyboard navigation, screen readers)
