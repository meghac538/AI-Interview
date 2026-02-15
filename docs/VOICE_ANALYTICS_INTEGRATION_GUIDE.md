# Voice Analytics Integration Guide

> Complete end-to-end guide for integrating AI-powered voice analytics with real-time coaching suggestions into your interview platform.

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Database Setup](#database-setup)
4. [Backend Integration](#backend-integration)
5. [Frontend Integration](#frontend-integration)
6. [Testing Guide](#testing-guide)
7. [Troubleshooting](#troubleshooting)

---

## System Overview

The Voice Analytics system provides AI-powered real-time feedback during voice interviews:

- **Say Meter**: Performance score (0-100) with 5 factors (rapport, discovery, objection handling, value articulation, closing momentum)
- **AI Suggestions**: Contextual coaching tips (context injection, curveballs, follow-up questions)
- **Real-time Updates**: Supabase real-time subscriptions for instant UI updates
- **Automatic Analysis**: Triggered every 10 messages using OpenAI GPT-4o

### Key Components

| Component | Purpose | Location |
|-----------|---------|----------|
| **Database Migrations** | Schema for personas, transcripts, analysis | `supabase/migrations/` |
| **Persona CRUD APIs** | Manage AI personas | `src/app/api/personas/` |
| **ElevenLabs Session API** | Dynamic agent creation | `src/app/api/voice/elevenlabs-session/` |
| **Transcript Collection API** | Batch transcript storage | `src/app/api/voice/transcript/` |
| **Analytics Engine API** | AI-powered analysis | `src/app/api/voice/analyze/` |
| **useVoiceRealtime Hook** | Voice connection + batch sending | `src/hooks/useVoiceRealtime.ts` |
| **useVoiceAnalysis Hook** | Real-time analytics subscription | `src/hooks/useVoiceAnalysis.ts` |
| **SayMeter Component** | Performance visualization | `src/components/voice/SayMeter.tsx` |
| **SuggestionsPanel Component** | AI coaching display | `src/components/voice/SuggestionsPanel.tsx` |

---

## Architecture

### Data Flow

```
1. Voice Interview Starts
   └─> ElevenLabs agent created dynamically with latest persona

2. Conversation Happens
   └─> Messages collected in batches (10 messages)
   └─> Batches sent to /api/voice/transcript
   └─> Every 10 messages triggers /api/voice/analyze

3. AI Analysis
   └─> OpenAI GPT-4o analyzes last 20 messages
   └─> Generates Say Meter score + 5 factors
   └─> Generates 1-3 contextual suggestions
   └─> Saves to voice_analysis table

4. Real-time Updates
   └─> Supabase broadcasts INSERT events
   └─> useVoiceAnalysis hook receives updates
   └─> UI components re-render instantly
```

### Database Schema

```sql
-- Core persona system
personas (id, name, role, blueprint, difficulty, prompt_template, first_message_template)
scenarios (id, title, description, industry, company_size, pain_points, budget_range, decision_timeline)

-- Analytics data
voice_transcripts (id, session_id, round_number, role, text, timestamp, word_count)
voice_analysis (
  id,
  session_id,
  round_number,
  analysis_type, -- 'say_meter' or 'suggestion'

  -- Say Meter fields
  meter_score,
  meter_factors,
  meter_reasoning,

  -- Suggestion fields
  suggestion_text,
  suggestion_category,
  priority,
  dismissed
)
```

---

## Database Setup

### Step 1: Apply Migrations

Run these SQL files in order in Supabase SQL Editor:

**1. Voice Realtime Migration** (`supabase/migrations/01_voice_realtime.sql`)
```sql
-- Creates:
-- - personas table with blueprint & difficulty
-- - scenarios table
-- - interview_scope_packages columns (selected_persona_id, selected_scenario_id)
```

**2. Voice Analytics Migration** (`supabase/migrations/02_voice_analytics.sql`)
```sql
-- Creates:
-- - voice_transcripts table
-- - voice_analysis table
```

**3. Enable Real-time** (`supabase/enable_realtime.sql`)
```sql
-- Enables Supabase real-time for:
-- - voice_transcripts
-- - voice_analysis
```

### Step 2: Seed Data

Run the seed file to populate initial personas and scenarios:

```sql
-- Run: supabase/seed/voice_personas_scenarios.sql
```

This creates:
- 3 sales personas (Skeptical CFO, Overworked VP, Collaborative Product Leader)
- 3 sales scenarios (Cost Reduction, Rapid Growth, Digital Transformation)

### Step 3: Verify

Check that tables exist and real-time is enabled:

```sql
-- Verify tables
SELECT tablename FROM pg_tables WHERE schemaname = 'public'
AND tablename IN ('personas', 'scenarios', 'voice_transcripts', 'voice_analysis');

-- Verify real-time
SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
```

---

## Backend Integration

### 1. Persona Management

**List personas** (with optional filtering):
```typescript
// GET /api/personas
const response = await fetch('/api/personas')
const { personas } = await response.json()

// Filter by blueprint and difficulty
const response = await fetch('/api/personas?blueprint=sales&difficulty=3')
```

**Create persona**:
```typescript
// POST /api/personas
const response = await fetch('/api/personas', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Sarah Chen',
    role: 'CFO',
    blueprint: 'sales',
    difficulty: 4,
    company_context: 'Mid-market SaaS company...',
    personality_traits: ['analytical', 'budget-conscious'],
    communication_style: 'Direct and fact-focused...',
    objection_patterns: ['How does this actually save us money?'],
    prompt_template: 'You are {persona.name}...',
    first_message_template: 'Yeah, I got your meeting invite...'
  })
})
```

**Update persona**:
```typescript
// PATCH /api/personas/:id
const response = await fetch(`/api/personas/${personaId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    difficulty: 5,  // Make it harder
    prompt_template: '...' // Updated prompt
  })
})
```

**Delete persona** (soft delete):
```typescript
// DELETE /api/personas/:id
await fetch(`/api/personas/${personaId}`, { method: 'DELETE' })
```

### 2. Dynamic Agent Creation

**Create ElevenLabs agent** for a session:
```typescript
// POST /api/voice/elevenlabs-session
const response = await fetch('/api/voice/elevenlabs-session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    session_id: 'uuid-here',
    difficulty: 3  // Optional override
  })
})

