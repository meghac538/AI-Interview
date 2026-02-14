import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getSidekickPolicy, enforceSidekickPolicy } from '@/lib/ai/sidekick-policy'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(request: Request) {
  try {
    const { session_id, round_id, query, history } = await request.json()

    if (!session_id || !query) {
      return NextResponse.json(
        { error: 'Missing required fields: session_id, query' },
        { status: 400 }
      )
    }

    // Look up the track from the scope package
    const { data: scopePackage } = await supabaseAdmin
      .from('interview_scope_packages')
      .select('track')
      .eq('session_id', session_id)
      .single()

    const track = scopePackage?.track || 'sales'
    const policy = getSidekickPolicy(track)

    // Check query limit (count from live_events)
    const { data: logs } = await supabaseAdmin
      .from('live_events')
      .select('id')
      .eq('session_id', session_id)
      .eq('event_type', 'sidekick_query')

    if (logs && logs.length >= policy.maxQueries) {
      return NextResponse.json({
        response: `You've reached your Sidekick query limit (${policy.maxQueries} queries). Complete the round with your best judgment.`,
        limit_reached: true,
        remaining_queries: 0
      })
    }

    // Enforce policy
    const policyCheck = enforceSidekickPolicy(query, policy)
    if (!policyCheck.allowed) {
      return NextResponse.json({
        response: policyCheck.reason,
        policy_violation: true,
        remaining_queries: policy.maxQueries - (logs?.length || 0)
      })
    }

    // Call OpenAI with policy-enforced system prompt
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: policy.systemPrompt },
        ...(history || []),
        { role: 'user', content: query }
      ],
      temperature: 0.7,
      max_tokens: 500
    })

    const response = completion.choices[0].message.content || ''

    // Log sidekick usage to live_events
    await supabaseAdmin.from('live_events').insert({
      session_id,
      event_type: 'sidekick_query',
      payload: {
        round_id: round_id || null,
        query,
        response,
        query_length: query.length,
        response_length: response.length,
        tokens_used: completion.usage?.total_tokens || 0,
        track,
        policy_enforced: {
          permissions: policy.permissions,
          restrictions: policy.restrictions
        }
      }
    })

    return NextResponse.json({
      response,
      policy,
      remaining_queries: policy.maxQueries - (logs?.length || 0) - 1
    })
  } catch (error: any) {
    console.error('Sidekick error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
