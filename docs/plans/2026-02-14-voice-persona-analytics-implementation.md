# Voice Persona CRUD & Real-Time Analytics Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement persona CRUD with dynamic ElevenLabs agents and real-time analytics engine with Say Meter, AI suggestions, and dynamic curveballs.

**Architecture:** Dynamic agent creation using persona templates, message-level transcript collection, OpenAI-powered analysis every 10 messages, real-time updates via Supabase subscriptions.

**Tech Stack:** Next.js 15, Supabase, ElevenLabs SDK, OpenAI GPT-4o, TypeScript

---

## Phase 1: Database Migrations

### Task 1: Create Consolidated Voice Realtime Migration

**Files:**
- Create: `supabase/migrations/01_voice_realtime.sql`

**Step 1: Create migration file**

```sql
-- Voice Realtime Feature - Consolidated Migration
-- Created: 2026-02-14

-- ============================================
-- PERSONAS - Enhanced with blueprint tagging
-- ============================================

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
  prompt_template TEXT NOT NULL,
  first_message_template TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SCENARIOS
-- ============================================

CREATE TABLE IF NOT EXISTS scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  industry TEXT NOT NULL,
  company_size TEXT NOT NULL,
  pain_points TEXT[] NOT NULL DEFAULT '{}',
  budget_range TEXT NOT NULL,
  decision_timeline TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- VOICE COMMANDS
-- ============================================

CREATE TABLE IF NOT EXISTS voice_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  command_type TEXT NOT NULL CHECK (command_type IN ('difficulty_change', 'curveball_inject')),
  payload JSONB NOT NULL DEFAULT '{}',
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'ai_suggested')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AI ASSESSMENTS
-- ============================================

CREATE TABLE IF NOT EXISTS ai_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  observation TEXT NOT NULL,
  dimension TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'concern', 'red_flag')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- UPDATE EXISTING TABLES
-- ============================================

-- Add persona/scenario references to interview_scope_packages
ALTER TABLE interview_scope_packages
  ADD COLUMN IF NOT EXISTS selected_persona_id UUID REFERENCES personas(id),
  ADD COLUMN IF NOT EXISTS selected_scenario_id UUID REFERENCES scenarios(id),
  ADD COLUMN IF NOT EXISTS voice_agent_id TEXT;

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_personas_blueprint_difficulty
  ON personas(blueprint, difficulty)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_voice_commands_session
  ON voice_commands(session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_assessments_session
  ON ai_assessments(session_id, round_number, created_at DESC);
```

**Step 2: Test migration (dry run)**

```bash
# Connect to local Supabase
psql $DATABASE_URL -f supabase/migrations/01_voice_realtime.sql --dry-run
```

Expected: No syntax errors

**Step 3: Commit**

```bash
git add supabase/migrations/01_voice_realtime.sql
git commit -m "feat(db): add consolidated voice realtime migration

- Personas with blueprint and difficulty
- Scenarios table
- Voice commands with source tracking
- AI assessments
- Update interview_scope_packages with persona/scenario refs

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 2: Create Voice Analytics Migration

**Files:**
- Create: `supabase/migrations/02_voice_analytics.sql`

**Step 1: Create migration file**

```sql
-- Voice Analytics Feature
-- Created: 2026-02-14

-- ============================================
-- TRANSCRIPT STORAGE
-- ============================================

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

-- ============================================
-- ANALYSIS RESULTS
-- ============================================

