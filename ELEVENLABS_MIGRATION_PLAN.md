# ElevenLabs Conversational AI Migration Plan

## Why ElevenLabs Over OpenAI Realtime API

### Problem with OpenAI
- **WebRTC mode**: Audio works but conversation events aren't captured through data channel
- **No transcript**: Can't track what user/AI say in real-time
- **Gateway panel broken**: No live monitoring because no events
- **Complex debugging**: WebRTC + data channel architecture is opaque

### Benefits of ElevenLabs
- ✅ **Single WebSocket connection** for both audio AND events
- ✅ **Built-in transcript events** (`user_transcript`, `agent_response`)
- ✅ **Natural interruption handling** (user can interrupt AI mid-sentence)
- ✅ **Contextual updates** (inject difficulty/curveballs without interrupting)
- ✅ **Real-time monitoring** (all events come through WebSocket)
- ✅ **Better voice quality** (ElevenLabs specializes in TTS)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ElevenLabs Platform                          │
│  ┌─────────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │   Agent     │→ │   LLM    │→ │   TTS    │→ │ Audio Stream │   │
│  │ (Dashboard) │  │ (GPT-4o) │  │ (11Labs) │  │  (WebSocket) │   │
│  └─────────────┘  └──────────┘  └──────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                ↕
                    WebSocket Connection (Bidirectional)
                    wss://api.elevenlabs.io/v1/convai/conversation
                                ↕
