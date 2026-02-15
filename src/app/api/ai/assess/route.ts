import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(request: Request) {
  try {
    const { session_id, round_number, transcript } = await request.json()

    if (!session_id || !round_number || !transcript || transcript.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: session_id, round_number, transcript' },
        { status: 400 }
      )
    }

    // Format transcript for analysis
    const conversationText = transcript
      .map((item: any) => `${item.role === 'user' ? 'Candidate' : 'Prospect'}: ${item.text}`)
      .join('\n\n')

    // Call OpenAI to analyze the conversation
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert sales coach silently observing a live sales discovery call.
Analyze the candidate's performance and identify specific observations.

Focus on these dimensions:
- rapport: Building connection, active listening, empathy
- discovery: Asking qualifying questions, uncovering needs
- objection_handling: Responding to pushback, maintaining composure
- value_proposition: Articulating value, tailoring to needs
- closing: Moving toward next steps, securing commitment

For each observation, provide:
1. dimension: One of the above
2. severity: "info" (positive behavior), "concern" (minor issue), or "red_flag" (serious problem)
3. observation: Specific, actionable feedback (1-2 sentences)

Return JSON array format:
[
  {"dimension": "rapport", "severity": "info", "observation": "Strong opening with personalized reference"},
  {"dimension": "discovery", "severity": "concern", "observation": "Jumped to pitch without asking qualifying questions"}
]

Only include meaningful observations. Skip generic or repetitive feedback.`
        },
        {
          role: 'user',
          content: `Analyze this sales call transcript:\n\n${conversationText}`
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3
    })

    const responseContent = completion.choices[0].message.content
    if (!responseContent) {
      throw new Error('No response from OpenAI')
    }

    const analysis = JSON.parse(responseContent)
    const assessments = analysis.observations || analysis.assessments || []

    // Store assessments in database
    const assessmentsToInsert = assessments.map((assessment: any) => ({
      session_id,
      round_number,
      timestamp: new Date().toISOString(),
      observation: assessment.observation,
      dimension: assessment.dimension,
      severity: assessment.severity
    }))

    if (assessmentsToInsert.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('ai_assessments')
        .insert(assessmentsToInsert)

      if (insertError) {
        console.error('Failed to insert assessments:', insertError)
        throw insertError
      }

      console.log(`✅ Stored ${assessmentsToInsert.length} AI assessments for session ${session_id}`)
    }

    return NextResponse.json({
      assessments: assessmentsToInsert,
      count: assessmentsToInsert.length
    })
  } catch (error: any) {
    console.error('AI assessment error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