CREATE TABLE IF NOT EXISTS voice_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL DEFAULT 1,
  analysis_type TEXT NOT NULL CHECK (analysis_type IN ('say_meter', 'suggestion')),

  -- Say Meter fields
  meter_score INTEGER CHECK (meter_score BETWEEN 0 AND 100),
  meter_factors JSONB DEFAULT '{}',
  meter_reasoning TEXT,

  -- Suggestion fields
  suggestion_text TEXT,
  suggestion_category TEXT CHECK (suggestion_category IN ('context_injection', 'curveball', 'followup_question')),
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'critical')),

  -- Metadata
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dismissed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_voice_transcripts_session
  ON voice_transcripts(session_id, round_number, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_voice_analysis_session
  ON voice_analysis(session_id, analysis_type, triggered_at DESC);

CREATE INDEX IF NOT EXISTS idx_voice_analysis_undismissed
  ON voice_analysis(session_id, dismissed)
  WHERE dismissed = false;
```

**Step 2: Commit**

```bash
git add supabase/migrations/02_voice_analytics.sql
git commit -m "feat(db): add voice analytics migration

- Voice transcripts table (message-level)
- Voice analysis table (say meter + suggestions)
- Indexes for performance

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 3: Update Real-Time Configuration

**Files:**
- Modify: `supabase/enable_realtime.sql`

**Step 1: Update real-time script**

```sql
-- Enable Supabase Realtime for all required tables
-- Run this in Supabase SQL Editor

-- CRITICAL: This must be done for real-time updates to work!

-- 1. Existing tables
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS interview_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS interview_scope_packages;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS live_events;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS scores;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS ai_assessments;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS artifacts;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS voice_commands;

-- 2. NEW: Analytics tables
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS voice_transcripts;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS voice_analysis;

-- Verify replication is enabled
SELECT
  schemaname,
  tablename,
  CASE
    WHEN tablename = ANY(
      SELECT tablename
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
    ) THEN 'ENABLED ✅'
    ELSE 'DISABLED ❌'
  END as realtime_status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'interview_sessions',
    'interview_scope_packages',
    'live_events',
    'scores',
    'ai_assessments',
    'artifacts',
    'voice_commands',
    'voice_transcripts',
    'voice_analysis'
  )
ORDER BY tablename;
```

**Step 2: Commit**

```bash
git add supabase/enable_realtime.sql
git commit -m "feat(db): enable real-time for analytics tables

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 4: Update Seed Data

**Files:**
- Modify: `supabase/seed/voice_personas_scenarios.sql`

**Step 1: Update personas with new fields**

```sql
-- Voice Realtime Feature - Enhanced Seed Data
-- Created: 2026-02-14

-- ============================================
-- PERSONAS - with blueprint and prompt templates
-- ============================================

-- Persona 1: Skeptical CFO (Sales track, difficulty 4)
INSERT INTO personas (
  name, role, blueprint, difficulty,
  company_context, personality_traits, communication_style, objection_patterns,
  prompt_template, first_message_template
)
VALUES (
  'Sarah Chen',
  'CFO',
  'sales',
  4,
  'Mid-market SaaS company (500 employees, $50M ARR) evaluating new vendor solutions',
  ARRAY['analytical', 'budget-conscious', 'risk-averse', 'data-driven'],
  'Direct and fact-focused. Asks pointed questions about ROI, implementation costs, and contract terms. Skeptical of marketing claims.',
  ARRAY[
    'How does this actually save us money?',
    'What is the total cost of ownership including implementation?',
    'We already have a solution that works fine',
    'Your pricing seems high compared to competitors',
    'What happens if we need to cancel early?'
  ],
  'You are {persona.name}, a {persona.role} at a {scenario.company_size} {scenario.industry} company.

Company Context: {persona.company_context}

Current Situation: {scenario.description}
Pain Points: {scenario.pain_points}
Budget: {scenario.budget_range}
Timeline: {scenario.decision_timeline}

Your Personality: {persona.personality_traits}
You are {persona.communication_style}

During this discovery call, naturally work in these objections:
{persona.objection_patterns}

Difficulty Level: {persona.difficulty}/5 - Be highly skeptical and push back on most claims. Demand proof for every statement.',
  'Yeah, I got your meeting invite. I''m pretty skeptical this is worth my time, but I''ll give you 15 minutes. What''s this about?'
);

-- Persona 2: Overworked VP of Sales (Sales track, difficulty 3)
INSERT INTO personas (
  name, role, blueprint, difficulty,
  company_context, personality_traits, communication_style, objection_patterns,
  prompt_template, first_message_template
)
VALUES (
  'Marcus Rodriguez',
  'VP of Sales',
  'sales',
  3,
  'Fast-growing startup (120 employees) struggling with sales team productivity and pipeline visibility',
  ARRAY['busy', 'results-oriented', 'impatient', 'decisive'],
  'Talks quickly, cuts to the chase. Wants to know how this helps him hit quota faster. Often feels time-pressured.',
  ARRAY[
    'I only have 10 minutes, make this quick',
    'Will my reps actually use this or is it shelfware?',
    'How long until we see results?',
    'Our team is already overloaded with tools',
    'Can you just send me a one-pager?'
  ],
  'You are {persona.name}, a {persona.role} at a {scenario.company_size} {scenario.industry} company.

Company Context: {persona.company_context}

Current Situation: {scenario.description}
Pain Points: {scenario.pain_points}
Budget: {scenario.budget_range}
Timeline: {scenario.decision_timeline}

Your Personality: {persona.personality_traits}
You are {persona.communication_style}

During this discovery call, naturally mention these concerns:
{persona.objection_patterns}

Difficulty Level: {persona.difficulty}/5 - Be moderately skeptical with competing priorities. Need strong evidence of value.',
  'Hey, I''m pretty busy today so let''s make this efficient. What did you want to discuss?'
);

-- Persona 3: Collaborative Product Leader (Sales track, difficulty 2)
INSERT INTO personas (
  name, role, blueprint, difficulty,
  company_context, personality_traits, communication_style, objection_patterns,
  prompt_template, first_message_template
)
VALUES (
  'Priya Patel',
  'Head of Product',
  'sales',
  2,
  'Enterprise tech company (2000 employees) looking to improve developer experience and ship faster',
  ARRAY['collaborative', 'thoughtful', 'user-focused', 'process-oriented'],
  'Asks clarifying questions about user workflows and integration points. Wants to understand how this fits into their existing stack.',
  ARRAY[
    'How does this integrate with our current tools?',
    'What do your reference customers say about adoption?',
    'Can we do a proof-of-concept with one team first?',
    'What does the onboarding process look like?',
    'How customizable is this for our specific workflows?'
  ],
  'You are {persona.name}, a {persona.role} at a {scenario.company_size} {scenario.industry} company.

Company Context: {persona.company_context}

Current Situation: {scenario.description}
Pain Points: {scenario.pain_points}
Budget: {scenario.budget_range}
Timeline: {scenario.decision_timeline}

Your Personality: {persona.personality_traits}
You are {persona.communication_style}

During this discovery call, ask thoughtful questions like:
{persona.objection_patterns}

Difficulty Level: {persona.difficulty}/5 - Be interested but cautious. Ask good questions but be open to answers.',
  'Hi! Thanks for taking the time. I''m interested in learning more about what you offer.'
);

-- ============================================
-- SCENARIOS (unchanged)
-- ============================================

-- Scenario 1: Cost Optimization Initiative
INSERT INTO scenarios (title, description, industry, company_size, pain_points, budget_range, decision_timeline)
VALUES (
  'Q2 Cost Reduction Initiative',
  'Company mandate to reduce operational costs by 15% while maintaining service quality. Evaluating vendor consolidation and automation opportunities.',
  'Financial Services',
  '500-1000 employees',
  ARRAY[
    'Spreadsheet chaos - manual data entry errors costing $200K annually',
    'Teams using 14+ disconnected tools',
    'Finance team working weekends to close books',
    'No real-time visibility into spend'
  ],
  '$50K-$150K annual budget',
  'Decision needed by end of Q2 (8 weeks)'
);

-- Scenario 2: Scaling Pain Points
INSERT INTO scenarios (title, description, industry, company_size, pain_points, budget_range, decision_timeline)
VALUES (
  'Rapid Growth Scaling Challenge',
  'Startup that doubled headcount in 6 months now facing operational bottlenecks. Sales team missing quota due to inefficient processes.',
  'B2B SaaS',
  '100-200 employees',
  ARRAY[
    'Sales reps spending 60% of time on admin tasks',
    'Pipeline visibility is a black box',
    'Onboarding new reps takes 3+ months',
    'No standardized sales process'
  ],
  '$30K-$80K annual budget',
  'Urgent - VP Sales under pressure to hit Q3 targets'
);

-- Scenario 3: Digital Transformation Program
INSERT INTO scenarios (title, description, industry, company_size, pain_points, budget_range, decision_timeline)
VALUES (
  'Engineering Velocity Initiative',
  'Established enterprise modernizing legacy systems. Engineering leadership wants to reduce cycle time and improve developer experience.',
  'Technology/Software',
  '2000+ employees',
  ARRAY[
    'Average PR review time: 3+ days',
    'Deployment process requires 15 manual steps',
    'Developers context-switching between 8+ tools daily',
    'Tech debt slowing new feature development'
  ],
  '$100K-$300K annual budget',
  'Part of 2026 strategic roadmap - 12 week evaluation cycle'
);
```

**Step 2: Commit**

```bash
git add supabase/seed/voice_personas_scenarios.sql
git commit -m "feat(db): update seed data with prompt templates

- Add blueprint and difficulty to personas
- Add prompt_template and first_message_template
- Include placeholder system for dynamic agent creation

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 2: Persona CRUD APIs

### Task 5: List Personas API

**Files:**
- Create: `src/app/api/personas/route.ts`

**Step 1: Create API route**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const blueprint = searchParams.get('blueprint')
    const difficulty = searchParams.get('difficulty')
    const isActive = searchParams.get('is_active') !== 'false' // default true

    let query = supabaseAdmin
      .from('personas')
      .select('*')
      .eq('is_active', isActive)
      .order('name')

    if (blueprint) {
      query = query.eq('blueprint', blueprint)
    }

    if (difficulty) {
      query = query.eq('difficulty', parseInt(difficulty))
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching personas:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ personas: data })
  } catch (error: any) {
    console.error('List personas error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

**Step 2: Test API manually**

```bash
# Start dev server
npm run dev

# Test in another terminal
curl http://localhost:3000/api/personas
```

Expected: JSON response with personas array

**Step 3: Commit**

```bash
git add src/app/api/personas/route.ts
git commit -m "feat(api): add list personas endpoint

GET /api/personas
- Filters: blueprint, difficulty, is_active
- Returns array of personas

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 6: Get Single Persona API

**Files:**
- Create: `src/app/api/personas/[id]/route.ts`

**Step 1: Create API route**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { data, error } = await supabaseAdmin
      .from('personas')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error) {
      console.error('Error fetching persona:', error)
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json({ persona: data })
  } catch (error: any) {
    console.error('Get persona error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/personas/\[id\]/route.ts
git commit -m "feat(api): add get single persona endpoint

GET /api/personas/:id

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 7: Create Persona API

**Files:**
- Modify: `src/app/api/personas/route.ts` (add POST handler)

**Step 1: Add POST handler**

```typescript
// Add to existing src/app/api/personas/route.ts

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const {
      name,
      role,
      blueprint,
      difficulty,
      company_context,
      personality_traits,
      communication_style,
      objection_patterns,
      prompt_template,
      first_message_template
    } = body

    // Validation
    if (!name || !role || !blueprint || !difficulty) {
      return NextResponse.json(
        { error: 'Missing required fields: name, role, blueprint, difficulty' },
        { status: 400 }
      )
    }

    if (difficulty < 1 || difficulty > 5) {
      return NextResponse.json(
        { error: 'Difficulty must be between 1 and 5' },
        { status: 400 }
      )
    }

    const validBlueprints = ['sales', 'agentic_eng', 'fullstack', 'marketing', 'implementation', 'HR', 'security']
    if (!validBlueprints.includes(blueprint)) {
      return NextResponse.json(
        { error: `Invalid blueprint. Must be one of: ${validBlueprints.join(', ')}` },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('personas')
      .insert({
        name,
        role,
        blueprint,
        difficulty,
        company_context,
        personality_traits: personality_traits || [],
        communication_style,
        objection_patterns: objection_patterns || [],
        prompt_template,
        first_message_template,
        is_active: true
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating persona:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ persona: data }, { status: 201 })
  } catch (error: any) {
    console.error('Create persona error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/personas/route.ts
git commit -m "feat(api): add create persona endpoint

POST /api/personas
- Validates required fields
- Validates blueprint and difficulty
- Returns created persona

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 8: Update Persona API

**Files:**
- Modify: `src/app/api/personas/[id]/route.ts` (add PATCH handler)

**Step 1: Add PATCH handler**

```typescript
// Add to existing src/app/api/personas/[id]/route.ts

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()

    // Remove id and timestamps from update
    const { id, created_at, updated_at, ...updates } = body

    // Validate blueprint if provided
    if (updates.blueprint) {
      const validBlueprints = ['sales', 'agentic_eng', 'fullstack', 'marketing', 'implementation', 'HR', 'security']
      if (!validBlueprints.includes(updates.blueprint)) {
        return NextResponse.json(
          { error: `Invalid blueprint. Must be one of: ${validBlueprints.join(', ')}` },
          { status: 400 }
        )
      }
    }

    // Validate difficulty if provided
    if (updates.difficulty !== undefined) {
      if (updates.difficulty < 1 || updates.difficulty > 5) {
        return NextResponse.json(
          { error: 'Difficulty must be between 1 and 5' },
          { status: 400 }
        )
      }
    }

    // Update with new timestamp
    const { data, error } = await supabaseAdmin
      .from('personas')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating persona:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ persona: data })
  } catch (error: any) {
    console.error('Update persona error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/personas/\[id\]/route.ts
git commit -m "feat(api): add update persona endpoint

PATCH /api/personas/:id
- Partial updates supported
- Validates blueprint and difficulty
- Updates updated_at timestamp

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 9: Delete Persona API

**Files:**
- Modify: `src/app/api/personas/[id]/route.ts` (add DELETE handler)

**Step 1: Add DELETE handler**

```typescript
// Add to existing src/app/api/personas/[id]/route.ts

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Soft delete - set is_active to false
    const { data, error } = await supabaseAdmin
      .from('personas')
      .update({ is_active: false })
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      console.error('Error deleting persona:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Persona deactivated successfully',
      persona: data
    })
  } catch (error: any) {
    console.error('Delete persona error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/personas/\[id\]/route.ts
git commit -m "feat(api): add delete persona endpoint

DELETE /api/personas/:id
- Soft delete (sets is_active = false)
- Returns success message

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 3: Voice Session API (Enhanced)

### Task 10: Update ElevenLabs Session API with Dynamic Agents

**Files:**
- Modify: `src/app/api/voice/elevenlabs-session/route.ts`

**Step 1: Create prompt template renderer helper**

Create: `src/lib/ai/prompt-renderer.ts`

```typescript
interface TemplateContext {
  persona: any
  scenario: any
}

export function renderPromptTemplate(template: string, context: TemplateContext): string {
  let rendered = template

  // Replace persona placeholders
  rendered = rendered.replace(/{persona\.name}/g, context.persona.name)
  rendered = rendered.replace(/{persona\.role}/g, context.persona.role)
  rendered = rendered.replace(/{persona\.company_context}/g, context.persona.company_context)
  rendered = rendered.replace(/{persona\.communication_style}/g, context.persona.communication_style)
  rendered = rendered.replace(/{persona\.difficulty}/g, context.persona.difficulty.toString())

  // Format arrays
  rendered = rendered.replace(/{persona\.personality_traits}/g,
    Array.isArray(context.persona.personality_traits)
      ? context.persona.personality_traits.join(', ')
      : context.persona.personality_traits
  )

  rendered = rendered.replace(/{persona\.objection_patterns}/g,
    Array.isArray(context.persona.objection_patterns)
      ? context.persona.objection_patterns.map((p: string, i: number) => `${i + 1}. ${p}`).join('\n')
      : context.persona.objection_patterns
  )

  // Replace scenario placeholders
  if (context.scenario) {
    rendered = rendered.replace(/{scenario\.title}/g, context.scenario.title)
    rendered = rendered.replace(/{scenario\.description}/g, context.scenario.description)
    rendered = rendered.replace(/{scenario\.industry}/g, context.scenario.industry)
    rendered = rendered.replace(/{scenario\.company_size}/g, context.scenario.company_size)
    rendered = rendered.replace(/{scenario\.budget_range}/g, context.scenario.budget_range)
    rendered = rendered.replace(/{scenario\.decision_timeline}/g, context.scenario.decision_timeline)

    rendered = rendered.replace(/{scenario\.pain_points}/g,
      Array.isArray(context.scenario.pain_points)
        ? context.scenario.pain_points.map((p: string, i: number) => `- ${p}`).join('\n')
        : context.scenario.pain_points
    )
  }

  return rendered
}
```

**Step 2: Update elevenlabs-session route**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { renderPromptTemplate } from '@/lib/ai/prompt-renderer'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const { session_id, difficulty } = await request.json()

    // Get interview scope package with persona and scenario
    const { data: scopePackage, error: scopeError } = await supabaseAdmin
      .from('interview_scope_packages')
      .select(`
        *,
        personas:selected_persona_id (*),
        scenarios:selected_scenario_id (*)
      `)
      .eq('session_id', session_id)
      .single()

    if (scopeError || !scopePackage) {
      return NextResponse.json(
        { error: 'Interview scope package not found' },
        { status: 404 }
      )
    }

    // Check if agent already exists
    if (scopePackage.voice_agent_id) {
      return NextResponse.json({
        agent_id: scopePackage.voice_agent_id,
        cached: true
      })
    }

    const persona = scopePackage.personas
    const scenario = scopePackage.scenarios

    if (!persona) {
      return NextResponse.json(
        { error: 'No persona selected for this interview' },
        { status: 400 }
      )
    }

    // Render prompt template
    const renderedPrompt = renderPromptTemplate(persona.prompt_template, {
      persona,
      scenario: scenario || {}
    })

    const renderedFirstMessage = scenario
      ? renderPromptTemplate(persona.first_message_template, { persona, scenario })
      : persona.first_message_template

    // Create ElevenLabs agent
    const apiKey = process.env.ELEVENLABS_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ELEVENLABS_API_KEY not configured' },
        { status: 500 }
      )
    }

    const response = await fetch('https://api.elevenlabs.io/v1/convai/agents/create', {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: `${persona.name} (Session ${session_id.slice(0, 8)})`,
        conversation_config: {
          agent: {
            prompt: {
              prompt: renderedPrompt,
              llm: 'gpt-4o'
            },
            first_message: renderedFirstMessage,
            language: 'en'
          }
        }
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`ElevenLabs API error: ${error}`)
    }

    const agent = await response.json()

    // Store agent_id in scope package
    await supabaseAdmin
      .from('interview_scope_packages')
      .update({ voice_agent_id: agent.agent_id })
      .eq('id', scopePackage.id)

    console.log(`✅ Created ElevenLabs agent: ${agent.agent_id} for persona: ${persona.name}`)

    return NextResponse.json({
      agent_id: agent.agent_id,
      persona_name: persona.name,
      difficulty: persona.difficulty,
      cached: false
    })
  } catch (error: any) {
    console.error('ElevenLabs session error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

**Step 3: Commit**

```bash
git add src/lib/ai/prompt-renderer.ts src/app/api/voice/elevenlabs-session/route.ts
git commit -m "feat(voice): dynamic agent creation with persona templates

- Add prompt template renderer
- Fetch persona + scenario from database
- Render templates with context
- Create ElevenLabs agent on-demand
- Cache agent_id in interview_scope_packages

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 4: Analytics APIs

### Task 11: Transcript Collection API

**Files:**
- Create: `src/app/api/voice/transcript/route.ts`

**Step 1: Create API route**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const { session_id, round_number, role, text, timestamp } = await request.json()

    // Validation
    if (!session_id || !text || !role) {
      return NextResponse.json(
        { error: 'Missing required fields: session_id, role, text' },
        { status: 400 }
      )
    }

    if (!['user', 'assistant'].includes(role)) {
      return NextResponse.json(
        { error: 'Role must be "user" or "assistant"' },
        { status: 400 }
      )
    }

    // Calculate word count
    const wordCount = text.split(/\s+/).filter((w: string) => w.length > 0).length

    // Save to database
    const { data, error } = await supabaseAdmin
      .from('voice_transcripts')
      .insert({
        session_id,
        round_number: round_number || 1,
        role,
        text,
        timestamp: timestamp || new Date().toISOString(),
        word_count: wordCount
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving transcript:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Check if we should trigger analysis (every 10 messages)
    const { count } = await supabaseAdmin
      .from('voice_transcripts')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', session_id)
      .eq('round_number', round_number || 1)

    if (count && count % 10 === 0) {
      // Trigger analysis asynchronously (don't wait for response)
      fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/voice/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id, round_number: round_number || 1 })
      }).catch(err => console.error('Failed to trigger analysis:', err))
    }

    return NextResponse.json({
      success: true,
      id: data.id,
      message_count: count
    })
  } catch (error: any) {
    console.error('Transcript save error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/voice/transcript/route.ts
git commit -m "feat(analytics): add transcript collection API

POST /api/voice/transcript
- Saves message-level transcripts
- Calculates word count
- Triggers analysis every 10 messages

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 12: Analytics Engine API

**Files:**
- Create: `src/app/api/voice/analyze/route.ts`
- Create: `src/lib/ai/analysis-prompt.ts`

**Step 1: Create analysis prompt**

```typescript
// src/lib/ai/analysis-prompt.ts

export const ANALYSIS_SYSTEM_PROMPT = `You are an expert sales coach analyzing a live discovery call. Analyze the conversation and provide:

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

3. SUGGESTIONS (0-3 per analysis):
   Each suggestion should have:
   - type: "context_injection" | "curveball" | "followup_question"
   - text: Clear actionable suggestion
   - priority: "low" | "medium" | "high" | "critical"

   Types explained:
   - context_injection: Hints the AI prospect should receive to adjust behavior (e.g., "Show more interest in ROI", "Mention budget concerns")
   - curveball: Unexpected challenges to inject (e.g., "Boss just asked to see competitive quotes", "Budget was cut by 30%")
   - followup_question: Questions the candidate should ask (e.g., "Ask about their current process for X", "Dig deeper on pain point Y")

IMPORTANT: Return valid JSON only. No markdown, no code blocks.

Return format:
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
    "reasoning": "Brief explanation of score"
  },
  "suggestions": [
    {
      "type": "context_injection",
      "text": "Show more interest when candidate mentions cost savings",
      "priority": "medium"
    },
    {
      "type": "curveball",
      "text": "Your boss just emailed asking to see competitive quotes by end of day",
      "priority": "high"
    },
    {
      "type": "followup_question",
      "text": "Ask: What does success look like 90 days after implementation?",
      "priority": "high"
    }
  ]
}`
```

**Step 2: Create analysis API**

```typescript
// src/app/api/voice/analyze/route.ts

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { ANALYSIS_SYSTEM_PROMPT } from '@/lib/ai/analysis-prompt'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
})

export async function POST(request: Request) {
  try {
    const { session_id, round_number } = await request.json()

    if (!session_id) {
      return NextResponse.json(
        { error: 'session_id is required' },
        { status: 400 }
      )
    }

    // Fetch recent transcript (last 20 messages)
    const { data: messages, error: fetchError } = await supabaseAdmin
      .from('voice_transcripts')
      .select('*')
      .eq('session_id', session_id)
      .eq('round_number', round_number || 1)
      .order('created_at', { ascending: false })
      .limit(20)

    if (fetchError || !messages || messages.length === 0) {
      return NextResponse.json(
        { error: 'No transcript found for analysis' },
        { status: 404 }
      )
    }

    // Format transcript
    const transcript = messages
      .reverse()
      .map(m => `${m.role === 'user' ? 'Candidate' : 'AI Prospect'}: ${m.text}`)
      .join('\n\n')

    console.log(`🤖 Analyzing transcript for session ${session_id} (${messages.length} messages)`)

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: ANALYSIS_SYSTEM_PROMPT
        },
        {
          role: 'user',
          content: `Analyze this sales discovery call transcript:\n\n${transcript}`
        }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    })

    const analysisText = completion.choices[0].message.content
    if (!analysisText) {
      throw new Error('No analysis returned from OpenAI')
    }

    const analysis = JSON.parse(analysisText)

    // Save say meter to database
    const { error: meterError } = await supabaseAdmin
      .from('voice_analysis')
      .insert({
        session_id,
        round_number: round_number || 1,
        analysis_type: 'say_meter',
        meter_score: analysis.say_meter.score,
        meter_factors: analysis.say_meter.factors,
        meter_reasoning: analysis.say_meter.reasoning
      })

    if (meterError) {
      console.error('Error saving say meter:', meterError)
    }

    // Save suggestions to database
    if (analysis.suggestions && Array.isArray(analysis.suggestions)) {
      for (const suggestion of analysis.suggestions) {
        await supabaseAdmin
          .from('voice_analysis')
          .insert({
            session_id,
            round_number: round_number || 1,
            analysis_type: 'suggestion',
            suggestion_text: suggestion.text,
            suggestion_category: suggestion.type,
            priority: suggestion.priority
          })
      }
    }

    console.log(`✅ Analysis complete for session ${session_id}`)
    console.log(`   Say Meter: ${analysis.say_meter.score}/100`)
    console.log(`   Suggestions: ${analysis.suggestions?.length || 0}`)

    return NextResponse.json({
      success: true,
      analysis: {
        say_meter: analysis.say_meter,
        suggestions_count: analysis.suggestions?.length || 0
      }
    })
  } catch (error: any) {
    console.error('Analysis error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

**Step 3: Commit**

```bash
git add src/lib/ai/analysis-prompt.ts src/app/api/voice/analyze/route.ts
git commit -m "feat(analytics): add AI-powered analysis engine

POST /api/voice/analyze
- Fetches last 20 transcript messages
- Calls OpenAI GPT-4o for analysis
- Generates say meter score with factor breakdown
- Generates context injection, curveball, and followup suggestions
- Saves results to voice_analysis table

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 5: Client-Side Integration

### Task 13: Update useVoiceRealtime Hook

**Files:**
- Modify: `src/hooks/useVoiceRealtime.ts`

**Step 1: Add transcript API integration**

```typescript
// Add after existing onMessage handler in useVoiceRealtime.ts

// Send transcript to API for storage and analysis
const sendTranscriptToAPI = async (message: TranscriptItem) => {
  try {
    await fetch('/api/voice/transcript', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: config.sessionId,
        round_number: 1,
        role: message.role,
        text: message.text,
        timestamp: new Date(message.timestamp).toISOString()
      })
    })
  } catch (error) {
    console.error('Failed to send transcript to API:', error)
  }
}

