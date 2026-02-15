# Voice Realtime Testing Guide

Complete end-to-end testing guide for the voice interview feature with real-time updates.

## Prerequisites

Before testing, you MUST enable Supabase Realtime replication. This is why the interviewer view doesn't update in real-time.

### Step 1: Enable Realtime Replication

1. Open **Supabase SQL Editor** (not Table Editor)
2. Run the script: `supabase/enable_realtime.sql`
3. Verify all tables show `ENABLED ✅` in the output

**Critical:** Without this step, the interviewer view will NOT show live updates during calls!

---

## Testing Procedure

### Step 2: Create a Test Session

1. Navigate to `http://localhost:3001/test-voice`
2. Click **"Create Test Session"**
3. Copy the **Session ID** from the response

### Step 3: Open Both Views

Open **two browser tabs side-by-side**:

**Tab 1 (Candidate):**
```
http://localhost:3001/candidate/{sessionId}
```

**Tab 2 (Interviewer):**
```
http://localhost:3001/interviewer/{sessionId}
```

### Step 4: Start the Call

**In Candidate tab:**
1. Click **"Start Call"**
2. Allow microphone access when prompted
3. Wait for connection status: "Connected"
4. Start talking to the AI prospect

**What to expect:**
- Audio connection indicator should turn green
- You should hear the AI prospect speaking
- Your speech should be transcribed in real-time

### Step 5: Verify Real-Time Updates in Interviewer View

**In Interviewer tab, you should see:**

✅ **Live Transcript** panel updating with each message:
- "Candidate: [your message]"
- "Prospect: [AI response]"
- Timestamps for each entry

✅ **AI Observations** panel (appears after ~30 seconds):
- Observations grouped by dimension
- Severity indicators (info/concern/red flag)
- Summary stats at the bottom

✅ **Voice Control Panel** is active:
- Difficulty dial enabled (1-5)
- Curveball buttons clickable

### Step 6: Test Interviewer Controls

**Adjust Difficulty:**
1. In Interviewer tab, move the difficulty slider
2. Continue the conversation in Candidate tab
3. Notice the AI prospect's behavior changes

**Inject Curveball:**
1. Click a curveball button (e.g., "Budget Cut")
2. Continue talking in Candidate tab
3. AI prospect should introduce the objection

### Step 7: End Call and Check Scoring

**In Candidate tab:**
1. Click **"End Call"**
2. Transcript should save automatically

**In Interviewer tab:**
1. **Gate Panel** should update with final scores
2. **Overall Score** should display (0-100)
3. **Dimensions** should show scores for each criterion
4. **Red Flags** should list any concerns
5. **Follow-ups** should suggest probing questions

---

## Troubleshooting

### Issue: Interviewer view not updating during call

**Check 1: Realtime enabled?**
```sql
-- Run in SQL Editor
SELECT tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename IN ('live_events', 'ai_assessments', 'scores');
```
Should return 3 rows. If not, run `enable_realtime.sql`.

**Check 2: Browser console errors?**
- Open DevTools (F12) in both tabs
- Check Console for subscription errors
- Look for "SUBSCRIBED" messages

**Check 3: Data being saved?**
```sql
-- Run in SQL Editor
SELECT * FROM live_events
WHERE session_id = 'your-session-id'
ORDER BY created_at DESC
LIMIT 10;
```
If no data, the issue is in the candidate view publishing.

### Issue: No AI observations appearing

**Check 1: Conversation long enough?**
- AI assessments trigger after 4+ messages
- Wait at least 30 seconds after starting the call

**Check 2: Assessment API working?**
```sql
-- Check ai_assessments table
SELECT * FROM ai_assessments
WHERE session_id = 'your-session-id';
```

If empty, check `/api/ai/assess` endpoint logs in terminal.

### Issue: No final scores after call ends

**Check 1: Transcript saved?**
```sql
SELECT * FROM artifacts
WHERE session_id = 'your-session-id'
  AND artifact_type = 'transcript';
```

**Check 2: Scoring triggered?**
```sql
SELECT * FROM scores
WHERE session_id = 'your-session-id';
```

If no scores, manually trigger:
```javascript
// Run in Candidate tab console after ending call
const sessionId = window.location.pathname.split('/').pop()
await fetch('/api/score/trigger', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ session_id: sessionId, round_number: 1 })
}).then(r => r.json()).then(console.log)
```

---

## Expected Behavior Summary

| Timestamp | Candidate View | Interviewer View |
|-----------|----------------|------------------|
| T+0s | Click "Start Call" | Round status changes to "active" |
| T+2s | "Connected" status | Voice Control Panel activates |
| T+5s | AI speaks first message | Transcript shows first message |
| T+10s | User responds | Transcript updates with user message |
| T+30s | Conversation continues | First AI observation appears |
| T+60s | Interviewer changes difficulty | AI behavior shifts mid-call |
| T+90s | Click "End Call" | Final scores appear in Gate Panel |

---

## Success Criteria

✅ **Real-time transcript** - Messages appear in interviewer view within 1-2 seconds
✅ **AI observations** - At least 2-3 observations after 60 seconds
✅ **Live controls** - Difficulty changes affect AI behavior mid-call
✅ **Final scoring** - Gate Panel shows scores within 5 seconds of call ending
✅ **No console errors** - Both tabs run without subscription errors

---

## Debug SQL Queries

If you encounter issues, use these queries in SQL Editor:

```sql
-- View all data for a session
SELECT
  'session' as type,
  to_jsonb(s.*) as data
FROM interview_sessions s
WHERE s.id = 'your-session-id'

UNION ALL

SELECT
  'events' as type,
  jsonb_agg(to_jsonb(e.*)) as data
FROM live_events e
WHERE e.session_id = 'your-session-id'

UNION ALL

SELECT
  'assessments' as type,
  jsonb_agg(to_jsonb(a.*)) as data
FROM ai_assessments a
WHERE a.session_id = 'your-session-id'

UNION ALL

SELECT
  'scores' as type,
  jsonb_agg(to_jsonb(sc.*)) as data
FROM scores sc
WHERE sc.session_id = 'your-session-id';
```

---

## Next Steps After Successful Test

Once real-time updates are working:

1. **Polish UI/UX** - Improve visual feedback, loading states, error handling
2. **Add persona/scenario selection** - Let interviewer choose different prospect types
3. **Improve AI prompts** - Refine difficulty levels and curveball behaviors
4. **Add call recording** - Save audio files for playback
5. **Export reports** - Generate PDF summaries of call performance
