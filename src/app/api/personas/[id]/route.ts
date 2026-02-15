import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

// GET /api/personas/:id - Get single persona
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { data, error } = await supabaseAdmin
      .from('personas')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error) {
      console.error('Error fetching persona:', error)
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json({ persona: data })
  } catch (error: any) {
    console.error('Get persona error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH /api/personas/:id - Update persona
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()

    // Remove id and timestamps from update
    const { id, created_at, updated_at, ...updates } = body

    // Validate blueprint if provided
    if (updates.blueprint) {
      const validBlueprints = ['sales', 'agentic_eng', 'fullstack', 'marketing', 'implementation', 'HR', 'security']
      if (!validBlueprints.includes(updates.blueprint)) {
        return NextResponse.json(
          { error: `Invalid blueprint. Must be one of: ${validBlueprints.join(', ')}` },
          { status: 400 }
        )
      }
    }

    // Validate difficulty if provided
    if (updates.difficulty !== undefined) {
      if (updates.difficulty < 1 || updates.difficulty > 5) {
        return NextResponse.json(
          { error: 'Difficulty must be between 1 and 5' },
          { status: 400 }
        )
      }
    }

    // Update with new timestamp
    const { data, error } = await supabaseAdmin
      .from('personas')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating persona:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ persona: data })
  } catch (error: any) {
    console.error('Update persona error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/personas/:id - Soft delete persona
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Soft delete - set is_active to false
    const { data, error } = await supabaseAdmin
      .from('personas')
      .update({ is_active: false })
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      console.error('Error deleting persona:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Persona deactivated successfully',
      persona: data
    })
  } catch (error: any) {
    console.error('Delete persona error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
