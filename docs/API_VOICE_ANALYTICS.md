# Voice Analytics API Reference

## POST /api/voice/analyze

Analyzes voice interview transcripts using OpenAI GPT-4o to generate:
1. Say Meter score (0-100) with 5 performance factors
2. Contextual coaching suggestions for the interviewer

### Request

**Method**: `POST`

**Endpoint**: `/api/voice/analyze`

**Headers**:
```
Content-Type: application/json
```

**Body**:
```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "round_number": 1  // Optional, defaults to 1
}
```

**Parameters**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `session_id` | string (UUID) | Yes | Interview session identifier |
| `round_number` | number | No | Round number (defaults to 1) |

### Response

**Success (200)**:
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
    "summary": "The candidate demonstrates good questioning skills..."
  },
  "suggestions": [
    {
      "category": "followup_question",
      "text": "Ask: 'Can you walk me through a specific scenario...'",
      "priority": "high",
      "rationale": "The candidate identified a pain point but didn't dig deeper..."
    }
  ],
  "analyzed_messages": 20
}
```

**Field Descriptions**:

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Always `true` on success |
| `say_meter.score` | number (0-100) | Overall performance score |
| `say_meter.factors` | object | Breakdown of 5 scoring factors |
| `say_meter.summary` | string | 2-sentence explanation of the score |
| `suggestions` | array | 0-3 coaching suggestions |
| `suggestions[].category` | string | `context_injection` \| `curveball` \| `followup_question` |
| `suggestions[].text` | string | Actionable suggestion text |
| `suggestions[].priority` | string | `low` \| `medium` \| `high` \| `critical` |
| `suggestions[].rationale` | string | Why this suggestion matters now |
| `analyzed_messages` | number | Number of transcript messages analyzed |

**Error Responses**:

| Status | Body | Description |
|--------|------|-------------|
| 400 | `{"error": "session_id is required"}` | Missing required field |
| 404 | `{"error": "No transcripts available for analysis"}` | No transcript data found |
| 500 | `{"error": "Internal server error"}` | OpenAI API error or database failure |

### Behavior

1. **Fetches Last 20 Messages**: Retrieves most recent transcript entries for context
2. **OpenAI Analysis**: Makes 2 GPT-4o API calls:
   - Say Meter generation (temperature: 0.3, strict scoring)
   - Suggestion generation (temperature: 0.7, creative coaching)
3. **Database Storage**: Saves results to `voice_analysis` table
4. **Real-time Propagation**: Updates automatically broadcast via Supabase Realtime

### Auto-trigger

This endpoint is automatically called by `/api/voice/transcript` every 10 messages:

```typescript
// In /api/voice/transcript
if (count && count % 10 === 0) {
  fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/voice/analyze`, {
    method: 'POST',
    body: JSON.stringify({ session_id, round_number })
  })
}
```

### Say Meter Factors

| Factor | Weight | Description |
|--------|--------|-------------|
| **talk_ratio** | 20% | Candidate should speak 60-70% of the time |
| **question_quality** | 25% | Open-ended, discovery-focused questions |
| **active_listening** | 25% | Building on prospect's responses |
| **pacing** | 15% | Natural pauses, not rushing |
| **objection_handling** | 15% | Acknowledging and reframing concerns |

**Scoring Philosophy**:
- **Strict grading**: Most calls score 40-70
- **80+ is exceptional**: Demonstrates true mastery
- **Below 40 is concerning**: Major skill gaps

### Suggestion Categories

#### 1. Context Injection
Test candidate's ability to adapt to new information.

**Example**:
```json
{
  "category": "context_injection",
  "text": "Mention that their CFO is risk-averse about new vendors.",
  "priority": "medium",
  "rationale": "Tests if candidate can adjust pitch to address financial concerns."
}
```

#### 2. Curveball
Introduce unexpected objections or constraints.

**Example**:
```json
{
  "category": "curveball",
  "text": "The budget was just cut by 30% due to Q4 underperformance.",
  "priority": "high",
  "rationale": "Assesses candidate's ability to pivot and find creative solutions under constraints."
}
```

#### 3. Follow-up Question
Questions the candidate should have asked but didn't.

**Example**:
```json
{
  "category": "followup_question",
  "text": "Ask: 'Who else on your team is affected by this integration issue?'",
  "priority": "critical",
  "rationale": "Candidate missed opportunity to identify all stakeholders, which is essential for multi-threaded selling."
}
```

### Database Schema

Results are stored in the `voice_analysis` table:

```sql
-- Say Meter record
INSERT INTO voice_analysis (
  session_id,
  round_number,
  analysis_type,
  meter_score,
  meter_factors,
  created_at
) VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  1,
  'say_meter',
  65,
  '{"talk_ratio": 70, "question_quality": 75, ...}',
  NOW()
);

-- Suggestion record
INSERT INTO voice_analysis (
  session_id,
  round_number,
  analysis_type,
  suggestion_text,
  suggestion_category,
  priority,
  dismissed,
  created_at
) VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  1,
  'suggestion',
  'Ask: "Who else is affected by this issue?"',
  'followup_question',
  'critical',
  false,
  NOW()
);
```

### Performance Characteristics

| Metric | Value |
|--------|-------|
| **Latency** | 2-4 seconds (2 sequential OpenAI calls) |
| **Cost** | ~$0.02 per analysis (GPT-4o pricing) |
| **Context Window** | Last 20 messages (~2-3 minutes of conversation) |
| **Trigger Frequency** | Every 10 new messages |
| **Concurrent Requests** | Safe (independent per session) |

### Usage Examples

#### cURL
```bash
curl -X POST http://localhost:3000/api/voice/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "550e8400-e29b-41d4-a716-446655440000",
    "round_number": 1
  }'
```

#### JavaScript (fetch)
```javascript
const response = await fetch('/api/voice/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    session_id: '550e8400-e29b-41d4-a716-446655440000',
    round_number: 1
  })
})

const { say_meter, suggestions } = await response.json()
console.log(`Score: ${say_meter.score}`)
console.log(`Suggestions: ${suggestions.length}`)
```

#### TypeScript (with types)
```typescript
interface AnalysisResponse {
  success: boolean
  say_meter: {
    score: number
    factors: {
      talk_ratio: number
      question_quality: number
      active_listening: number
      pacing: number
      objection_handling: number
    }
    summary: string
  }
  suggestions: Array<{
    category: 'context_injection' | 'curveball' | 'followup_question'
    text: string
    priority: 'low' | 'medium' | 'high' | 'critical'
    rationale: string
  }>
  analyzed_messages: number
}

const response = await fetch('/api/voice/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ session_id, round_number: 1 })
})

const data: AnalysisResponse = await response.json()
```

### Real-time Integration

Subscribe to analysis updates in your UI:

```typescript
import { supabase } from '@/lib/supabase/client'

const channel = supabase
  .channel(`voice_analysis:${session_id}`)
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'voice_analysis',
      filter: `session_id=eq.${session_id}`
    },
    (payload) => {
      if (payload.new.analysis_type === 'say_meter') {
        updateSayMeter(payload.new)
      } else if (payload.new.analysis_type === 'suggestion') {
        addSuggestion(payload.new)
      }
    }
  )
  .subscribe()
```

### Environment Variables

Required in `.env.local`:

```bash
OPENAI_API_KEY=sk-...                          # OpenAI API key
NEXT_PUBLIC_APP_URL=http://localhost:3000     # For auto-trigger
NEXT_PUBLIC_SUPABASE_URL=https://...          # Supabase project
NEXT_PUBLIC_SUPABASE_ANON_KEY=...             # Supabase anon key
SUPABASE_SERVICE_ROLE_KEY=...                 # Supabase service key
```

### Monitoring & Debugging

**Console Logs**:
```bash
# Success
✅ Analysis complete for session 550e8400-...: Score 65, 2 suggestions

# Errors
❌ No transcripts found: { message: '...' }
❌ Failed to save meter: { message: '...' }
❌ Analysis error: { message: '...' }
```

**Database Queries**:
```sql
-- Recent analyses
SELECT
  session_id,
  analysis_type,
  meter_score,
  suggestion_category,
  priority,
  created_at
FROM voice_analysis
ORDER BY created_at DESC
LIMIT 20;

-- Performance by session
SELECT
  session_id,
  AVG(meter_score) as avg_score,
  COUNT(CASE WHEN analysis_type = 'suggestion' THEN 1 END) as total_suggestions
FROM voice_analysis
GROUP BY session_id;
```

### Related Endpoints

- **POST /api/voice/transcript** - Save transcript messages (auto-triggers analysis)
- **POST /api/voice/session-secret** - Get ElevenLabs session secret
- **POST /api/voice/elevenlabs-session** - Create voice session