const { agent_id, ws_url, persona, scenario } = await response.json()
```

This:
1. Fetches selected persona/scenario from database
2. Renders prompt templates with placeholders
3. Creates fresh ElevenLabs agent via API
4. Returns agent_id and WebSocket URL

### 3. Transcript Collection

**Send batch of messages**:
```typescript
// POST /api/voice/transcript
const response = await fetch('/api/voice/transcript', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    session_id: 'uuid-here',
    round_number: 1,
    messages: [
      { role: 'user', text: 'Hi, I wanted to...', timestamp: 1707900003000 },
      { role: 'assistant', text: 'Hello! Thanks for...', timestamp: 1707900000000 }
    ]
  })
})

const { success, count } = await response.json()
```

This automatically triggers AI analysis every 10 messages.

### 4. AI Analytics Engine

**Trigger analysis manually** (usually automatic):
```typescript
// POST /api/voice/analyze
const response = await fetch('/api/voice/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    session_id: 'uuid-here',
    round_number: 1
  })
})

const { success, say_meter, suggestions, analyzed_messages } = await response.json()
```

This:
1. Fetches last 20 transcript messages
2. Analyzes with GPT-4o (Say Meter + Suggestions)
3. Saves to voice_analysis table
4. Propagates via real-time to UI

---

## Frontend Integration

### 1. Voice Interview Component

```typescript
'use client'

import { useVoiceRealtime } from '@/hooks/useVoiceRealtime'
import { useVoiceAnalysis } from '@/hooks/useVoiceAnalysis'
import { SayMeter } from '@/components/voice/SayMeter'
import { SuggestionsPanel } from '@/components/voice/SuggestionsPanel'

