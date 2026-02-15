import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { renderPromptTemplate } from '@/lib/ai/prompt-renderer'
import type { Persona, Scenario, VoiceRealtimeRoundConfig, Round } from '@/lib/types/database'

export async function POST(request: Request) {
  try {
    const { session_id, difficulty } = await request.json()

    if (!session_id) {
      return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })
    }

    // Step 1: Fetch session data to get persona_id and scenario_id from round config
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('interview_sessions')
      .select('*')
      .eq('id', session_id)
      .single()

    if (sessionError) {
      console.error('Failed to fetch session:', sessionError)
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Step 2: Fetch scope package to get round config
    const { data: scopePackage, error: scopeError } = await supabaseAdmin
      .from('interview_scope_packages')
      .select('*')
      .eq('session_id', session_id)
      .single()

    if (scopeError) {
      console.error('Failed to fetch scope package:', scopeError)
      return NextResponse.json({ error: 'Scope package not found' }, { status: 404 })
    }

    // Step 3: Find the voice-realtime round
    const voiceRound = (scopePackage.round_plan as Round[]).find(
      (r) => r.round_type === 'voice-realtime'
    )

    if (!voiceRound) {
      return NextResponse.json(
        { error: 'No voice-realtime round found in session' },
        { status: 404 }
      )
    }

    const roundConfig = voiceRound.config as VoiceRealtimeRoundConfig
    const personaId = roundConfig.persona_id
    const scenarioId = roundConfig.scenario_id
    const difficultyLevel = difficulty || roundConfig.initial_difficulty || 3

    // Step 3.5: Check if agent already exists (for reconnections)
    const existingAgentId = (roundConfig as any).agent_id

    if (existingAgentId && (voiceRound.status === 'active' || voiceRound.status === 'pending')) {
      console.log('🔄 Reusing existing agent:', existingAgentId)
      const wsUrl = `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${existingAgentId}`

      return NextResponse.json({
        ws_url: wsUrl,
        agent_id: existingAgentId,
        session_id,
        difficulty: difficultyLevel,
        reused: true
      })
    }

    // Only allow agent creation if round is pending or active
    if (voiceRound.status !== 'pending' && voiceRound.status !== 'active') {
      console.warn('Voice round is not in pending/active state:', voiceRound.status)
      return NextResponse.json(
        { error: 'Voice round must be pending or active to create agent' },
        { status: 400 }
      )
    }

    // Step 4: Fetch persona (use default if not specified)
    let persona: Persona | null = null

    if (personaId) {
      const { data, error } = await supabaseAdmin
        .from('personas')
        .select('*')
        .eq('id', personaId)
        .single()

      if (error) {
        console.warn('Failed to fetch persona by ID, using default:', error)
      } else {
        persona = data
      }
    }

    // Fallback: Get first active persona matching track and difficulty
    if (!persona) {
      const { data, error } = await supabaseAdmin
        .from('personas')
        .select('*')
        .eq('blueprint', scopePackage.track)
        .eq('difficulty', difficultyLevel)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error) {
        console.error('Failed to fetch default persona:', error)
        return NextResponse.json(
          { error: 'No active persona found for this track and difficulty' },
          { status: 404 }
        )
      }

      persona = data
    }

    if (!persona) {
      return NextResponse.json(
        { error: 'No persona found for this session' },
        { status: 404 }
      )
    }

    // Step 5: Fetch scenario (optional)
    let scenario: Scenario | null = null

    if (scenarioId) {
      const { data, error } = await supabaseAdmin
        .from('scenarios')
        .select('*')
        .eq('id', scenarioId)
        .single()

      if (error) {
        console.warn('Failed to fetch scenario:', error)
      } else {
        scenario = data
      }
    }

    // Fallback: Get first scenario if none specified
    if (!scenario) {
      const { data } = await supabaseAdmin
        .from('scenarios')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      scenario = data || null
    }

    // Step 6: Render prompt templates
    const renderContext = {
      persona: {
        name: persona.name,
        role: persona.role,
        company_context: persona.company_context,
        personality_traits: persona.personality_traits,
        communication_style: persona.communication_style,
        objection_patterns: persona.objection_patterns,
        difficulty: persona.difficulty
      },
      scenario: scenario
        ? {
            title: scenario.title,
            description: scenario.description,
            industry: scenario.industry,
            company_size: scenario.company_size,
            pain_points: scenario.pain_points,
            budget_range: scenario.budget_range,
            decision_timeline: scenario.decision_timeline
          }
        : undefined
    }

    const systemPrompt = renderPromptTemplate(persona.prompt_template, renderContext)
    const firstMessage = renderPromptTemplate(
      persona.first_message_template,
      renderContext
    )

    console.log('📝 Rendered system prompt:', systemPrompt.substring(0, 200) + '...')
    console.log('📝 Rendered first message:', firstMessage)

    // Step 6.5: Sanitize inputs to prevent API quota exhaustion or malicious content
    const MAX_PROMPT_LENGTH = 10000
    const MAX_FIRST_MESSAGE_LENGTH = 500

    const sanitizedPrompt = systemPrompt.substring(0, MAX_PROMPT_LENGTH)
    const sanitizedFirstMessage = firstMessage.substring(0, MAX_FIRST_MESSAGE_LENGTH)

    // Step 7: Create ElevenLabs agent dynamically
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY

    if (!elevenLabsApiKey) {
      return NextResponse.json(
        { error: 'ElevenLabs API key not configured' },
        { status: 500 }
      )
    }

    const agentResponse = await fetch('https://api.elevenlabs.io/v1/convai/agents/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': elevenLabsApiKey
      },
      body: JSON.stringify({
        name: `${persona.name} - Session ${session_id.substring(0, 8)}`,
        conversation_config: {
          agent: {
            prompt: {
              prompt: sanitizedPrompt
            },
            first_message: sanitizedFirstMessage,
            language: 'en'
          }
        }
      })
    })

    if (!agentResponse.ok) {
      const errorText = await agentResponse.text()
      console.error('ElevenLabs agent creation failed:', errorText)
      return NextResponse.json(
        { error: `Failed to create ElevenLabs agent: ${errorText}` },
        { status: 500 }
      )
    }

    const agentData = await agentResponse.json()
    const agentId = agentData.agent_id

    if (!agentId) {
      console.error('No agent_id in response:', agentData)
      return NextResponse.json(
        { error: 'Failed to get agent ID from ElevenLabs' },
        { status: 500 }
      )
    }

    console.log('✅ Created ElevenLabs agent:', agentId)

    // Step 8: Store agent_id in round config for reuse on reconnection
    const updatedRoundPlan = (scopePackage.round_plan as Round[]).map((r) => {
      if (r.round_type === 'voice-realtime') {
        return {
          ...r,
          config: {
            ...r.config,
            agent_id: agentId
          }
        }
      }
      return r
    })

    await supabaseAdmin
      .from('interview_scope_packages')
      .update({ round_plan: updatedRoundPlan })
      .eq('session_id', session_id)

    // Step 9: Log agent creation to live_events for audit trail
    await supabaseAdmin.from('live_events').insert({
      session_id: session_id,
      event_type: 'elevenlabs_agent_created',
      payload: {
        agent_id: agentId,
        persona_id: persona.id,
        persona_name: persona.name,
        scenario_id: scenario?.id || null,
        difficulty: difficultyLevel,
        rendered_prompt_preview: sanitizedPrompt.substring(0, 500),
        first_message: sanitizedFirstMessage
      }
    })

    // Step 10: Return agent_id to client
    const wsUrl = `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${agentId}`

    return NextResponse.json({
      ws_url: wsUrl,
      agent_id: agentId,
      session_id,
      difficulty: difficultyLevel,
      persona: {
        name: persona.name,
        role: persona.role
      },
      scenario: scenario
        ? {
            title: scenario.title,
            industry: scenario.industry
          }
        : null
    })
  } catch (error: any) {
    console.error('ElevenLabs session creation error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