// Update the onMessage handler to call sendTranscriptToAPI
onMessage: (message) => {
  console.log('📨 Message:', message)

  if (!message.message) return

  // Handle user messages
  if (message.role === 'user' || message.source === 'user') {
    const newItem: TranscriptItem = {
      role: 'user',
      text: message.message,
      timestamp: Date.now()
    }

    setTranscript((prev) => [...prev, newItem])

    // Send to API
    sendTranscriptToAPI(newItem)

    // Publish to live_events (keep existing)
    supabase
      .from('live_events')
      .insert({
        session_id: config.sessionId,
        event_type: 'voice_transcript',
        payload: {
          role: 'user',
          text: message.message,
          timestamp: newItem.timestamp
        }
      })
      .then(() => console.log('📝 User transcript published'))
      .catch((err) => console.error('Failed to publish transcript:', err))
  }

  // Handle agent messages
  if (message.role === 'agent' || message.source === 'ai') {
    const newItem: TranscriptItem = {
      role: 'assistant',
      text: message.message,
      timestamp: Date.now()
    }

    setTranscript((prev) => [...prev, newItem])

    // Send to API
    sendTranscriptToAPI(newItem)

    // Publish to live_events (keep existing)
    supabase
      .from('live_events')
      .insert({
        session_id: config.sessionId,
        event_type: 'voice_transcript',
        payload: {
          role: 'assistant',
          text: message.message,
          timestamp: newItem.timestamp
        }
      })
      .then(() => console.log('📝 Agent transcript published'))
      .catch((err) => console.error('Failed to publish transcript:', err))
  }
}
```

**Step 2: Commit**

```bash
git add src/hooks/useVoiceRealtime.ts
git commit -m "feat(voice): integrate transcript API in useVoiceRealtime

