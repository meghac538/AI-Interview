# Voice Persona CRUD & Real-Time Analytics System

**Date:** 2026-02-14
**Status:** Approved
**Author:** Claude Code

---

## Overview

This design covers two major systems for the AI Interview platform:

1. **Persona CRUD System** - Manage interview personas with blueprint tagging, difficulty levels, and dynamic ElevenLabs agent creation
2. **Real-Time Analytics Engine** - AI-powered transcript analysis with Say Meter, dynamic suggestions, curveballs, and follow-up questions

---

## Problem Statement

### Current State
- Voice interview feature exists with ElevenLabs integration
- Personas are hardcoded with only 5 difficulty levels
- No real-time analytics during calls
- Interviewers have limited visibility into call quality
- Curveballs are fixed/manual only

### Requirements
1. **Persona Management**: CRUD operations for personas tagged to blueprints (job tracks) and difficulty levels
2. **Interview Customization**: Interviewers select personas during interview creation
3. **Transcript Collection**: Save STT transcripts per session via API
4. **Real-Time Analysis**: AI-powered analysis using OpenAI to generate:
   - Say Meter (health score 0-100 with factor breakdown)
   - Context injection suggestions
   - Dynamic curveballs
   - Follow-up question recommendations
5. **New Supabase Migration**: Complete migrations for fresh Supabase instance

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────────┐
│                         INTERVIEW SESSION                            │
│  ┌────────────────┐         ┌────────────────┐                     │
│  │  Candidate     │◄───────►│  ElevenLabs    │                     │
│  │  (Browser)     │  Audio  │  Agent         │                     │
│  └────────────────┘         └────────────────┘                     │
│         │                           │                                │
│         │ Transcript Events         │                                │
│         ▼                           ▼                                │
│  ┌──────────────────────────────────────────────┐                  │
│  │     useVoiceRealtime Hook (Client)           │                  │
│  │  - Captures transcript in real-time          │                  │
│  │  - Publishes to live_events                  │                  │
│  │  - Sends to transcript API every message     │                  │
│  └──────────────────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    TRANSCRIPT COLLECTION API                         │
│  POST /api/voice/transcript                                          │
│  - Saves messages to voice_transcripts table                        │
│  - Returns acknowledgment                                            │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
                    [Every 10 new messages]
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    ANALYTICS ENGINE                                  │
│  POST /api/voice/analyze                                             │
│  - Fetch recent transcript window (last 20 messages)                │
│  - Call OpenAI GPT-4o with analysis prompt                          │
│  - Generate:                                                         │
│    • Say Meter Score (0-100)                                         │
│    • Factor breakdown (rapport, discovery, etc.)                     │
│    • Context injection suggestions                                   │
│    • Dynamic curveballs                                              │
│    • Follow-up questions                                             │
│  - Save results to voice_analysis table                              │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
                   [Real-time via Supabase]
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    INTERVIEWER GATEWAY PANEL                         │
│  - Subscribes to voice_analysis real-time updates                   │
│  - Displays Say Meter with color gradient                            │
│  - Shows AI suggestions (click to apply)                             │
│  - Injects context/curveballs to conversation                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### New Tables

#### personas (Enhanced)
```sql
CREATE TABLE IF NOT EXISTS personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  blueprint TEXT NOT NULL CHECK (blueprint IN ('sales', 'agentic_eng', 'fullstack', 'marketing', 'implementation', 'HR', 'security')),
  difficulty INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
  company_context TEXT NOT NULL,
  personality_traits TEXT[] NOT NULL DEFAULT '{}',
  communication_style TEXT NOT NULL,
  objection_patterns TEXT[] NOT NULL DEFAULT '{}',
  prompt_template TEXT NOT NULL, -- Full ElevenLabs prompt with placeholders
  first_message_template TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_personas_blueprint_difficulty
  ON personas(blueprint, difficulty)
  WHERE is_active = true;
```

