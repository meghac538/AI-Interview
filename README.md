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

## Sales Interview Flow

### Round 1: Live Persona Sell (12 min)
Text chat with AI prospect Sarah Chen. Requirements:
- Ask discovery questions
- Handle objections
- Quantify value proposition
- Professional closing

### Round 2: Negotiation via Email (15 min)
Email thread with system responses. Requirements:
- Send 2 email responses
- Maintain professional tone
- Protect margins
- Handle escalating objections

### Round 3: Follow-up Discipline (5 min)
Internal handoff note (optional)

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

POST /api/interviewer/action      # Interviewer actions (flag, advance, stop)
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