- Send all transcript messages to /api/voice/transcript
- Keeps existing live_events publishing
- Enables real-time analysis trigger

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 14: Create useVoiceAnalysis Hook

**Files:**
- Create: `src/hooks/useVoiceAnalysis.ts`

**Step 1: Create hook**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

interface SayMeter {
  score: number
  factors: {
    rapport: number
    discovery: number
    objection_handling: number
    value_articulation: number
    closing_momentum: number
  }
  reasoning?: string
}

interface Suggestion {
  id: string
  type: 'context_injection' | 'curveball' | 'followup_question'
  text: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  dismissed: boolean
  triggered_at: string
}

export function useVoiceAnalysis(sessionId: string, roundNumber: number = 1) {
  const [sayMeter, setSayMeter] = useState<SayMeter | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!sessionId) return

    // Fetch initial state
    fetchLatestAnalysis()

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`voice-analysis-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'voice_analysis',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => {
          const analysis = payload.new as any

          console.log('📊 New analysis received:', analysis.analysis_type)

          if (analysis.analysis_type === 'say_meter') {
            setSayMeter({
              score: analysis.meter_score,
              factors: analysis.meter_factors,
              reasoning: analysis.meter_reasoning
            })
          } else if (analysis.analysis_type === 'suggestion') {
            // Add new suggestion to the list
            const newSuggestion: Suggestion = {
              id: analysis.id,
              type: analysis.suggestion_category,
              text: analysis.suggestion_text,
              priority: analysis.priority,
              dismissed: analysis.dismissed,
              triggered_at: analysis.triggered_at
            }
            setSuggestions(prev => [newSuggestion, ...prev])
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'voice_analysis',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => {
          const updated = payload.new as any

          // Update dismissed status
          if (updated.analysis_type === 'suggestion') {
            setSuggestions(prev =>
              prev.map(s => s.id === updated.id ? { ...s, dismissed: updated.dismissed } : s)
            )
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId, roundNumber])

  const fetchLatestAnalysis = async () => {
    setLoading(true)

    try {
      // Get latest say meter
      const { data: meterData } = await supabase
        .from('voice_analysis')
        .select('*')
        .eq('session_id', sessionId)
        .eq('round_number', roundNumber)
        .eq('analysis_type', 'say_meter')
        .order('triggered_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (meterData) {
        setSayMeter({
          score: meterData.meter_score,
          factors: meterData.meter_factors,
          reasoning: meterData.meter_reasoning
        })
      }

      // Get recent suggestions (not dismissed)
      const { data: suggestionsData } = await supabase
        .from('voice_analysis')
        .select('*')
        .eq('session_id', sessionId)
        .eq('round_number', roundNumber)
        .eq('analysis_type', 'suggestion')
        .eq('dismissed', false)
        .order('triggered_at', { ascending: false })
        .limit(10)

      if (suggestionsData) {
        setSuggestions(
          suggestionsData.map(s => ({
            id: s.id,
            type: s.suggestion_category,
            text: s.suggestion_text,
            priority: s.priority,
            dismissed: s.dismissed,
            triggered_at: s.triggered_at
          }))
        )
      }
    } catch (error) {
      console.error('Failed to fetch analysis:', error)
    } finally {
      setLoading(false)
    }
  }

  const dismissSuggestion = async (suggestionId: string) => {
    try {
      await supabase
        .from('voice_analysis')
        .update({ dismissed: true })
        .eq('id', suggestionId)

      // Optimistic update
      setSuggestions(prev => prev.filter(s => s.id !== suggestionId))
    } catch (error) {
      console.error('Failed to dismiss suggestion:', error)
    }
  }

  return {
    sayMeter,
    suggestions,
    loading,
    dismissSuggestion,
    refresh: fetchLatestAnalysis
  }
}
```

