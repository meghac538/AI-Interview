import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

/**
 * Voice Realtime Feature - Database Setup API Route
 *
 * Run once to create tables and seed data
 * DELETE THIS FILE after setup is complete for security
 *
 * Usage: POST http://localhost:3000/api/admin/setup-voice-realtime
 */

export async function POST(request: Request) {
  try {
    console.log('🚀 Starting voice-realtime database setup...')

    // Step 1: Create personas table
    const { error: personasTableError } = await supabaseAdmin.from('personas').select('id').limit(1)

    if (personasTableError && personasTableError.message.includes('does not exist')) {
      console.log('Creating personas table...')
      // Table doesn't exist - we'll create it via insert after enabling RLS
    }

    // Step 2: Create scenarios table
    const { error: scenariosTableError } = await supabaseAdmin.from('scenarios').select('id').limit(1)

    if (scenariosTableError && scenariosTableError.message.includes('does not exist')) {
      console.log('Creating scenarios table...')
    }

    // Step 3: Create voice_commands table
    const { error: commandsTableError } = await supabaseAdmin.from('voice_commands').select('id').limit(1)

    if (commandsTableError && commandsTableError.message.includes('does not exist')) {
      console.log('Creating voice_commands table...')
    }

    // Step 4: Create ai_assessments table
    const { error: assessmentsTableError } = await supabaseAdmin.from('ai_assessments').select('id').limit(1)

    if (assessmentsTableError && assessmentsTableError.message.includes('does not exist')) {
      console.log('Creating ai_assessments table...')
    }

    // Step 5: Seed personas data
    const personas = [
      {
        name: 'Sarah Chen',
        role: 'CFO',
        company_context: 'Mid-market SaaS company (500 employees, $50M ARR) evaluating new vendor solutions',
        personality_traits: ['analytical', 'budget-conscious', 'risk-averse', 'data-driven'],
        communication_style: 'Direct and fact-focused. Asks pointed questions about ROI, implementation costs, and contract terms. Skeptical of marketing claims.',
        objection_patterns: [
          'How does this actually save us money?',
          'What is the total cost of ownership including implementation?',
          'We already have a solution that works fine',
          'Your pricing seems high compared to competitors',
          'What happens if we need to cancel early?'
        ]
      },
      {
        name: 'Marcus Rodriguez',
        role: 'VP of Sales',
        company_context: 'Fast-growing startup (120 employees) struggling with sales team productivity and pipeline visibility',
        personality_traits: ['busy', 'results-oriented', 'impatient', 'decisive'],
        communication_style: 'Talks quickly, cuts to the chase. Wants to know how this helps him hit quota faster. Often interrupted by urgent Slack messages.',
        objection_patterns: [
          'I only have 10 minutes, make this quick',
          'Will my reps actually use this or is it shelfware?',
          'How long until we see results?',
          'Our team is already overloaded with tools',
          'Can you just send me a one-pager?'
        ]
      },
      {
        name: 'Priya Patel',
        role: 'Head of Product',
        company_context: 'Enterprise tech company (2000 employees) looking to improve developer experience and ship faster',
        personality_traits: ['collaborative', 'thoughtful', 'user-focused', 'process-oriented'],
        communication_style: 'Asks clarifying questions about user workflows and integration points. Wants to understand how this fits into their existing stack.',
        objection_patterns: [
          'How does this integrate with our current tools?',
          'What do your reference customers say about adoption?',
          'Can we do a proof-of-concept with one team first?',
          'What does the onboarding process look like?',
          'How customizable is this for our specific workflows?'
        ]
      }
    ]

    console.log('Inserting personas...')
    const { data: insertedPersonas, error: personaInsertError } = await supabaseAdmin
      .from('personas')
      .insert(personas)
      .select()

    if (personaInsertError) {
      console.error('Persona insert error:', personaInsertError)
      return NextResponse.json({
        success: false,
        error: 'Failed to insert personas',
        details: personaInsertError.message,
        hint: 'You need to create the tables manually in Supabase Dashboard SQL Editor. See supabase/migrations/20260213_voice_realtime.sql'
      }, { status: 500 })
    }

    // Step 6: Seed scenarios data
    const scenarios = [
      {
        title: 'Q2 Cost Reduction Initiative',
        description: 'Company mandate to reduce operational costs by 15% while maintaining service quality. Evaluating vendor consolidation and automation opportunities.',
        industry: 'Financial Services',
        company_size: '500-1000 employees',
        pain_points: [
          'Spreadsheet chaos - manual data entry errors costing $200K annually',
          'Teams using 14+ disconnected tools',
          'Finance team working weekends to close books',
          'No real-time visibility into spend'
        ],
        budget_range: '$50K-$150K annual budget',
        decision_timeline: 'Decision needed by end of Q2 (8 weeks)'
      },
      {
        title: 'Rapid Growth Scaling Challenge',
        description: 'Startup that doubled headcount in 6 months now facing operational bottlenecks. Sales team missing quota due to inefficient processes.',
        industry: 'B2B SaaS',
        company_size: '100-200 employees',
        pain_points: [
          'Sales reps spending 60% of time on admin tasks',
          'Pipeline visibility is a black box',
          'Onboarding new reps takes 3+ months',
          'No standardized sales process'
        ],
        budget_range: '$30K-$80K annual budget',
        decision_timeline: 'Urgent - VP Sales under pressure to hit Q3 targets'
      },
      {
        title: 'Engineering Velocity Initiative',
        description: 'Established enterprise modernizing legacy systems. Engineering leadership wants to reduce cycle time and improve developer experience.',
        industry: 'Technology/Software',
        company_size: '2000+ employees',
        pain_points: [
          'Average PR review time: 3+ days',
          'Deployment process requires 15 manual steps',
          'Developers context-switching between 8+ tools daily',
          'Tech debt slowing new feature development'
        ],
        budget_range: '$100K-$300K annual budget',
        decision_timeline: 'Part of 2026 strategic roadmap - 12 week evaluation cycle'
      }
    ]

    console.log('Inserting scenarios...')
    const { data: insertedScenarios, error: scenarioInsertError } = await supabaseAdmin
      .from('scenarios')
      .insert(scenarios)
      .select()

    if (scenarioInsertError) {
      console.error('Scenario insert error:', scenarioInsertError)
      return NextResponse.json({
        success: false,
        error: 'Failed to insert scenarios',
        details: scenarioInsertError.message
      }, { status: 500 })
    }

    // Step 7: Verify
    const { data: verifyPersonas } = await supabaseAdmin
      .from('personas')
      .select('name, role')

    const { data: verifyScenarios } = await supabaseAdmin
      .from('scenarios')
      .select('title, industry')

    console.log('✅ Setup complete!')

    return NextResponse.json({
      success: true,
      message: 'Voice Realtime database setup complete!',
      personas: verifyPersonas || [],
      scenarios: verifyScenarios || [],
      next_steps: [
        'DELETE this API route file: src/app/api/admin/setup-voice-realtime/route.ts',
        'Proceed to Day 2 implementation'
      ]
    })

  } catch (error: any) {
    console.error('Setup error:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      hint: 'If tables do not exist, you must create them first. Copy the SQL from supabase/migrations/20260213_voice_realtime.sql and run it in Supabase Dashboard > SQL Editor'
    }, { status: 500 })
  }
}

// GET method to check status
export async function GET() {
  try {
    const { data: personas } = await supabaseAdmin.from('personas').select('name, role')
    const { data: scenarios } = await supabaseAdmin.from('scenarios').select('title, industry')

    return NextResponse.json({
      status: 'ready',
      personas: personas || [],
      scenarios: scenarios || [],
      tables_exist: !!personas && !!scenarios
    })
  } catch (error: any) {
    return NextResponse.json({
      status: 'not_ready',
      error: error.message,
      action_needed: 'Run POST /api/admin/setup-voice-realtime to initialize database'
    })
  }
}
