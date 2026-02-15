# Browser Console Debugging

## Check Console in Interviewer View

Open DevTools (F12) in the **interviewer tab** and look for:

### 1. Subscription Status

You should see messages like:
```
SUBSCRIBED: session:e497860a-9d1d-43da-b224-82f8573a6cb2
SUBSCRIBED: scope:e497860a-9d1d-43da-b224-82f8573a6cb2
SUBSCRIBED: scores:e497860a-9d1d-43da-b224-82f8573a6cb2
SUBSCRIBED: events:e497860a-9d1d-43da-b224-82f8573a6cb2
SUBSCRIBED: ai-assessments-e497860a-9d1d-43da-b224-82f8573a6cb2
```

If you see `CHANNEL_ERROR` or subscription failures, that's the issue.

### 2. Check Realtime Connection

Run this in the console:
```javascript
// Check active Supabase channels
const channels = window.supabase?.getChannels?.()
console.log('Active channels:', channels)

// Check if subscribed
channels?.forEach(ch => {
  console.log(`Channel ${ch.topic}: ${ch.state}`)
})
```

Should show 4-5 channels in "joined" state.

### 3. Manually Check AI Assessments

Run this in the console:
```javascript
const sessionId = 'e497860a-9d1d-43da-b224-82f8573a6cb2'

// Fetch AI assessments
const { data: assessments, error } = await supabase
  .from('ai_assessments')
  .select('*')
  .eq('session_id', sessionId)
  .order('created_at', { ascending: false })

console.log('AI Assessments:', assessments)
console.log('Error:', error)
```

### 4. Manually Check Scores

```javascript
const sessionId = 'e497860a-9d1d-43da-b224-82f8573a6cb2'

// Fetch scores
const { data: scores, error } = await supabase
  .from('scores')
  .select('*')
  .eq('session_id', sessionId)
  .order('created_at', { ascending: false })

console.log('Scores:', scores)
console.log('Error:', error)
```

### 5. Check if AIAssessmentsPanel is Mounted

```javascript
// Check React component state
const assessmentPanel = document.querySelector('[class*="AIAssessments"]')
console.log('AI Assessments Panel exists:', !!assessmentPanel)

const gatePanel = document.querySelector('[class*="GatePanel"]')
console.log('Gate Panel exists:', !!gatePanel)
```

---

## Common Issues

### Issue: No assessments in database
**Cause:** AI assessment endpoint not being called from candidate view
**Check:** Open candidate tab console and look for:
- `🤖 AI assessment triggered` logs every 30 seconds
- Network tab shows POST to `/api/ai/assess`

### Issue: Assessments exist but panel is empty
**Cause:** Real-time subscription not receiving updates
**Fix:** Hard refresh interviewer tab (Cmd+Shift+R)

### Issue: No scores in database
**Cause:** Scoring not triggered when call ends
**Check:** Candidate tab console should show:
- `✅ Transcript saved to artifacts`
- `🎯 Final scoring triggered`

### Issue: RLS blocking access
**Cause:** Row Level Security might be blocking client queries
**Fix:** Run in SQL Editor:
```sql
-- Temporarily disable RLS for testing
ALTER TABLE ai_assessments DISABLE ROW LEVEL SECURITY;
ALTER TABLE scores DISABLE ROW LEVEL SECURITY;
```

---

## Manual Trigger AI Assessment

If assessments aren't generating automatically, trigger manually from **candidate tab** console:

```javascript
const sessionId = window.location.pathname.split('/').pop()

// Get current transcript
const transcript = [
  { role: 'user', text: 'Tell me about your product', timestamp: Date.now() - 20000 },
  { role: 'assistant', text: 'Our product helps companies automate their workflows...', timestamp: Date.now() - 15000 },
  { role: 'user', text: 'How much does it cost?', timestamp: Date.now() - 10000 },
  { role: 'assistant', text: 'We have flexible pricing starting at $99/month...', timestamp: Date.now() - 5000 }
]

// Trigger assessment
const response = await fetch('/api/ai/assess', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    session_id: sessionId,
    round_number: 1,
    transcript
  })
})

const result = await response.json()
console.log('Assessment result:', result)
```

---

## Manual Trigger Scoring

If scores aren't generating when call ends, trigger manually:

```javascript
const sessionId = window.location.pathname.split('/').pop()

const response = await fetch('/api/score/trigger', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    session_id: sessionId,
    round_number: 1
  })
})

const result = await response.json()
console.log('Scoring result:', result)
```