**Step 2: Commit**

```bash
git add src/hooks/useVoiceAnalysis.ts
git commit -m "feat(analytics): add useVoiceAnalysis hook

- Fetches latest say meter and suggestions
- Subscribes to real-time voice_analysis updates
- Provides dismissSuggestion action
- Auto-updates UI on new analysis

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 6: UI Components

### Task 15: Create SayMeter Component

**Files:**
- Create: `src/components/voice/SayMeter.tsx`

**Step 1: Create component**

```typescript
'use client'

interface SayMeterProps {
  score: number // 0-100
  factors?: {
    rapport?: number
    discovery?: number
    objection_handling?: number
    value_articulation?: number
    closing_momentum?: number
  }
  reasoning?: string
}

export function SayMeter({ score, factors, reasoning }: SayMeterProps) {
  // Color mapping based on score
  const getColor = (value: number) => {
    if (value >= 80) return { bg: 'bg-green-500', text: 'text-green-700', border: 'border-green-500' }
    if (value >= 50) return { bg: 'bg-yellow-500', text: 'text-yellow-700', border: 'border-yellow-500' }
    return { bg: 'bg-red-500', text: 'text-red-700', border: 'border-red-500' }
  }

  const { bg, text, border } = getColor(score)

  const formatFactorName = (key: string) => {
    return key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  return (
    <div className="space-y-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Call Health
        </h3>
        {score === 0 && (
          <span className="text-xs text-gray-500">Analyzing...</span>
        )}
      </div>

      {/* Main Meter */}
      <div className="space-y-2">
        <div className="relative h-8 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${bg} transition-all duration-700 ease-out`}
            style={{ width: `${score}%` }}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className={`text-3xl font-bold ${text}`}>
            {score}
          </span>
          <span className="text-sm text-gray-500">/ 100</span>
        </div>
      </div>

      {/* Reasoning */}
      {reasoning && (
        <div className="text-sm text-gray-600 dark:text-gray-400 italic">
          {reasoning}
        </div>
      )}

      {/* Factor Breakdown */}
      {factors && Object.keys(factors).length > 0 && (
        <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide">
            Factor Breakdown
          </div>
          {Object.entries(factors).map(([key, value]) => {
            const factorColor = getColor(value || 0)
            return (
              <div key={key} className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  {formatFactorName(key)}
                </span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${factorColor.bg} transition-all duration-500`}
                      style={{ width: `${value || 0}%` }}
                    />
                  </div>
                  <span className={`w-8 text-right font-medium ${factorColor.text}`}>
                    {value || 0}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/voice/SayMeter.tsx
git commit -m "feat(ui): add SayMeter component

- Visual meter with color gradient (red/yellow/green)
- Factor breakdown with mini-bars
- Reasoning text display
- Dark mode support

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 16: Create SuggestionsPanel Component

**Files:**
- Create: `src/components/voice/SuggestionsPanel.tsx`

**Step 1: Create component**

```typescript
'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'

interface Suggestion {
  id: string
  type: 'context_injection' | 'curveball' | 'followup_question'
  text: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  dismissed: boolean
}

interface SuggestionsPanelProps {
  sessionId: string
  suggestions: Suggestion[]
  onDismiss?: (id: string) => void
}

export function SuggestionsPanel({ sessionId, suggestions, onDismiss }: SuggestionsPanelProps) {
  const [applying, setApplying] = useState<string | null>(null)

  const applyContextInjection = async (suggestion: Suggestion) => {
    setApplying(suggestion.id)

    try {
      await supabase.from('voice_commands').insert({
        session_id: sessionId,
        command_type: 'difficulty_change', // Reuse for context injection
        payload: {
          context_injection: suggestion.text
        },
        source: 'ai_suggested'
      })

      console.log('✅ Context injection applied:', suggestion.text)

      // Dismiss after applying
      if (onDismiss) {
        onDismiss(suggestion.id)
      }
    } catch (error) {
      console.error('Failed to apply context injection:', error)
    } finally {
      setApplying(null)
    }
  }

  const applyCurveball = async (suggestion: Suggestion) => {
    setApplying(suggestion.id)

    try {
      await supabase.from('voice_commands').insert({
        session_id: sessionId,
        command_type: 'curveball_inject',
        payload: {
          curveball: suggestion.text,
          label: 'AI Suggested Curveball'
        },
        source: 'ai_suggested'
      })

      console.log('✅ Curveball applied:', suggestion.text)

      // Dismiss after applying
      if (onDismiss) {
        onDismiss(suggestion.id)
      }
    } catch (error) {
      console.error('Failed to apply curveball:', error)
    } finally {
      setApplying(null)
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'border-red-500 bg-red-50 dark:bg-red-900/20'
      case 'high':
        return 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
      case 'medium':
        return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
      default:
        return 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'context_injection':
        return '💡'
      case 'curveball':
        return '⚡'
      case 'followup_question':
        return '❓'
      default:
        return '📌'
    }
  }

  const getTypeLabel = (type: string) => {
    return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  }

  const activeSuggestions = suggestions.filter(s => !s.dismissed)

  return (
    <div className="space-y-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          AI Suggestions
        </h3>
        {activeSuggestions.length > 0 && (
          <span className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full">
            {activeSuggestions.length}
          </span>
        )}
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {activeSuggestions.length === 0 && (
          <div className="text-sm text-gray-500 text-center py-8">
            No suggestions yet. Analysis runs every 10 messages.
          </div>
        )}

        {activeSuggestions.map(suggestion => (
          <div
            key={suggestion.id}
            className={`p-3 rounded-lg border-l-4 ${getPriorityColor(suggestion.priority)} transition-all`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{getTypeIcon(suggestion.type)}</span>
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                    {getTypeLabel(suggestion.type)}
                  </span>
                  <span className={`text-xs font-semibold uppercase ${
                    suggestion.priority === 'critical' ? 'text-red-600' :
                    suggestion.priority === 'high' ? 'text-orange-600' :
                    suggestion.priority === 'medium' ? 'text-yellow-600' :
                    'text-blue-600'
                  }`}>
                    {suggestion.priority}
                  </span>
                </div>

                <div className="text-sm text-gray-800 dark:text-gray-200">
                  {suggestion.text}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                {/* Apply button (only for context injection and curveball) */}
                {(suggestion.type === 'context_injection' || suggestion.type === 'curveball') && (
                  <button
                    onClick={() =>
                      suggestion.type === 'curveball'
                        ? applyCurveball(suggestion)
                        : applyContextInjection(suggestion)
                    }
                    disabled={applying === suggestion.id}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                  >
                    {applying === suggestion.id ? 'Applying...' : 'Apply'}
                  </button>
                )}

                {/* Dismiss button */}
                <button
                  onClick={() => onDismiss && onDismiss(suggestion.id)}
                  className="px-2 py-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xs transition-colors"
                  title="Dismiss"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/voice/SuggestionsPanel.tsx
git commit -m "feat(ui): add SuggestionsPanel component

- Display AI suggestions with priority colors
- Apply context injection and curveballs
- Dismiss suggestions
- Type-specific icons and labels
- Dark mode support

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 7: Integration & Testing

### Task 17: Integration Documentation

**Files:**
- Create: `docs/VOICE_ANALYTICS_INTEGRATION.md`

**Step 1: Create integration guide**

```markdown
# Voice Analytics Integration Guide

## Overview

This guide explains how to integrate the Say Meter and Suggestions Panel into the interviewer gateway panel.

## Quick Start

### 1. Add Hook to Gateway Panel

```typescript
import { useVoiceAnalysis } from '@/hooks/useVoiceAnalysis'
import { SayMeter } from '@/components/voice/SayMeter'
import { SuggestionsPanel } from '@/components/voice/SuggestionsPanel'

function InterviewerGatewayPanel({ sessionId }: { sessionId: string }) {
  const { sayMeter, suggestions, dismissSuggestion } = useVoiceAnalysis(sessionId)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Say Meter */}
      <SayMeter
        score={sayMeter?.score || 0}
        factors={sayMeter?.factors}
        reasoning={sayMeter?.reasoning}
      />

      {/* Suggestions */}
      <SuggestionsPanel
        sessionId={sessionId}
        suggestions={suggestions}
        onDismiss={dismissSuggestion}
      />
    </div>
  )
}
```

### 2. Enable Real-Time Updates

Make sure real-time replication is enabled for:
- `voice_analysis`
- `voice_transcripts`
- `voice_commands`

Run: `supabase/enable_realtime.sql` in Supabase SQL Editor

### 3. Configure Environment Variables

```bash
# .env.local
OPENAI_API_KEY=sk-...
ELEVENLABS_API_KEY=sk_...
NEXT_PUBLIC_SUPABASE_URL=https://....supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Data Flow

1. **Transcript Capture**: `useVoiceRealtime` sends messages to `/api/voice/transcript`
2. **Analysis Trigger**: Every 10 messages, `/api/voice/analyze` is called
3. **OpenAI Analysis**: GPT-4o analyzes transcript and generates say meter + suggestions
4. **Database Save**: Results saved to `voice_analysis` table
5. **Real-Time Update**: Supabase propagates to `useVoiceAnalysis` hook
6. **UI Update**: Say Meter and Suggestions Panel refresh automatically

## Testing

### Manual Test

1. Start dev server: `npm run dev`
2. Create interview with persona selected
3. Start voice call
4. Speak with AI prospect
5. After 10 messages, check Gateway Panel for:
   - Say Meter updates
   - Suggestions appear
6. Click "Apply" on a curveball → AI prospect should adjust behavior

### Debug Logs

Check browser console for:
- `📨 Message:` - Transcript events
- `📝 User/Agent transcript published` - Live events
- `🤖 Analyzing transcript...` - Analysis trigger
- `✅ Analysis complete` - Analysis results
- `📊 New analysis received` - Real-time updates

## Troubleshooting

### Say Meter not updating
- Check Supabase real-time is enabled
- Verify `voice_analysis` channel subscription in Network tab
- Check API logs for OpenAI errors

### Suggestions not appearing
- Verify OpenAI returned suggestions in `/api/voice/analyze` response
- Check `voice_analysis` table has `analysis_type = 'suggestion'` rows
- Ensure `dismissed = false` filter in hook

### Context injection not working
- Check `voice_commands` table has new row with `source = 'ai_suggested'`
- Verify `useVoiceRealtime` is subscribed to `voice_commands` channel
- Check ElevenLabs SDK `sendText()` is being called

## Advanced Usage

### Custom Analysis Frequency

Change trigger frequency in `/api/voice/transcript`:

```typescript
// Trigger every 5 messages instead of 10
if (count && count % 5 === 0) {
  fetch('/api/voice/analyze', ...)
}
```

### Custom Say Meter Factors

Update factors in `/lib/ai/analysis-prompt.ts`:

```typescript
2. FACTOR BREAKDOWN (each 0-100):
   - rapport: ...
   - discovery: ...
   - objection_handling: ...
   - value_articulation: ...
   - closing_momentum: ...
   - YOUR_CUSTOM_FACTOR: ...
```

### Track-Specific Rubrics

Modify system prompt based on job track:

```typescript
const systemPrompt = track === 'sales'
  ? SALES_ANALYSIS_PROMPT
  : ENGINEERING_ANALYSIS_PROMPT
```
```

**Step 2: Commit**

```bash
git add docs/VOICE_ANALYTICS_INTEGRATION.md
git commit -m "docs: add voice analytics integration guide

- Quick start instructions
- Data flow diagram
- Testing guide
- Troubleshooting tips
- Advanced customization examples

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Summary

This implementation plan provides:

✅ **Database migrations** ready for new Supabase instance
✅ **Persona CRUD APIs** with full validation
✅ **Dynamic agent creation** using persona templates
✅ **Transcript collection** with automatic analysis triggers
✅ **OpenAI-powered analytics** generating say meter and suggestions
✅ **Real-time hooks** for seamless UI updates
✅ **Polished UI components** with dark mode support
✅ **Integration guide** for gateway panel

## Estimated Timeline

- **Phase 1 (Migrations)**: 30 minutes
- **Phase 2 (Persona CRUD)**: 1.5 hours
- **Phase 3 (Voice Session)**: 45 minutes
- **Phase 4 (Analytics APIs)**: 2 hours
- **Phase 5 (Client Hooks)**: 1 hour
- **Phase 6 (UI Components)**: 2 hours
- **Phase 7 (Integration & Testing)**: 1.5 hours

**Total**: ~9-10 hours

## Next Steps

Choose execution approach:
1. **Subagent-Driven** (this session) - Fresh subagent per task with review checkpoints
2. **Parallel Session** (separate) - Batch execution with milestone reviews
