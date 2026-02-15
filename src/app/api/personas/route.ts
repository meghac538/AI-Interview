import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

// GET /api/personas - List personas with filters
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const blueprint = searchParams.get('blueprint')
    const difficulty = searchParams.get('difficulty')
    const isActive = searchParams.get('is_active') !== 'false' // default true

    let query = supabaseAdmin
      .from('personas')
      .select('*')
      .eq('is_active', isActive)
      .order('name')

    if (blueprint) {
      query = query.eq('blueprint', blueprint)
    }

    if (difficulty) {
      query = query.eq('difficulty', parseInt(difficulty))
    }

    const { data, error} = await query

    if (error) {
      console.error('Error fetching personas:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ personas: data })
  } catch (error: any) {
    console.error('List personas error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/personas - Create new persona
export async function POST(request: Request) {
  try {
    const body = await request.json()

    const {
      name,
      role,
      blueprint,
      difficulty,
      company_context,
      personality_traits,
      communication_style,
      objection_patterns,
      prompt_template,
      first_message_template
    } = body

    // Validation
    if (!name || !role || !blueprint || !difficulty) {
      return NextResponse.json(
        { error: 'Missing required fields: name, role, blueprint, difficulty' },
        { status: 400 }
      )
    }

    if (difficulty < 1 || difficulty > 5) {
      return NextResponse.json(
        { error: 'Difficulty must be between 1 and 5' },
        { status: 400 }
      )
    }

    const validBlueprints = ['sales', 'agentic_eng', 'fullstack', 'marketing', 'implementation', 'HR', 'security']
    if (!validBlueprints.includes(blueprint)) {
      return NextResponse.json(
        { error: `Invalid blueprint. Must be one of: ${validBlueprints.join(', ')}` },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('personas')
      .insert({
        name,
        role,
        blueprint,
        difficulty,
        company_context,
        personality_traits: personality_traits || [],
        communication_style,
        objection_patterns: objection_patterns || [],
        prompt_template,
        first_message_template,
        is_active: true
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating persona:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ persona: data }, { status: 201 })
  } catch (error: any) {
    console.error('Create persona error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
