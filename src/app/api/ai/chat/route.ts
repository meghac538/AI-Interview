import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { supabaseAdmin } from '@/lib/supabase/server'
import { SALES_SIDEKICK_POLICY, enforceSidekickPolicy } from '@/lib/ai/sidekick-policy'
import { decryptModelApiKey } from '@/lib/ai/model-registry-secrets'
import { getAIClient, mapModel } from '@/lib/ai/client'

export async function POST(request: Request) {
  try {
    const { session_id, round_id, query, history, model_key, purpose } = await request.json()

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

    const startedAt = Date.now()

    const requestedModelKey = typeof model_key === 'string' && model_key.trim() ? model_key.trim() : null
    const requestedPurpose = typeof purpose === 'string' && purpose.trim() ? purpose.trim() : 'candidate_sidekick'

    let effectiveModel = requestedModelKey || mapModel('gpt-4o')
    let useRegistryClient = false
    let baseURL: string | undefined = undefined
    let apiKey: string = ''

    if (requestedModelKey) {
      const { data: registryRow, error: registryError } = await supabaseAdmin
        .from('model_registry')
        .select('model_key,provider,purpose,edgeadmin_endpoint,api_key_ciphertext,is_active')
        .eq('model_key', requestedModelKey)
        .eq('purpose', requestedPurpose)
        .eq('is_active', true)
        .maybeSingle()

      if (registryError) throw registryError

      if (registryRow?.edgeadmin_endpoint) {
        baseURL = registryRow.edgeadmin_endpoint
        useRegistryClient = true
      }

      if (registryRow?.api_key_ciphertext) {
        apiKey = decryptModelApiKey(registryRow.api_key_ciphertext)
        useRegistryClient = true
      }

      if (registryRow?.model_key) {
        effectiveModel = registryRow.model_key
      }
    }

    // Use model registry client if custom endpoint/key found, otherwise use default AI client
    const openaiClient = useRegistryClient ? new OpenAI({ apiKey, baseURL }) : getAIClient()

    // Call OpenAI with policy-enforced system prompt
    const completion = await openaiClient.chat.completions.create({
      model: effectiveModel,
      messages: [
        { role: 'system', content: SALES_SIDEKICK_POLICY.systemPrompt },
        ...((history || []).map((message: any) => ({
          role: message.role === 'assistant' ? 'assistant' : 'user',
          content: String(message.content || '')
        })) as any[]),
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
        model: effectiveModel,
        base_url: baseURL || null,
        purpose: requestedPurpose,
        latency_ms: Date.now() - startedAt,
        policy_enforced: {
          permissions: SALES_SIDEKICK_POLICY.permissions,
          restrictions: SALES_SIDEKICK_POLICY.restrictions
        }
      }
    })

    return NextResponse.json({
      response,
      policy: SALES_SIDEKICK_POLICY,
      remaining_queries: SALES_SIDEKICK_POLICY.maxQueries - (logs?.length || 0) - 1,
      meta: {
        model: effectiveModel,
        latency_ms: Date.now() - startedAt,
        thinking: query.toLowerCase().includes('think'),
        tools: []
      }
    })
  } catch (error: any) {
    console.error('Sidekick error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