**Key Fields:**
- `blueprint`: Links persona to job track (sales, agentic_eng, etc.)
- `difficulty`: 1-5 scale for persona challenge level
- `prompt_template`: Customizable prompt with placeholders like `{persona.name}`, `{scenario.description}`
- `is_active`: Soft delete support

#### voice_transcripts
```sql
CREATE TABLE IF NOT EXISTS voice_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL DEFAULT 1,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  text TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  word_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_voice_transcripts_session
  ON voice_transcripts(session_id, round_number, created_at DESC);
```

**Purpose:** Granular message-level transcript storage for analysis

#### voice_analysis
```sql
CREATE TABLE IF NOT EXISTS voice_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL DEFAULT 1,
  analysis_type TEXT NOT NULL CHECK (analysis_type IN ('say_meter', 'suggestion', 'curveball', 'followup')),

  -- Say Meter fields
  meter_score INTEGER CHECK (meter_score BETWEEN 0 AND 100),
  meter_factors JSONB DEFAULT '{}', -- {rapport: 80, discovery: 70, ...}

  -- Suggestion fields
  suggestion_text TEXT,
  suggestion_category TEXT,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'critical')),

  -- Metadata
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dismissed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_voice_analysis_session
  ON voice_analysis(session_id, analysis_type, triggered_at DESC);
```

**Design Decision:** Unified table for all analysis types (say_meter, suggestions, curveballs, followup questions)

### Schema Updates

```sql
-- interview_scope_packages
ALTER TABLE interview_scope_packages
  ADD COLUMN IF NOT EXISTS selected_persona_id UUID REFERENCES personas(id),
  ADD COLUMN IF NOT EXISTS selected_scenario_id UUID REFERENCES scenarios(id),
  ADD COLUMN IF NOT EXISTS voice_agent_id TEXT; -- Generated ElevenLabs agent ID

-- voice_commands
ALTER TABLE voice_commands
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual'
    CHECK (source IN ('manual', 'ai_suggested'));
```

---

## Persona CRUD System

### Dynamic Agent Creation Flow

**Approach:** Dynamic agent generation with smart caching (Approach 2.5)

**Rationale:**
- Persona updates apply immediately (no agent sync headaches)
- No stale agents with outdated prompts
- Simple CRUD - just update database
- Clean audit trail (updated_at timestamp)

**Flow:**
```
1. Interview starts with selected_persona_id
   ↓
2. Check if interview_scope_packages.voice_agent_id exists
   → YES: Reuse existing agent
   → NO: Generate new agent
   ↓
3. Fetch persona + scenario from database
   ↓
4. Render prompt_template with scenario data:
   - Replace {persona.name} → "Sarah Chen"
   - Replace {scenario.description} → "Q2 Cost Reduction Initiative..."
   - Replace {persona.personality_traits} → "analytical, budget-conscious..."
   ↓
5. Call ElevenLabs API:
   POST /v1/convai/agents/create
   Body: {
     name: "Sarah Chen (Session abc123)",
     conversation_config: {
       agent: {
         prompt: { prompt: renderedPrompt, llm: 'gpt-4o' },
         first_message: persona.first_message_template
       }
     }
   }
   ↓
6. Store agent_id in interview_scope_packages.voice_agent_id
   ↓
7. Return agent_id to client for connection
```

### API Routes

```typescript
// Persona CRUD
GET    /api/personas                 // List with filters (blueprint, difficulty, is_active)
GET    /api/personas/:id             // Get single persona
POST   /api/personas                 // Create new persona
PATCH  /api/personas/:id             // Update persona (sets updated_at)
DELETE /api/personas/:id             // Soft delete (is_active = false)

// Voice session
POST   /api/voice/elevenlabs-session // Create/get agent for interview

// Scenarios (optional)
GET    /api/scenarios                // List scenarios
POST   /api/scenarios                // Create scenario
```

### Prompt Template System

Personas store templates with placeholders:

