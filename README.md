# Interview Platform

Live interview platform with AI-assisted evaluation and real-time monitoring for structured role-based assessments.

## Features

- **Live Interview Sessions** - Timed rounds with automatic progression
- **Multi-format Rounds** - Voice, email, text, code, and multiple-choice assessments
- **AI Prospect Interaction** - Text-based conversations with realistic personas
- **AI Assistant** - Policy-governed help (outline guidance only, 6 queries max)
- **Real-time Updates** - Instant sync across candidate/interviewer views
- **Evidence-based Scoring** - AI-powered evaluation with quote extraction
- **Red Flag Detection** - Automatic and manual flagging with auto-stop for critical issues
- **Adaptive Difficulty** - Round difficulty adjusts based on candidate performance
- **Live Curveball Injection** - Track-aware constraints injected mid-round with AI contextualization
- **Persona Switching** - Dynamic AI persona changes during conversational rounds
- **Audit Trail** - Complete immutable event log

## Tech Stack

- Next.js 15 (App Router) + TypeScript
- Supabase (PostgreSQL + Realtime)
- OpenAI GPT-4o
- Tailwind CSS

## Quick Start

### 1. Install

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env.local` and add your credentials:

```bash
# Supabase (get from: https://app.supabase.com/project/_/settings/api)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenAI (get from: https://platform.openai.com/api-keys)
OPENAI_API_KEY=sk-your-key

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Set Up Database