┌─────────────────────────────────────────────────────────────────────┐
│                      Your Next.js Application                        │
│                                                                       │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  Server-side API Routes (/api/voice/*)                        │ │
│  │  - Generate signed WebSocket URL (with ElevenLabs API key)    │ │
│  │  - Create agents dynamically (for difficulty levels)          │ │
│  │  - Store conversation metadata                                │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                ↕                                      │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  useVoiceRealtime Hook (Client-side)                          │ │
│  │  - Connect to WebSocket with signed URL                       │ │
│  │  - Send: user_audio_chunk (from microphone)                   │ │
│  │  - Receive: user_transcript, agent_response, audio chunks     │ │
│  │  - Publish events to Supabase live_events table               │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                ↕                                      │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  VoiceRealtimeUI Component                                     │ │
│  │  - Display live transcript                                     │ │
│  │  - Show connection status                                      │ │
│  │  - Save transcript on disconnect                               │ │
│  └───────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

## ElevenLabs WebSocket Message Protocol

### Messages Sent (Client → ElevenLabs)

1. **user_audio_chunk**
   ```json
   {
     "type": "user_audio_chunk",
     "audio": "base64-encoded-pcm-audio"
   }
   ```

2. **context_update** (for difficulty/curveball injection)
   ```json
   {
     "type": "context_update",
     "text": "INJECT: Budget was just cut by 50%"
   }
   ```

### Messages Received (ElevenLabs → Client)

1. **conversation_initiation_metadata**
   ```json
   {
     "type": "conversation_initiation_metadata",
     "conversation_id": "uuid",
     "audio_format": "pcm_16000"
   }
   ```

2. **user_transcript**
   ```json
   {
     "type": "user_transcript",
     "text": "What's your pricing model?",
     "timestamp": 1234567890
   }
   ```

3. **agent_response**
   ```json
   {
     "type": "agent_response",
     "text": "Our pricing starts at $99/month...",
     "timestamp": 1234567890
   }
   ```

4. **audio** (audio chunks from TTS)
   ```json
   {
     "type": "audio",
     "audio": "base64-encoded-pcm-audio"
   }
   ```

5. **interruption**
   ```json
   {
     "type": "interruption"
   }
   ```

## Implementation Steps

### Step 1: Create ElevenLabs Agent (Dashboard)

1. Go to [ElevenLabs Dashboard](https://elevenlabs.io/app)
2. Create new agent: "Sales Discovery Prospect - Medium Difficulty"
3. Configure prompt:
   ```
   You are Alex Morgan, a sales prospect in a discovery call.
   You're moderately skeptical with competing priorities and need
   strong evidence of value. Raise 2-3 objections during the call.
   ```
4. Set initial message: "Hi, I have about 15 minutes for this call. What's this about?"
5. Get `agent_id` from dashboard

### Step 2: Server-side API Routes

**File: `/api/voice/elevenlabs-session/route.ts`**
```typescript
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { session_id, difficulty } = await request.json()

  // Map difficulty to agent_id
  const agentIds = {
    1: process.env.ELEVENLABS_AGENT_EASY,
    2: process.env.ELEVENLABS_AGENT_MODERATE,
    3: process.env.ELEVENLABS_AGENT_MEDIUM,
    4: process.env.ELEVENLABS_AGENT_HARD,
    5: process.env.ELEVENLABS_AGENT_EXPERT
  }

  const agentId = agentIds[difficulty as keyof typeof agentIds]

  // Generate signed WebSocket URL (for security)
  // For public agents, you can use: wss://api.elevenlabs.io/v1/convai/conversation?agent_id={agentId}
  // For private agents, call ElevenLabs API to get signed URL

  const wsUrl = `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${agentId}`

  return NextResponse.json({ ws_url: wsUrl, agent_id: agentId })
}
```

### Step 3: Refactor useVoiceRealtime Hook

**File: `/hooks/useVoiceRealtime.ts`**
```typescript
// Replace WebRTC logic with WebSocket
const connect = async () => {
  // 1. Get signed WebSocket URL from our API
  const response = await fetch('/api/voice/elevenlabs-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: config.sessionId,
      difficulty: config.difficulty || 3
    })
  })

  const { ws_url } = await response.json()

  // 2. Get user's microphone
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

  // 3. Connect WebSocket
  const ws = new WebSocket(ws_url)

  ws.onopen = () => {
    console.log('✅ Connected to ElevenLabs')
    // Start sending audio chunks
    startAudioStream(stream, ws)
  }

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data)
    handleElevenLabsMessage(message)
  }
}

const handleElevenLabsMessage = (message: any) => {
  switch (message.type) {
    case 'conversation_initiation_metadata':
      // Store conversation_id
      break

    case 'user_transcript':
      // Add to transcript state
      setTranscript(prev => [...prev, {
        role: 'user',
        text: message.text,
        timestamp: Date.now()
      }])

      // Publish to live_events for interviewer view
      supabase.from('live_events').insert({
        session_id: config.sessionId,
        event_type: 'voice_transcript',
        payload: { role: 'user', text: message.text }
      })
      break

    case 'agent_response':
      // Add to transcript state
      setTranscript(prev => [...prev, {
        role: 'assistant',
        text: message.text,
        timestamp: Date.now()
      }])

      // Publish to live_events
      supabase.from('live_events').insert({
        session_id: config.sessionId,
        event_type: 'voice_transcript',
        payload: { role: 'assistant', text: message.text }
      })
      break

    case 'audio':
      // Play audio chunk
      playAudioChunk(message.audio)
      break
  }
}
```

### Step 4: Environment Variables

Add to `.env.local`:
```bash
ELEVENLABS_API_KEY=sk_...
ELEVENLABS_AGENT_EASY=agent_id_1
ELEVENLABS_AGENT_MODERATE=agent_id_2
ELEVENLABS_AGENT_MEDIUM=agent_id_3
ELEVENLABS_AGENT_HARD=agent_id_4
ELEVENLABS_AGENT_EXPERT=agent_id_5
```

### Step 5: Difficulty Adjustment & Curveballs

ElevenLabs supports **contextual updates** that don't interrupt:
```typescript
// In handleVoiceCommand function
if (command.command_type === 'difficulty_change') {
  ws.send(JSON.stringify({
    type: 'context_update',
    text: `System note: Adjust difficulty to level ${difficulty}`
  }))
}

if (command.command_type === 'curveball_inject') {
  ws.send(JSON.stringify({
    type: 'context_update',
    text: getCurveballPrompt(command.payload.curveball)
  }))
}
```

## Migration Checklist

- [ ] Create 5 ElevenLabs agents (1 per difficulty level)
- [ ] Add ElevenLabs API key and agent IDs to `.env.local`
- [ ] Create `/api/voice/elevenlabs-session/route.ts` endpoint
- [ ] Refactor `useVoiceRealtime.ts` to use WebSocket instead of WebRTC
- [ ] Update message handlers to use ElevenLabs event types
- [ ] Implement audio playback for received audio chunks
- [ ] Test transcript capture in real-time
- [ ] Verify Gateway Panel shows live assessments
- [ ] Test difficulty adjustment and curveball injection
- [ ] Test end-to-end scoring

## Timeline Estimate

- **Day 1**: Setup agents + API routes (3 hours)
- **Day 2**: Refactor useVoiceRealtime hook (4 hours)
- **Day 3**: Test and debug (2-3 hours)

**Total: 2-3 days**

## Sources
- [ElevenLabs Conversational AI Platform](https://elevenlabs.io/conversational-ai)
- [WebSocket Documentation](https://elevenlabs.io/docs/agents-platform/libraries/web-sockets)
- [Agent API Reference](https://elevenlabs.io/docs/api-reference/agents/create)
- [Real-time Monitoring Guide](https://elevenlabs.io/docs/agents-platform/guides/realtime-monitoring)