```text
You are {persona.name}, a {persona.role} at {scenario.company_size} {scenario.industry} company.

Company Context: {persona.company_context}

Current Situation: {scenario.description}
Pain Points: {scenario.pain_points}
Budget: {scenario.budget_range}
Timeline: {scenario.decision_timeline}

Your Personality: {persona.personality_traits}
Communication Style: {persona.communication_style}

Objection Patterns to use during conversation:
{persona.objection_patterns}

Difficulty Level: {persona.difficulty}/5
{difficulty_instructions}
```

**Benefits:**
- ✅ Fully customizable per persona
- ✅ Scenario-aware (context injection at agent creation)
- ✅ Easy to update (just edit prompt_template in DB)

---

## Real-Time Analytics Engine

### Transcript Collection

**API:** `POST /api/voice/transcript`

**Flow:**
```typescript
1. useVoiceRealtime captures transcript event from ElevenLabs
   ↓
2. POST /api/voice/transcript
   Body: {
     session_id: string,
     round_number: number,
     role: 'user' | 'assistant',
     text: string,
     timestamp: ISO string
   }
   ↓
3. Save to voice_transcripts table
   ↓
4. Check message count: count % 10 === 0?
   → YES: Trigger POST /api/voice/analyze (async, non-blocking)
   → NO: Return success
```

**Design Decision:** Trigger analysis every 10 messages (balance between real-time feedback and API cost)

### Analytics Processing

**API:** `POST /api/voice/analyze`

**OpenAI Prompt:**
```typescript
const ANALYSIS_SYSTEM_PROMPT = `
You are an expert sales coach analyzing a live discovery call. Analyze the conversation and provide:

1. SAY METER SCORE (0-100):
   - 80-100 (Green): Excellent - strong rapport, great discovery, handling objections well
   - 50-79 (Yellow): Adequate - some issues but recoverable
   - 0-49 (Red): Poor - major red flags, losing the prospect

2. FACTOR BREAKDOWN (each 0-100):
   - rapport: Relationship building, active listening, empathy
   - discovery: Asking good questions, uncovering pain points
   - objection_handling: Addressing concerns effectively
   - value_articulation: Clearly communicating value proposition
   - closing_momentum: Moving toward next steps

3. CONTEXT INJECTION SUGGESTIONS:
   - Hints the AI prospect should receive to adjust behavior
   - Example: "Mention budget concerns" or "Show more interest in ROI"

4. DYNAMIC CURVEBALLS:
   - Unexpected challenges to inject based on conversation flow
   - Example: "CTO just emailed asking to delay decision"

5. FOLLOW-UP QUESTIONS:
   - Questions the candidate should ask next
   - Prioritized by importance

Return JSON format:
{
  "say_meter": {
    "score": 75,
    "factors": {
      "rapport": 80,
      "discovery": 70,
      "objection_handling": 60,
      "value_articulation": 75,
      "closing_momentum": 65
    },
    "reasoning": "Candidate is building good rapport but needs to dig deeper on pain points."
  },
  "suggestions": [
    {
      "type": "context_injection",
      "text": "Show more interest when candidate mentions cost savings",
      "priority": "medium"
    },
    {
      "type": "curveball",
      "text": "Prospect's boss just asked to see competitive quotes",
      "priority": "high",
      "label": "Competitive Pressure"
    },
    {
      "type": "followup_question",
      "text": "Ask: What does success look like 90 days after implementation?",
      "priority": "high"
    }
  ]
}
`
```

**Processing Flow:**
```typescript
1. Fetch last 20 messages from voice_transcripts
   ↓
2. Format as conversation string
   ↓
3. Call OpenAI GPT-4o:
   openai.chat.completions.create({
     model: 'gpt-4o',
     messages: [
       { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
       { role: 'user', content: `Analyze this call:\n\n${transcript}` }
     ],
     response_format: { type: 'json_object' }
   })
   ↓
4. Parse JSON response
   ↓
5. Save to voice_analysis table:
   - INSERT say_meter record (meter_score, meter_factors)
   - INSERT suggestion records (one per suggestion)
   ↓
6. Supabase real-time propagates to interviewer UI
```

### Real-Time UI Components