1. Go to [Supabase SQL Editor](https://app.supabase.com)
2. Execute `database/production_schema_migration.sql`
3. Enable Realtime replication for: `interview_sessions`, `interview_scope_packages`, `scores`, `live_events`

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Create Your First Session

**Option 1: Test Page (Easiest)**
```
http://localhost:3000/test
```
Fill in the form and click "Create Session" - auto-redirects to candidate view.

**Option 2: API**
```bash
curl -X POST http://localhost:3000/api/session/create \
  -H "Content-Type: application/json" \
  -d '{"candidate_name": "Test Megha", "role": "Account Executive", "level": "mid"}'
```
Use the returned `session.id` to visit: `http://localhost:3000/candidate/{session.id}`

## Supported Tracks & Round Types

The platform auto-detects the interview track from the role name, or you can specify it explicitly. Each track generates a tailored round plan with appropriate question types.

### Tracks

| Track | Example Roles |
|-------|--------------|
| Sales | Account Executive, BDR, SDR, Solutions AE |
| Implementation | Solutions Consultant, Client Delivery, Customer Outcomes |
| Marketing | Growth Marketing, Brand Strategist, Campaign Ops |
| Engineering | Fullstack, Agentic Eng, Security, Data |
| HR | People Ops, Talent Acquisition |

### Round Types

| Type | Format | Description |
|------|--------|-------------|
| `text` | Written response | Candidate writes a structured answer to a prompt |
| `email` | Email thread | Back-and-forth email exchange with AI-simulated recipient |
| `voice-realtime` | Live voice call | Real-time voice conversation via ElevenLabs |
| `code` | Code editor | Write and submit code to solve a technical challenge |
| `mcq` | Multiple choice | Select answers from predefined options |
| `agentic` | Multi-channel chat | Customer + internal team channels with AI personas |

Rounds are auto-generated based on track, role, and difficulty level. The interviewer can end rounds early, skip rounds, or force-advance via the dashboard.

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── session/           # Session CRUD + termination
│   │   ├── round/             # Round start/complete
│   │   ├── artifact/          # Response submission
│   │   ├── ai/                # AI chat + prospect interaction
│   │   ├── followup/          # Follow-up generation, pending, threads
│   │   ├── interviewer/       # Interviewer actions + session list
│   │   ├── blueprints/        # Assessment blueprint CRUD
│   │   └── question-factory/  # AI question generation
│   ├── candidate/             # Candidate interview view
│   ├── interviewer/           # Interviewer monitoring dashboard
│   └── test/                  # Session creation test page
├── components/
│   ├── rounds/                # Round UIs (Voice, Email, Text, Code, MCQ)
│   ├── ui/                    # Shared UI components (markdown)
│   ├── TaskSurface.tsx        # Main task display
│   ├── SidekickPanel.tsx      # AI assistant
│   └── GatePanel.tsx          # Interviewer controls + red flags
├── contexts/                  # React Context
├── hooks/                     # Custom hooks (useRealtimeSession)
└── lib/
    ├── ai/                    # Scoring engine + question factory
    ├── constants/             # Red flag types + shared constants
    ├── db/                    # Shared DB helpers
    ├── supabase/              # Supabase client config
    ├── types/                 # TypeScript types
    └── utils/                 # Round adapter + utilities
```

## Key Concepts

**Sessions** are created with: job_profile → candidate → interview_session → interview_scope_package

**Rounds** are stored as JSONB arrays in `interview_scope_packages.round_plan`:
```typescript
{
  round_number: 1,
  round_type: 'voice',  // or 'email', 'text', 'code', 'mcq'
  title: 'Round 1: Live Persona Sell',
  status: 'active',     // or 'pending', 'completed', 'skipped'
  duration_minutes: 12,
  config: { /* round-specific settings */ }
}
```

**Real-time** uses Supabase channels for instant updates across views

**AI Assistant** is policy-governed with server-side enforcement

## Curveball & Persona System

The interviewer can inject constraints and switch AI personas in real-time during a session via the Live Controls panel on the interviewer dashboard.

### Curveballs

Curveballs are mid-round constraints that force the candidate to adapt. They are defined in `src/lib/constants/curveball-library.ts` and filtered by track.

| Track | Example Curveballs |
|-------|-------------------|
| Sales | Budget cut, competitor pressure, CFO pushback, security concern |
| Implementation | Scope creep, data migration failure, team resource loss, client escalation |
| Engineering | Production incident, dependency vulnerability, performance regression |
| Universal | Stakeholder change (applies to all tracks) |

**How curveballs work by round type:**

- **Conversational rounds** (voice, email, agentic) — The AI incorporates the curveball into its next response naturally. The candidate doesn't see the raw curveball text.
- **Non-conversational rounds** (text, code, mcq) — The curveball appears as a "Scenario Update" card on the candidate's screen. Library curveballs are rewritten by AI to match the round's specific prompt context.

**Custom curveballs** — The interviewer can type free-text constraints instead of picking from the library. Custom text is displayed as-is (no AI rewriting).

### Personas

Personas control the AI's personality and behavior during conversational rounds. They are defined alongside curveballs in the library and filtered by track.

| Track | Available Personas |
|-------|-------------------|
| Sales | Skeptical buyer, CFO (budget-focused), security lead, champion |
| Implementation | Anxious client, technical stakeholder, executive sponsor, resistant user |
| Engineering | Senior reviewer, product manager, security auditor, ops engineer |

**Custom personas** — The interviewer can type a free-text persona description for full control over the AI's behavior.

Persona controls are hidden for non-conversational rounds (text, code, mcq) since there is no AI conversation to apply them to.

### Data Flow

```
Interviewer injects curveball/persona via dashboard
  → POST /api/interviewer/action
  → Updates round_plan in interview_scope_packages (Supabase)
  → Emits live_event for audit trail
  → For non-conv rounds: curveball appears on candidate screen via realtime subscription
  → For conv rounds: AI reads controls on next response via readInterviewerControls()
  → Consumption feedback shown on interviewer dashboard (Used/Pending badges)
```

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/constants/curveball-library.ts` | Curveball and persona definitions, track filtering helpers |
| `src/lib/ai/interviewer-controls.ts` | Shared utility to read all interviewer controls from DB |
| `src/app/api/interviewer/action/route.ts` | Action handler for inject, switch, escalate |
| `src/app/api/ai/prospect/route.ts` | AI conversation endpoint that consumes controls |
| `src/components/TaskSurface.tsx` | Candidate-facing curveball display (Scenario Update cards) |
| `src/components/VoiceControlPanel.tsx` | Voice-specific live controls |

## API Reference

```http
POST /api/session/create          # Create new interview session
GET  /api/session/{id}            # Get session details
POST /api/session/{id}/terminate  # End session early

POST /api/round/start             # Start a round
POST /api/round/complete          # Complete a round (triggers scoring)

POST /api/artifact/submit         # Submit candidate response

POST /api/ai/chat                 # AI assistant interaction
POST /api/ai/prospect             # AI prospect conversation

POST /api/followup/generate       # Generate follow-up questions
GET  /api/followup/pending        # Get pending follow-ups
GET  /api/followup/thread         # Get follow-up thread

POST /api/interviewer/action      # Interviewer actions (curveball, persona, flag, advance, stop)
GET  /api/interviewer/sessions    # List interviewer sessions

GET  /api/blueprints              # List assessment blueprints
GET  /api/blueprints/{id}         # Get blueprint details

POST /api/question-factory/generate  # Generate questions from blueprints
```

## Troubleshooting

**Session won't create?**
- Check Supabase credentials in `.env.local`
- Verify database schema is installed

**Real-time not working?**
- Enable Realtime replication in Supabase
- Check browser console for WebSocket errors

**AI not responding?**
- Verify OpenAI API key is valid
- Check API usage limits

## Development

### Adding a Round Type

1. Add type to `RoundType` in `src/lib/types/database.ts`
2. Create UI component in `src/components/rounds/`
3. Register in `TaskSurface.tsx`
4. Update session creation to include in round_plan

### Code Standards

- Use TypeScript with proper typing
- Use "use client" for client components
- Log important events to `live_events`
- Test real-time updates in separate tabs
- Always validate input in API routes
