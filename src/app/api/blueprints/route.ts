import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const track = searchParams.get('track')
    const competency = searchParams.get('competency')
    const difficulty = searchParams.get('difficulty')

    let query = supabaseAdmin.from('assessment_blueprints').select('*').order('created_at', {
      ascending: false
    })

    if (track) query = query.eq('track', track)
    if (competency) query = query.eq('competency', competency)
    if (difficulty) query = query.eq('difficulty', difficulty)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ blueprints: data || [] })
  } catch (error: any) {
    console.error('Blueprint list error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    const {
      track,
      competency,
      difficulty,
      format,
      scoring_rubric,
      red_flags,
      anti_cheat_constraints,
      evidence_requirements,
      time_limit_minutes
    } = payload

    if (
      !track ||
      !competency ||
      !difficulty ||
      !format ||
      !scoring_rubric ||
      !red_flags ||
      !anti_cheat_constraints ||
      !evidence_requirements ||
      !time_limit_minutes
    ) {
      return NextResponse.json(
        { error: 'Missing required blueprint fields' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('assessment_blueprints')
      .insert({
        track,
        competency,
        difficulty,
        format,
        scoring_rubric,
        red_flags,
        anti_cheat_constraints,
        evidence_requirements,
        time_limit_minutes
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Blueprint create error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