#### Say Meter
```typescript
// components/voice/SayMeter.tsx
- Horizontal bar with gradient (red → yellow → green)
- Score display: 75/100
- Factor breakdown with mini-bars:
  - Rapport: 80
  - Discovery: 70
  - Objection Handling: 60
  - Value Articulation: 75
  - Closing Momentum: 65
```

**Color Mapping:**
- 80-100: Green (`bg-green-500`)
- 50-79: Yellow (`bg-yellow-500`)
- 0-49: Red (`bg-red-500`)

#### Suggestions Panel
```typescript
// components/voice/SuggestionsPanel.tsx
- List of suggestion cards
- Priority-based border colors:
  - Critical: Red border
  - High: Orange border
  - Medium: Yellow border
  - Low: Blue border
- Each card shows:
  - Type badge (context injection / curveball / follow-up)
  - Suggestion text
  - "Apply" button (for context/curveball)
  - "Dismiss" button
```

**Apply Action:**
```typescript
const applyContextInjection = async (suggestion) => {
  await supabase.from('voice_commands').insert({
    session_id: sessionId,
    command_type: 'difficulty_change', // Reused for context injection
    payload: { context_injection: suggestion.text },
    source: 'ai_suggested'
  })
}

const applyCurveball = async (suggestion) => {
  await supabase.from('voice_commands').insert({
    session_id: sessionId,
    command_type: 'curveball_inject',
    payload: {
      curveball: suggestion.text,
      label: 'AI Suggested Curveball'
    },
    source: 'ai_suggested'
  })
}
```

#### Real-Time Hook
```typescript
// hooks/useVoiceAnalysis.ts
- Subscribes to voice_analysis table (INSERT events)
- Filters by session_id
- Updates state for:
  - sayMeter: { score, factors }
  - suggestions: Array<Suggestion>
```

---

## Complete Data Flow

### Phase 1: Interview Setup
```
1. Interviewer creates interview
   ↓
2. Selects persona (filtered by blueprint + difficulty)
   ↓
3. Selects scenario
   ↓
4. System creates interview_session + interview_scope_package
   - Stores selected_persona_id
   - Stores selected_scenario_id
```

### Phase 2: Voice Round Start
```
1. Candidate clicks "Start Call"
   ↓
2. POST /api/voice/elevenlabs-session
   - Fetch persona + scenario from DB
   - Render prompt_template
   - Create ElevenLabs agent
   - Store agent_id
   - Return agent_id
   ↓
3. Client connects to ElevenLabs
   - Audio streaming starts
   - Transcript events flow
```

### Phase 3: Live Conversation
```
Every message:
1. useVoiceRealtime captures event
   ↓
2. POST /api/voice/transcript
   ↓
3. Publish to live_events

Every 10 messages:
4. POST /api/voice/analyze triggered
   - OpenAI analyzes transcript
   - Save to voice_analysis
   ↓
5. Supabase real-time updates interviewer UI
   - Say Meter refreshes
   - New suggestions appear
   ↓
6. Interviewer clicks "Apply" on suggestion
   - Insert to voice_commands
   - useVoiceRealtime detects command
   - Sends context injection to ElevenLabs
```

### Phase 4: Call End
```
1. Candidate/Interviewer ends call
   ↓
2. useVoiceRealtime.saveTranscript()
   - Save full transcript to artifacts
   - Trigger POST /api/score/trigger
   ↓
3. Round marked as completed
```

---

## Migration Plan

### Files to Create

1. **`supabase/migrations/01_voice_realtime.sql`**
   - Consolidate existing voice tables
   - Add blueprint/difficulty to personas
   - Add persona/scenario references to interview_scope_packages

2. **`supabase/migrations/02_voice_analytics.sql`** (NEW)
   - Create voice_transcripts table
   - Create voice_analysis table
   - Add source column to voice_commands

3. **Update `supabase/enable_realtime.sql`**
   - Add voice_transcripts to replication
   - Add voice_analysis to replication

