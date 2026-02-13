import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { supabaseAdmin } from '@/lib/supabase/server'
import { SALES_SIDEKICK_POLICY, enforceSidekickPolicy } from '@/lib/ai/sidekick-policy'

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

    // Check query limit (count from live_events)
    const { data: logs } = await supabaseAdmin
      .from('live_events')
      .select('id')
      .eq('session_id', session_id)
      .eq('event_type', 'sidekick_query')

    if (logs && logs.length >= SALES_SIDEKICK_POLICY.maxQueries) {
      return NextResponse.json({
        response: `You've reached your Sidekick query limit (${SALES_SIDEKICK_POLICY.maxQueries} queries). Complete the round with your best judgment.`,
        limit_reached: true,
        remaining_queries: 0
      })
    }

    // Enforce policy
    const policyCheck = enforceSidekickPolicy(query, SALES_SIDEKICK_POLICY)
    if (!policyCheck.allowed) {
      return NextResponse.json({
        response: policyCheck.reason,
        policy_violation: true,
        remaining_queries: SALES_SIDEKICK_POLICY.maxQueries - (logs?.length || 0)
      })
    }

    // Call OpenAI with policy-enforced system prompt
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SALES_SIDEKICK_POLICY.systemPrompt },
        ...(history || []),
        { role: 'user', content: query }
      ],
      temperature: 0.7,
      max_tokens: 500
    })

    const response = completion.choices[0].message.content || ''

    // Log sidekick usage to live_events (MVP approach)
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
        policy_enforced: {
          permissions: SALES_SIDEKICK_POLICY.permissions,
          restrictions: SALES_SIDEKICK_POLICY.restrictions
        }
      }
    })

    return NextResponse.json({
      response,
      policy: SALES_SIDEKICK_POLICY,
      remaining_queries: SALES_SIDEKICK_POLICY.maxQueries - (logs?.length || 0) - 1
    })
  } catch (error: any) {
    console.error('Sidekick error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