export function VoiceInterviewDashboard({ sessionId }: { sessionId: string }) {
  // Voice connection + transcript batching
  const {
    isConnected,
    isConnecting,
    transcript,
    error: voiceError,
    connect,
    disconnect
  } = useVoiceRealtime({
    sessionId,
    personaId: 'persona-uuid',
    scenarioId: 'scenario-uuid',
    difficulty: 3
  })

  // Real-time analytics
  const {
    sayMeter,
    suggestions,
    loading: analyticsLoading,
    error: analyticsError,
    dismissSuggestion
  } = useVoiceAnalysis({
    sessionId,
    enabled: isConnected
  })

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Column: Voice Control */}
      <div className="lg:col-span-2">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Voice Interview</h2>

          {!isConnected && (
            <button
              onClick={connect}
              disabled={isConnecting}
              className="px-4 py-2 bg-blue-600 text-white rounded"
            >
              {isConnecting ? 'Connecting...' : 'Start Call'}
            </button>
          )}

          {isConnected && (
            <>
              <button
                onClick={disconnect}
                className="px-4 py-2 bg-red-600 text-white rounded"
              >
                End Call
              </button>

              {/* Live Transcript */}
              <div className="mt-4 max-h-96 overflow-y-auto">
                {transcript.map((item, i) => (
                  <div key={i} className="mb-2">
                    <span className="font-semibold">
                      {item.role === 'user' ? 'Candidate' : 'Prospect'}:
                    </span>{' '}
                    {item.text}
                  </div>
                ))}
              </div>
            </>
          )}

          {voiceError && (
            <div className="mt-4 p-4 bg-red-50 text-red-700 rounded">
              Error: {voiceError}
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Analytics */}
      <div className="space-y-6">
        {/* Say Meter */}
        {sayMeter && (
          <SayMeter
            score={sayMeter.score}
            factors={sayMeter.factors}
            summary={sayMeter.meter_reasoning}
            loading={analyticsLoading}
          />
        )}

        {/* AI Suggestions */}
        <SuggestionsPanel
          suggestions={suggestions}
          loading={analyticsLoading}
          onDismiss={dismissSuggestion}
          onApply={(suggestion) => {
            console.log('Applying suggestion:', suggestion)
            // Optionally send to voice_commands table
          }}
        />

        {analyticsError && (
          <div className="p-4 bg-red-50 text-red-700 rounded text-sm">
            Analytics error: {analyticsError}
          </div>
        )}
      </div>
    </div>
  )
}
```

### 2. Minimal Integration (Just Voice)

If you only need voice without analytics:

```typescript
'use client'

import { useVoiceRealtime } from '@/hooks/useVoiceRealtime'

