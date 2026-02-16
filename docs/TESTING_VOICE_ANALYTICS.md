# Testing Voice Analytics Engine

This guide shows how to test the voice analytics endpoint that generates Say Meter scores and coaching suggestions.

## Prerequisites

1. **Environment Setup**
   - Ensure `.env.local` has `OPENAI_API_KEY` configured
   - Dev server running: `npm run dev`
   - Database migrations applied (see `supabase/migrations/02_voice_analytics.sql`)

2. **Test Data Required**
   - An active interview session with `session_id`
   - At least 10-20 transcript messages in `voice_transcripts` table

## Testing Flow

### Step 1: Create Transcript Data (via Task 11 API)

First, populate some transcript data:

```bash
curl -X POST http://localhost:3000/api/voice/transcript \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "550e8400-e29b-41d4-a716-446655440000",
    "round_number": 1,
    "messages": [
      {
        "role": "user",
        "text": "Hi, I wanted to understand more about your current tech stack.",
        "timestamp": 1710000000000
      },
      {
        "role": "assistant",
        "text": "We are currently using a legacy CRM system that is about 10 years old.",
        "timestamp": 1710000005000
      },
      {
        "role": "user",
        "text": "I see. What are the main pain points with your current system?",
        "timestamp": 1710000010000
      },
      {
        "role": "assistant",
        "text": "The biggest issue is that it does not integrate well with our other tools.",
        "timestamp": 1710000015000
      }
    ]
  }'
```

**Note**: The transcript endpoint auto-triggers analysis every 10 messages.

### Step 2: Manually Trigger Analysis

Use the test script:

```bash
./test-analyze.sh 550e8400-e29b-41d4-a716-446655440000
```

Or call the API directly:

```bash
curl -X POST http://localhost:3000/api/voice/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "550e8400-e29b-41d4-a716-446655440000",
    "round_number": 1
  }'
```

### Step 3: Verify Response

Expected response structure:

```json
{
  "success": true,
  "say_meter": {
    "score": 65,
    "factors": {
      "talk_ratio": 70,
      "question_quality": 75,
      "active_listening": 60,
      "pacing": 55,
      "objection_handling": 65
    },
    "summary": "The candidate demonstrates good questioning skills and maintains a healthy talk ratio. However, pacing could be improved by allowing more space for the prospect to elaborate on pain points."
  },
  "suggestions": [
    {
      "category": "followup_question",
      "text": "Ask: 'Can you walk me through a specific scenario where the integration issues caused problems for your team?'",
      "priority": "high",
      "rationale": "The candidate identified a pain point but didn't dig deeper into the business impact, which is critical for building value."
    },
    {
      "category": "context_injection",
      "text": "Mention that the prospect's company recently underwent a merger, adding complexity to their integration needs.",
      "priority": "medium",
      "rationale": "Tests if the candidate can adapt their questioning to uncover how organizational changes affect the technical requirements."
    }
  ],
  "analyzed_messages": 20
}
```

### Step 4: Verify Database Storage

Check that results were saved:

```sql
-- Check Say Meter records
SELECT * FROM voice_analysis
WHERE session_id = '550e8400-e29b-41d4-a716-446655440000'
  AND analysis_type = 'say_meter'
ORDER BY created_at DESC
LIMIT 5;

-- Check Suggestions
SELECT * FROM voice_analysis
WHERE session_id = '550e8400-e29b-41d4-a716-446655440000'
  AND analysis_type = 'suggestion'
  AND dismissed = false
ORDER BY priority DESC, created_at DESC;
```

### Step 5: Verify Real-time Updates

If you have the interviewer UI open, the Say Meter and suggestions should update automatically via Supabase Realtime.

## Error Scenarios

### No Transcripts Available

```bash
# Request:
curl -X POST http://localhost:3000/api/voice/analyze \
  -H "Content-Type: application/json" \
  -d '{"session_id": "00000000-0000-0000-0000-000000000000"}'

# Response (404):
{
  "error": "No transcripts available for analysis"
}
```

### Missing Session ID

```bash
# Request:
curl -X POST http://localhost:3000/api/voice/analyze \
  -H "Content-Type: application/json" \
  -d '{}'

# Response (400):
{
  "error": "session_id is required"
}
```

## Understanding the Say Meter

The Say Meter is a composite score (0-100) based on 5 factors:

1. **Talk Ratio** (0-100)
   - Ideal: Candidate speaks 60-70% of the time
   - Too low: Not driving the conversation
   - Too high: Not listening enough

2. **Question Quality** (0-100)
   - Are questions open-ended?
   - Do they uncover needs/pain points?
   - Are they discovery-focused vs. product-focused?

3. **Active Listening** (0-100)
   - Does candidate build on prospect's responses?
   - Do they reference earlier points?
   - Do they paraphrase to confirm understanding?

4. **Pacing** (0-100)
   - Is the candidate rushing?
   - Do they give space for thought?
   - Are pauses handled naturally?

5. **Objection Handling** (0-100)
   - How does candidate respond to pushback?
   - Do they acknowledge concerns?
   - Do they reframe objections as opportunities?

**Scoring Guidelines:**
- 0-39: Poor performance, major gaps
- 40-59: Below average, needs improvement
- 60-79: Good performance, minor areas to refine
- 80-100: Exceptional, demonstrates mastery

## Suggestion Categories

### Context Injection
Inject new information to test candidate's adaptability:
- "The prospect just mentioned their CFO is risk-averse about new tools"
- "Their competitor just launched a similar product"

### Curveball
Add unexpected objections or constraints:
- "Budget was just cut by 30%"
- "Decision maker is on vacation for 2 weeks"

### Follow-up Question
Specific questions the candidate should have asked:
- "When you say 'legacy system', how old is it exactly?"
- "Who else is affected by this integration issue?"

## Integration with UI

The analytics results automatically populate these UI components:

1. **Say Meter Gauge** (`SayMeterGauge.tsx`)
   - Real-time score updates
   - Visual breakdown of 5 factors
   - Historical trend graph

2. **Suggestion Panel** (`SuggestionPanel.tsx`)
   - Live suggestion cards
   - Priority-based sorting
   - Dismiss/apply actions

3. **Transcript View** (`TranscriptView.tsx`)
   - Highlighted areas where suggestions apply
   - Inline coaching tips

## Performance Notes

- **Analysis Latency**: 2-4 seconds (2 OpenAI API calls)
- **Cost per Analysis**: ~$0.02 (using GPT-4o)
- **Auto-trigger Frequency**: Every 10 messages
- **Context Window**: Last 20 messages

## Troubleshooting

### Analysis Not Triggering

Check if `NEXT_PUBLIC_APP_URL` is set correctly in `.env.local`:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### OpenAI API Errors

Verify API key is valid:

```bash
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

### Database Errors

Ensure migrations are applied:

```bash
# Run migrations
psql $DATABASE_URL -f supabase/migrations/02_voice_analytics.sql

# Verify tables exist
psql $DATABASE_URL -c "\dt voice_*"
```

## Next Steps

After verifying the analytics engine:

1. **Task 13**: Build the Say Meter UI component
2. **Task 14**: Build the Suggestion Panel UI
3. **Task 15**: Add real-time subscriptions for live updates