4. **Update `supabase/seed/voice_personas_scenarios.sql`**
   - Add blueprint and difficulty columns
   - Add prompt_template and first_message_template fields

### Execution Order

```bash
# Fresh Supabase instance
psql $DATABASE_URL << EOF

# Step 1: Core schema
\i supabase/migrations/00_base_schema.sql

# Step 2: Voice feature tables
\i supabase/migrations/01_voice_realtime.sql

# Step 3: Analytics tables
\i supabase/migrations/02_voice_analytics.sql

# Step 4: Enable real-time
\i supabase/enable_realtime.sql

# Step 5: Seed data
\i supabase/seed/voice_personas_scenarios.sql

EOF
```

---

## Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenAI (for analytics)
OPENAI_API_KEY=sk-...

# ElevenLabs (for voice)
ELEVENLABS_API_KEY=sk_...
```

---

## API Routes Summary

```
Persona CRUD:
  GET    /api/personas                 List personas
  GET    /api/personas/:id             Get persona details
  POST   /api/personas                 Create persona
  PATCH  /api/personas/:id             Update persona
  DELETE /api/personas/:id             Soft delete

Voice Session:
  POST   /api/voice/elevenlabs-session Create agent & return ID

Transcript & Analysis:
  POST   /api/voice/transcript         Save transcript message
  POST   /api/voice/analyze            Trigger AI analysis

Scenarios (optional):
  GET    /api/scenarios                List scenarios
  POST   /api/scenarios                Create scenario
```

---

## Trade-offs & Decisions

### 1. Dynamic Agent Creation vs Pre-Created Agents
**Decision:** Dynamic creation with smart caching
**Rationale:**
- ✅ Persona updates apply instantly
- ✅ No agent ID management
- ✅ Each interview isolated
- ❌ 2-3 second delay on first start (acceptable during setup)

### 2. Analysis Trigger Frequency
**Decision:** Every 10 messages
**Rationale:**
- ✅ Balance between real-time feedback and API cost
- ✅ ~2-3 minutes of conversation per analysis (good cadence)
- ❌ Not truly real-time (acceptable trade-off)

### 3. Unified voice_analysis Table vs Separate Tables
**Decision:** Single table with analysis_type column
**Rationale:**
- ✅ Simpler schema
- ✅ Easier real-time subscription (one channel)
- ✅ Uniform timestamp ordering
- ❌ Some columns nullable based on type (acceptable)

### 4. Transcript Storage: Message-Level vs Session-Level
**Decision:** Message-level (voice_transcripts table)
**Rationale:**
- ✅ Enables windowed analysis (last N messages)
- ✅ Better for real-time streaming
- ✅ Easier to query specific turns
- ❌ More rows (not a concern at scale)

---

## Success Metrics

1. **Persona Management**
   - Interviewers can create/edit personas in <30 seconds
   - Interview starts successfully with selected persona 99%+ of time

2. **Analytics Performance**
   - Analysis completes within 5 seconds of trigger
   - Say Meter updates visible to interviewer within 10 seconds of analysis

3. **Suggestion Quality**
   - 70%+ of AI suggestions rated "helpful" by interviewers
   - 50%+ of suggestions applied during interviews

4. **System Reliability**
   - 99%+ transcript capture rate (no missed messages)
   - Real-time updates propagate within 2 seconds

---

## Future Enhancements

1. **Agent Cleanup**
   - Periodic job to delete ephemeral ElevenLabs agents after interview completion

2. **Analysis Customization**
   - Track-specific rubrics (sales vs engineering vs marketing)
   - Customizable factor weights per job profile

3. **Advanced Say Meter**
   - Historical trend graph (score over time)
   - Predictive alerts ("candidate is losing prospect - intervene?")

4. **Suggestion Feedback Loop**
   - Track which suggestions are applied
   - Improve OpenAI prompt based on success patterns

5. **Multi-Language Support**
   - Persona templates in multiple languages
   - Language-aware analysis

---

## Implementation Plan

See separate implementation plan document for detailed task breakdown and sequencing.
