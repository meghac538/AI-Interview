# Interview Platform

Live interview platform with AI-assisted evaluation and real-time monitoring for structured role-based assessments.

## Features

- **Live Interview Sessions** - Timed rounds with automatic progression
- **AI Prospect Interaction** - Text-based conversations with realistic personas
- **AI Assistant** - Policy-governed help (outline guidance only, 6 queries max)
- **Real-time Updates** - Instant sync across candidate/interviewer views
- **Evidence-based Scoring** - AI-powered evaluation with quote extraction
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
2. Copy and execute `supabase_mvp_schema.sql`
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
  -d '{"candidate_name": "Jane Doe", "role": "Account Executive", "level": "mid"}'
```
Use the returned `session.id` to visit: `http://localhost:3000/candidate/{session.id}`

## Sales Interview Flow

### Round 1: Live Persona Sell (12 min)
Text chat with AI prospect Sarah Chen. Requirements:
- Ask ≥5 discovery questions
- Handle ≥3 objections
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
│   ├── api/              # API routes
│   │   ├── session/      # Session CRUD
│   │   ├── round/        # Round start/complete
│   │   ├── artifact/     # Response submission
│   │   └── ai/           # AI integrations
│   ├── candidate/        # Candidate interview view
│   ├── interviewer/      # Interviewer monitoring
│   └── test/             # Session creation test page
├── components/
│   ├── rounds/           # Round-specific UIs
│   ├── TaskSurface.tsx   # Main task display
│   ├── SidekickPanel.tsx # AI assistant
│   └── GatePanel.tsx     # Interviewer controls
├── contexts/             # React Context
├── hooks/                # Custom hooks
└── lib/
    ├── supabase/         # DB clients
    ├── ai/               # AI policies
    └── types/            # TypeScript types
```

## Key Concepts

**Sessions** are created with: job_profile → candidate → interview_session → interview_scope_package

**Rounds** are stored as JSONB arrays in `interview_scope_packages.round_plan`:
```typescript
{
  round_number: 1,
  round_type: 'voice',  // or 'email', 'text'
  title: 'Round 1: Live Persona Sell',
  status: 'active',     // or 'pending', 'completed'
  duration_minutes: 12,
  config: { /* round-specific settings */ }
}
```

**Real-time** uses 5 Supabase channels for instant updates across views

**AI Assistant** is policy-governed with server-side enforcement

## API Reference

```http
POST /api/session/create
GET  /api/session/{id}
POST /api/round/start
POST /api/round/complete
POST /api/artifact/submit
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

1. Update type in `src/lib/types/database.ts`
2. Create UI component in `src/components/rounds/`
3. Register in `TaskSurface.tsx`
4. Update session creation to include in round_plan

### Code Standards

- Use TypeScript (no `any` types)
- Use "use client" for client components
- Log important events to `live_events`
- Test real-time updates in separate tabs
- Always validate input in API routes

## License

MIT
