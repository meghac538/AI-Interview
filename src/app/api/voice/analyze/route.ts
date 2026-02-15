import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(request: Request) {
  try {
    const { session_id, round_number } = await request.json()

    // Step 1: Validate input
    if (!session_id) {
      return NextResponse.json(
        { error: 'session_id is required' },
        { status: 400 }
      )
    }

    // Step 2: Fetch recent transcripts (last 20 messages)
    const { data: transcripts, error: transcriptError } = await supabaseAdmin
      .from('voice_transcripts')
      .select('*')
      .eq('session_id', session_id)
      .eq('round_number', round_number || 1)
      .order('timestamp', { ascending: true })
      .limit(20)

    if (transcriptError || !transcripts || transcripts.length === 0) {
      console.error('No transcripts found:', transcriptError)
      return NextResponse.json(
        { error: 'No transcripts available for analysis' },
        { status: 404 }
      )
    }

    const recentMessages = transcripts

    // Step 3: Build conversation context for OpenAI
    const conversationText = recentMessages
      .map(t => `${t.role === 'user' ? 'Candidate' : 'Interviewer'}: ${t.text}`)
      .join('\n\n')

    // Step 4: Analyze with OpenAI - Say Meter
    const sayMeterPrompt = `You are analyzing a sales discovery call between a candidate (user) and an AI prospect (assistant).

Conversation excerpt:
${conversationText}

Analyze the candidate's performance and provide a "Say Meter" health score (0-100) based on these factors:

1. **Talk ratio** - Candidate should speak 60-70% of the time (ideal)
2. **Question quality** - Are they asking discovery questions?
3. **Active listening** - Do they build on prospect's responses?
4. **Pacing** - Are they rushing or giving space for thought?
5. **Objection handling** - How do they respond to pushback?

Return JSON:
{
  "score": <number 0-100>,
  "factors": {
    "talk_ratio": <number 0-100>,
    "question_quality": <number 0-100>,
    "active_listening": <number 0-100>,
    "pacing": <number 0-100>,
    "objection_handling": <number 0-100>
  },
  "summary": "<2 sentence explanation>"
}

Be strict but fair. Most calls should score 40-70. Only exceptional performance scores 80+.`

    const sayMeterResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: sayMeterPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3
    })

    const sayMeterResult = JSON.parse(sayMeterResponse.choices[0].message.content || '{}')

    // Step 5: Analyze with OpenAI - Suggestions
    const suggestionsPrompt = `You are a sales coach watching this discovery call.

Conversation:
${conversationText}

Generate 1-3 actionable suggestions for the interviewer. Focus on HIGH-IMPACT interventions.

Categories:
- **context_injection**: Inject a detail about the prospect's situation to test if candidate picks up on it
- **curveball**: Add a surprise objection or constraint to see how candidate adapts
- **followup_question**: Specific question the candidate should have asked but didn't

Return JSON object:
{
  "suggestions": [
    {
      "category": "<context_injection|curveball|followup_question>",
      "text": "<specific actionable suggestion>",
      "priority": "<low|medium|high|critical>",
      "rationale": "<why this matters now>"
    }
  ]
}

Be selective. Only suggest if there's a clear gap or opportunity. Empty array is fine.`

    const suggestionsResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: suggestionsPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7
    })

    const suggestionsResult = JSON.parse(suggestionsResponse.choices[0].message.content || '{"suggestions":[]}')
    const suggestions = suggestionsResult.suggestions || []

    // Step 6: Save Say Meter to voice_analysis table
    const { data: meterRecord, error: meterError } = await supabaseAdmin
      .from('voice_analysis')
      .insert({
        session_id,
        round_number: round_number || 1,
        analysis_type: 'say_meter',
        meter_score: sayMeterResult.score,
        meter_factors: sayMeterResult.factors,
        meter_reasoning: sayMeterResult.summary,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (meterError) {
      console.error('Failed to save meter:', meterError)
    }

    // Step 7: Save suggestions to voice_analysis table
    const suggestionRecords = suggestions.map((s: any) => ({
      session_id,
      round_number: round_number || 1,
      analysis_type: 'suggestion',
      suggestion_text: s.text,
      suggestion_category: s.category,
      priority: s.priority,
      dismissed: false,
      created_at: new Date().toISOString()
    }))

    if (suggestionRecords.length > 0) {
      const { error: suggestionsError } = await supabaseAdmin
        .from('voice_analysis')
        .insert(suggestionRecords)

      if (suggestionsError) {
        console.error('Failed to save suggestions:', suggestionsError)
      }
    }

    console.log(`✅ Analysis complete for session ${session_id}: Score ${sayMeterResult.score}, ${suggestions.length} suggestions`)

    return NextResponse.json({
      success: true,
      say_meter: {
        score: sayMeterResult.score,
        factors: sayMeterResult.factors,
        summary: sayMeterResult.summary
      },
      suggestions: suggestions,
      analyzed_messages: recentMessages.length
    })

  } catch (error: any) {
    console.error('Analysis error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
