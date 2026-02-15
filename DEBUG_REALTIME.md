# Real-Time Debugging Guide

## Check if updates are being published

### 1. Check Live Events Table
```sql
-- Run in Supabase SQL Editor
SELECT * FROM live_events
WHERE session_id = 'YOUR_SESSION_ID'
ORDER BY created_at DESC
LIMIT 20;
```

Look for `voice_transcript` events.

### 2. Check AI Assessments Table
```sql
SELECT * FROM ai_assessments
WHERE session_id = 'YOUR_SESSION_ID'
ORDER BY created_at DESC;
```

### 3. Check Artifacts Table
```sql
SELECT * FROM artifacts
WHERE session_id = 'YOUR_SESSION_ID';
```

### 4. Check Scores Table
```sql
SELECT * FROM scores
WHERE session_id = 'YOUR_SESSION_ID';
```

---

## Browser Console Checks

### In Candidate View Console:
```javascript
// Check if transcript events are publishing
const sessionId = window.location.pathname.split('/').pop()

// Monitor Supabase channels
console.log('Active channels:', window.supabase?.getChannels())

// Manually trigger an assessment
fetch('/api/ai/assess', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    session_id: sessionId,
    round_number: 1,
    transcript: [
      { role: 'user', text: 'Tell me about your product', timestamp: Date.now() },
      { role: 'assistant', text: 'Sure! We help companies...', timestamp: Date.now() }
    ]
  })
}).then(r => r.json()).then(console.log)
```

### In Interviewer View Console:
```javascript
const sessionId = window.location.pathname.split('/').pop()

// Check active subscriptions
console.log('Supabase channels:', window.supabase?.getChannels())

// Check if session context is loaded
console.log('Session data:', sessionData)
console.log('Events:', events)
console.log('Scores:', scores)

// Test live_events subscription
const testChannel = supabase.channel('test-live-events')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'live_events',
    filter: `session_id=eq.${sessionId}`
  }, (payload) => {
    console.log('✅ New live event detected:', payload)
  })
  .subscribe()
```

---

## Common Issues

### Issue 1: Supabase Realtime not enabled
**Check:** Go to Supabase Dashboard → Database → Replication
**Fix:** Enable replication for these tables:
- `live_events`
- `ai_assessments`
- `scores`
- `artifacts`

### Issue 2: RLS (Row Level Security) blocking access
**Check:**
```sql
SELECT * FROM pg_policies WHERE tablename IN ('live_events', 'ai_assessments', 'scores');
```

**Fix:** Temporarily disable RLS for testing:
```sql
ALTER TABLE live_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE ai_assessments DISABLE ROW LEVEL SECURITY;
ALTER TABLE scores DISABLE ROW LEVEL SECURITY;
```

### Issue 3: SessionContext not re-rendering
**Check:** Browser console for errors
**Fix:** Hard refresh both tabs (Cmd+Shift+R)

---

## Common Dashboard Errors

### Issue 4: SQL query error in Table Editor
**Error:** `invalid input syntax for type boolean: "uuid" LINE 3: SELECT * FROM scores WHERE 'uuid'`

**Cause:** Supabase Dashboard Table Editor generates malformed queries when filters are applied incorrectly.

**Fix:** Use the **SQL Editor** instead of the Table Editor to view data:
```sql
-- Run supabase/debug_scores.sql in SQL Editor
SELECT * FROM scores WHERE session_id = 'your-session-id' ORDER BY created_at DESC;
```

Or clear all filters in the Table Editor and refresh the page.

---

## Quick Test Script

Run this in **Candidate View** after starting a call:

```javascript
(async () => {
  const sessionId = window.location.pathname.split('/').pop()
  const { supabase } = await import('@/lib/supabase/client')

  console.log('📝 Publishing test transcript event...')

  await supabase.from('live_events').insert({
    session_id: sessionId,
    event_type: 'voice_transcript',
    payload: {
      role: 'user',
      text: 'Test message from candidate',
      timestamp: Date.now()
    }
  })

  console.log('✅ Event published! Check interviewer view.')
})()
```

Check if this appears in the **Interviewer View** Live Transcript panel.
