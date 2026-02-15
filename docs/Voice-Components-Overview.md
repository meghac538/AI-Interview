# Voice Components Overview

This document provides a quick reference for the voice interview components and their integration.

## Component Structure

### 1. SayMeter (`src/components/voice/SayMeter.tsx`)
Real-time performance meter showing overall score and dimensional factors.

**Features:**
- 0-100 score gauge with color coding
- 5 dimensional factors breakdown
- AI reasoning display
- Loading and empty states

### 2. SuggestionsPanel (`src/components/voice/SuggestionsPanel.tsx`)
AI coaching suggestions for interviewers during live calls.

**Features:**
- Priority-based suggestions (critical/high/medium/low)
- Category badges (Context/Curveball/Follow-up)
- Apply and dismiss actions
- Real-time updates
- Optimistic UI updates

## Data Flow

```
voice_analysis table
  ├── analysis_type = 'say_meter'
  │   └── meter_score, meter_factors, meter_reasoning
  └── analysis_type = 'suggestion'
      └── suggestion_text, suggestion_category, priority, dismissed
```

## Hook Integration

Both components use the `useVoiceAnalysis` hook:

```typescript
const {
  sayMeter,           // Latest Say Meter data
  suggestions,        // Active suggestions (non-dismissed)
  allSuggestions,     // All suggestions (including dismissed)
  loading,            // Loading state
  error,              // Error state
  dismissSuggestion   // Function to dismiss a suggestion
} = useVoiceAnalysis({
  sessionId: 'session-id',
  enabled: true
})
```

## Complete Dashboard Example

```typescript
'use client'

import { SayMeter } from '@/components/voice/SayMeter'
import { SuggestionsPanel } from '@/components/voice/SuggestionsPanel'
import { useVoiceAnalysis } from '@/hooks/useVoiceAnalysis'

export default function VoiceInterviewDashboard({
  sessionId
}: {
  sessionId: string
}) {
  const {
    sayMeter,
    suggestions,
    loading,
    dismissSuggestion
  } = useVoiceAnalysis({
    sessionId,
    enabled: true
  })

  const handleApplySuggestion = (suggestion) => {
    // Send to voice_commands table or integrate with AI
    console.log('Applying suggestion:', suggestion)
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">Live Interview Coaching</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Real-time Performance */}
        <div className="space-y-6">
          <SayMeter sayMeter={sayMeter} loading={loading} />
        </div>

        {/* Right: AI Coaching */}
        <div className="space-y-6">
          <SuggestionsPanel
            suggestions={suggestions}
            loading={loading}
            onDismiss={dismissSuggestion}
            onApply={handleApplySuggestion}
          />
        </div>
      </div>
    </div>
  )
}
```

## Real-time Updates

The `useVoiceAnalysis` hook automatically subscribes to:

1. **INSERT events** - New Say Meter scores or suggestions appear instantly
2. **UPDATE events** - Dismissal status propagates across all viewers
3. **Filtered results** - Only active (non-dismissed) suggestions shown by default

## Database Schema

Both components read from the `voice_analysis` table:

```sql
CREATE TABLE voice_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id),
  analysis_type TEXT NOT NULL, -- 'say_meter' or 'suggestion'

  -- Say Meter fields
  meter_score INTEGER,
  meter_factors JSONB,
  meter_reasoning TEXT,

  -- Suggestion fields
  suggestion_text TEXT,
  suggestion_category TEXT,
  priority TEXT,
  dismissed BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Styling

Both components use:
- **Tailwind CSS** for styling
- **Consistent color scheme** (blue for positive, red for critical, etc.)
- **Responsive design** (mobile-first)
- **Accessible markup** (semantic HTML, ARIA labels)

## Performance Considerations

- **Automatic cleanup** - Supabase subscriptions cleaned up on unmount
- **Optimistic updates** - Immediate UI feedback for user actions
- **Limited results** - Max 10 suggestions displayed at once
- **Efficient filtering** - Dismissed suggestions filtered client-side

## Future Enhancements

Potential improvements:
1. **Notification sounds** when critical suggestions arrive
2. **Suggestion history panel** showing dismissed items
3. **Export functionality** for post-interview analysis
4. **Custom filters** by category or priority
5. **Integration with voice commands** for direct injection
6. **Analytics dashboard** showing suggestion acceptance rates