export function MinimalVoiceUI({ sessionId }: { sessionId: string }) {
  const { isConnected, transcript, connect, disconnect } = useVoiceRealtime({
    sessionId,
    personaId: 'persona-uuid'
  })

  return (
    <div>
      {!isConnected ? (
        <button onClick={connect}>Start Call</button>
      ) : (
        <>
          <button onClick={disconnect}>End Call</button>
          <div>
            {transcript.map((item, i) => (
              <p key={i}><strong>{item.role}:</strong> {item.text}</p>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
```

### 3. Analytics-Only Integration

If you want to display analytics without starting a new voice call:

```typescript
'use client'

import { useVoiceAnalysis } from '@/hooks/useVoiceAnalysis'
import { SayMeter } from '@/components/voice/SayMeter'
import { SuggestionsPanel } from '@/components/voice/SuggestionsPanel'

export function AnalyticsDashboard({ sessionId }: { sessionId: string }) {
  const { sayMeter, suggestions, dismissSuggestion } = useVoiceAnalysis({
    sessionId,
    enabled: true  // Always subscribe
  })

  return (
    <div className="grid grid-cols-2 gap-6">
      {sayMeter && (
        <SayMeter
          score={sayMeter.score}
          factors={sayMeter.factors}
          summary={sayMeter.meter_reasoning}
        />
      )}

      <SuggestionsPanel
        suggestions={suggestions}
        onDismiss={dismissSuggestion}
      />
    </div>
  )
}
```

---

## Testing Guide

### End-to-End Test

1. **Setup**: Ensure migrations applied and seed data loaded

2. **Create Test Session**:
```bash
# Using test API or Supabase UI
INSERT INTO interview_sessions (id, candidate_id, job_profile_id, status)
VALUES ('test-session-123', 'candidate-id', 'job-id', 'live');

INSERT INTO interview_scope_packages (
  session_id,
  selected_persona_id,
  selected_scenario_id,
  round_plan
) VALUES (
  'test-session-123',
  (SELECT id FROM personas WHERE name = 'Marcus Rodriguez'),
  (SELECT id FROM scenarios WHERE title LIKE '%Rapid Growth%'),
  '[{
    "round_number": 1,
    "round_type": "voice-realtime",
    "title": "Sales Discovery Call",
    "status": "pending",
    "config": {}
  }]'::jsonb
);
```

3. **Test Voice Connection**:
```typescript
// In your component
const { connect } = useVoiceRealtime({
  sessionId: 'test-session-123',
  personaId: '<persona-id>',
  difficulty: 3
})

// Click "Start Call" button
// Verify: ElevenLabs agent created, microphone access granted
```

4. **Test Transcript Collection**:
```bash
# After 10+ messages, check database
SELECT COUNT(*) FROM voice_transcripts WHERE session_id = 'test-session-123';
# Should see messages

# Verify batching (check console logs)
# Should see: "📤 Sent 10 transcript messages to API"
```

5. **Test AI Analysis**:
```bash
# After 10 messages, analysis should trigger automatically
SELECT * FROM voice_analysis WHERE session_id = 'test-session-123';
# Should see say_meter and suggestion records

# Verify in UI
# - Say Meter gauge should show score
# - Suggestions panel should show coaching tips
```

6. **Test Real-time Updates**:
```bash
# Manually insert analysis to test real-time
INSERT INTO voice_analysis (
  session_id, analysis_type, meter_score, meter_factors
) VALUES (
  'test-session-123',
  'say_meter',
  75,
  '{"rapport": 80, "discovery": 70, "objection_handling": 75, "value_articulation": 72, "closing_momentum": 78}'
);

# Verify: UI updates instantly without refresh
```

7. **Test Suggestion Dismissal**:
```typescript
// Click "Dismiss" on a suggestion
// Verify:
// - Button shows "Dismissing..."
// - Suggestion disappears from UI
// - Database updated: dismissed = true
```

### Unit Testing Checklist

**Hooks:**
- [ ] useVoiceRealtime connects to ElevenLabs
- [ ] useVoiceRealtime batches messages (10 per batch)
- [ ] useVoiceRealtime sends batch every 30 seconds
- [ ] useVoiceRealtime sends remaining batch on disconnect
- [ ] useVoiceAnalysis fetches initial data
- [ ] useVoiceAnalysis subscribes to real-time
- [ ] useVoiceAnalysis filters dismissed suggestions

**Components:**
- [ ] SayMeter displays correct color for score range
- [ ] SayMeter shows loading state
- [ ] SayMeter shows empty state
- [ ] SuggestionsPanel displays priority indicators
- [ ] SuggestionsPanel displays category badges
- [ ] SuggestionsPanel calls onDismiss correctly

**APIs:**
- [ ] POST /api/personas creates persona
- [ ] PATCH /api/personas/:id updates persona
- [ ] DELETE /api/personas/:id soft deletes
- [ ] POST /api/voice/elevenlabs-session creates agent
- [ ] POST /api/voice/transcript saves messages
- [ ] POST /api/voice/analyze generates scores

---

## Troubleshooting

### Issue: "Column personas.is_active does not exist"

**Cause**: Migrations not applied to Supabase
**Fix**: Run migrations in order (see [Database Setup](#database-setup))

### Issue: No real-time updates

**Cause**: Real-time not enabled for voice_analysis table
**Fix**:
```sql
-- Run: supabase/enable_realtime.sql
ALTER PUBLICATION supabase_realtime ADD TABLE voice_analysis;
```

### Issue: Say Meter not updating

**Possible causes**:
1. **Not enough messages**: Analysis only triggers after 10 messages
   - Check transcript count: `SELECT COUNT(*) FROM voice_transcripts WHERE session_id = ?`
2. **Analysis failing**: Check API logs for errors
   - Verify OpenAI API key is set: `process.env.OPENAI_API_KEY`
3. **Real-time not connected**: Check browser console for WebSocket errors

### Issue: Suggestions not appearing

**Possible causes**:
1. **OpenAI returning empty array**: This is intentional - only suggests when needed
   - Check voice_analysis table: `SELECT * FROM voice_analysis WHERE analysis_type = 'suggestion'`
2. **All suggestions dismissed**: Check `dismissed` flag
   - Query: `SELECT * FROM voice_analysis WHERE dismissed = false`

### Issue: Transcript batches not sending

**Possible causes**:
1. **Batch size not reached**: Need 10 messages or 30 seconds
   - Check console logs for "📤 Sent X transcript messages"
2. **API error**: Check Network tab for failed requests
3. **Hook not connected**: Verify `isConnected = true`

### Issue: "Agent creation failed"

**Possible causes**:
1. **Missing persona**: Check selected_persona_id exists in database
2. **Invalid prompt template**: Check for syntax errors in template
3. **ElevenLabs API error**: Check API key and quota
   - Verify: `process.env.ELEVENLABS_API_KEY`

### Issue: Memory leak / multiple subscriptions

**Cause**: Real-time channels not cleaned up
**Fix**: Ensure hooks are unmounted properly
```typescript
// Channels are auto-cleaned in useEffect cleanup
useEffect(() => {
  const channel = supabase.channel(...)
  return () => supabase.removeChannel(channel)
}, [])
```

---

## Performance Optimization

### 1. Batch Size Tuning

Default: 10 messages per batch, 30-second interval

To adjust:
```typescript
// In useVoiceRealtime.ts
const BATCH_SIZE = 15  // Send every 15 messages
const BATCH_INTERVAL = 20000  // Send every 20 seconds
```

### 2. Analysis Window

Default: Last 20 messages analyzed

To adjust:
```typescript
// In /api/voice/analyze/route.ts (line 28)
.limit(30)  // Analyze last 30 messages
```

### 3. Suggestion Limit

Default: 10 most recent suggestions

To adjust:
```typescript
// In useVoiceAnalysis.ts (line 77)
.limit(20)  // Show 20 suggestions
```

### 4. Real-time Throttling

If real-time updates are too frequent, add debouncing:
```typescript
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

const { sayMeter } = useVoiceAnalysis({ sessionId })
const debouncedMeter = useDebouncedValue(sayMeter, 500)  // 500ms delay
```

---

## Production Checklist

Before deploying to production:

**Database:**
- [ ] All migrations applied
- [ ] Real-time enabled for voice_analysis
- [ ] Seed data loaded (or personas created)
- [ ] Row-level security policies configured (if needed)

**Environment Variables:**
- [ ] `OPENAI_API_KEY` set
- [ ] `ELEVENLABS_API_KEY` set
- [ ] `NEXT_PUBLIC_SUPABASE_URL` set
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` set
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set (server-side only)

**API Endpoints:**
- [ ] All endpoints return proper error messages
- [ ] Rate limiting configured (if applicable)
- [ ] Logging set up for debugging

**Frontend:**
- [ ] Error boundaries around voice components
- [ ] Loading states for all async operations
- [ ] User feedback for all actions (dismissal, etc.)
- [ ] Microphone permissions handled gracefully

**Testing:**
- [ ] End-to-end test passed
- [ ] Real-time updates verified
- [ ] Batch transcript collection tested
- [ ] AI analysis generation tested
- [ ] Suggestion dismissal tested

**Monitoring:**
- [ ] OpenAI API usage tracking
- [ ] ElevenLabs API usage tracking
- [ ] Supabase real-time connection monitoring
- [ ] Error logging (Sentry, LogRocket, etc.)

---

## Support & Resources

**Documentation:**
- [Voice Components Overview](./Voice-Components-Overview.md)
- [SuggestionsPanel Usage](./SuggestionsPanel-Usage.md)
- [Implementation Plan](./plans/2026-02-14-voice-persona-analytics-implementation.md)
- [Design Document](./plans/2026-02-14-voice-persona-analytics-design.md)

**API Reference:**
- Supabase Realtime: https://supabase.com/docs/guides/realtime
- ElevenLabs API: https://docs.elevenlabs.io
- OpenAI GPT-4o: https://platform.openai.com/docs

**Source Code:**
- Database migrations: `supabase/migrations/`
- API routes: `src/app/api/`
- React hooks: `src/hooks/`
- Components: `src/components/voice/`

---

**Last Updated**: 2026-02-15
**Version**: 1.0.0
**Status**: Production Ready
