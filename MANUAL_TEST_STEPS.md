# Manual Testing Steps

## Current Session: e497860a-9d1d-43da-b224-82f8573a6cb2

### Step 1: Check Call Status

**In Candidate Tab** (`http://localhost:3001/candidate/e497860a-9d1d-43da-b224-82f8573a6cb2`):

1. Look at the connection indicator - is it green (Connected) or gray (Disconnected)?
2. Is the "End Call" button visible and clickable?
3. Open browser console (F12) - any errors?

### Step 2: If Call is Still Active

**End the call properly:**
1. Click the **"End Call"** button in candidate tab
2. Watch the console for these logs:
   ```
   ✅ Transcript saved to artifacts
   🎯 Final scoring triggered
   ```
3. Wait 5-10 seconds for processing

### Step 3: Check Interviewer View Updates

**In Interviewer Tab** (`http://localhost:3001/interviewer/e497860a-9d1d-43da-b224-82f8573a6cb2`):

After ending the call, the **Gate Panel** should update with:
- Overall Score (0-100)
- Dimension Scores (bars)
- Red Flags (if any)
- Follow-up questions

**If it doesn't update:**
1. Hard refresh the page (Cmd+Shift+R)
2. Check if scores appear after refresh

### Step 4: Check AI Observations

During an active call (while talking):
1. Have a conversation for **at least 60 seconds**
2. Exchange **at least 6-8 messages** (3-4 from you, 3-4 from AI)
3. Check candidate tab console for:
   ```
   🤖 AI assessment triggered
   ```
   This should appear every 30 seconds

4. Refresh interviewer tab - **AI Observations** panel should show observations

### Step 5: Verify Data in Database

Run this in **Supabase SQL Editor**:

```sql
-- Quick check: Does this session have any data?
SELECT
  (SELECT COUNT(*) FROM live_events WHERE session_id = 'e497860a-9d1d-43da-b224-82f8573a6cb2') as events,
  (SELECT COUNT(*) FROM ai_assessments WHERE session_id = 'e497860a-9d1d-43da-b224-82f8573a6cb2') as assessments,
  (SELECT COUNT(*) FROM scores WHERE session_id = 'e497860a-9d1d-43da-b224-82f8573a6cb2') as scores,
  (SELECT COUNT(*) FROM artifacts WHERE session_id = 'e497860a-9d1d-43da-b224-82f8573a6cb2') as artifacts;
```

**Expected results after ending a call:**
- events: 10+ (voice_transcript events)
- assessments: 1-3 (depends on call duration)
- scores: 1 (final score)
- artifacts: 1 (transcript)

---

## Troubleshooting Specific Issues

### Issue: Live Transcript Not Showing

**Cause:** Transcript events not being published to live_events table

**Debug:**
```sql
SELECT COUNT(*), event_type
FROM live_events
WHERE session_id = 'e497860a-9d1d-43da-b224-82f8573a6cb2'
GROUP BY event_type;
```

**Expected:** Should see `voice_transcript` with count > 0

**If count is 0:**
- Check candidate tab console for errors when speaking
- Check Network tab for failed POST requests

### Issue: AI Observations Empty

**Cause 1:** Call was too short (< 30 seconds)
- **Fix:** Start a new call and talk for at least 60 seconds

**Cause 2:** Not enough messages (< 4)
- **Fix:** Exchange at least 6-8 messages with the AI

**Cause 3:** Assessment API failing
- **Debug:** Check candidate tab console for:
  ```
  Assessment trigger failed: [error]
  ```

### Issue: Gate Panel Shows No Scores

**Cause 1:** Call not ended yet
- **Fix:** Click "End Call" button

**Cause 2:** No transcript artifact
- **Check:**
  ```sql
  SELECT * FROM artifacts
  WHERE session_id = 'e497860a-9d1d-43da-b224-82f8573a6cb2';
  ```
- **Fix:** Manually trigger scoring (see DEBUG_BROWSER_CONSOLE.md)

**Cause 3:** Scoring API failed
- **Check:** Dev server terminal for `/api/score/trigger` errors

---

## Expected Timeline

| Time | What Should Happen |
|------|-------------------|
| T+0s | Click "Start Call" in candidate tab |
| T+2s | Connection established, AI speaks first |
| T+10s | You respond, transcript appears in interviewer tab |
| T+30s | First AI assessment triggers (console log) |
| T+60s | Second AI assessment, observations visible in interviewer tab |
| T+90s | Click "End Call" |
| T+95s | Transcript saved, scoring triggered |
| T+100s | Final scores appear in Gate Panel |

---

## Next Steps

1. **If call is still active:** End it using "End Call" button
2. **Check all query results** from debug script
3. **Share the complete output** so I can see what data exists
4. **Check both browser consoles** for errors

If you want to start fresh with better logging, we can create a new test session and monitor it step-by-step.
