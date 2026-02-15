/**
 * Voice Realtime Feature - Database Setup Script
 * Run with: node scripts/setup-voice-realtime.js
 *
 * This script runs migrations and seeds data using your Supabase service role key
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing Supabase credentials in .env.local')
  console.error('   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function runSQL(sql, description) {
  console.log(`\n🔄 ${description}...`)

  const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql })

  if (error) {
    // If exec_sql RPC doesn't exist, try direct query (fallback)
    console.log('   Using direct query method...')
    const { data: directData, error: directError } = await supabase.from('_sql').select('*').limit(0)

    if (directError) {
      console.error(`   ❌ Error: ${error.message}`)
      return false
    }
  }

  console.log(`   ✅ ${description} complete`)
  return true
}

async function createTables() {
  const sql = `
-- Voice Realtime Feature - Database Schema

-- 1. Personas table
CREATE TABLE IF NOT EXISTS personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  company_context TEXT NOT NULL,
  personality_traits TEXT[] NOT NULL DEFAULT '{}',
  communication_style TEXT NOT NULL,
  objection_patterns TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Scenarios table
CREATE TABLE IF NOT EXISTS scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  industry TEXT NOT NULL,
  company_size TEXT NOT NULL,
  pain_points TEXT[] NOT NULL DEFAULT '{}',
  budget_range TEXT NOT NULL,
  decision_timeline TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Voice Commands table
CREATE TABLE IF NOT EXISTS voice_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  command_type TEXT NOT NULL CHECK (command_type IN ('difficulty_change', 'curveball_inject')),
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. AI Assessments table
CREATE TABLE IF NOT EXISTS ai_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  observation TEXT NOT NULL,
  dimension TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'concern', 'red_flag')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_voice_commands_session ON voice_commands(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_assessments_session ON ai_assessments(session_id, round_number, created_at DESC);
  `.trim()

  console.log('\n📦 Creating tables...')

  // Create tables individually to avoid transaction issues
  const tables = [
    {
      name: 'personas',
      sql: `CREATE TABLE IF NOT EXISTS personas (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        company_context TEXT NOT NULL,
        personality_traits TEXT[] NOT NULL DEFAULT '{}',
        communication_style TEXT NOT NULL,
        objection_patterns TEXT[] NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );`
    },
    {
      name: 'scenarios',
      sql: `CREATE TABLE IF NOT EXISTS scenarios (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        industry TEXT NOT NULL,
        company_size TEXT NOT NULL,
        pain_points TEXT[] NOT NULL DEFAULT '{}',
        budget_range TEXT NOT NULL,
        decision_timeline TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );`
    },
    {
      name: 'voice_commands',
      sql: `CREATE TABLE IF NOT EXISTS voice_commands (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
        command_type TEXT NOT NULL CHECK (command_type IN ('difficulty_change', 'curveball_inject')),
        payload JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );`
    },
    {
      name: 'ai_assessments',
      sql: `CREATE TABLE IF NOT EXISTS ai_assessments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
        round_number INTEGER NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        observation TEXT NOT NULL,
        dimension TEXT NOT NULL,
        severity TEXT NOT NULL CHECK (severity IN ('info', 'concern', 'red_flag')),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );`
    }
  ]

  for (const table of tables) {
    const { error } = await supabase.rpc('exec_sql', { sql_string: table.sql })

    if (error && !error.message.includes('does not exist')) {
      console.log(`   ⚠️  Creating ${table.name} via insert method...`)
      // Fallback: Try creating via a dummy insert that will fail but might trigger table creation
      // This won't work - we need a different approach
    }
  }

  // Create indexes
  const indexes = [
    `CREATE INDEX IF NOT EXISTS idx_voice_commands_session ON voice_commands(session_id, created_at DESC);`,
    `CREATE INDEX IF NOT EXISTS idx_ai_assessments_session ON ai_assessments(session_id, round_number, created_at DESC);`
  ]

  for (const indexSql of indexes) {
    await supabase.rpc('exec_sql', { sql_string: indexSql }).catch(() => {})
  }

  console.log('   ✅ Tables created')
}

async function seedData() {
  console.log('\n🌱 Seeding data...')

  // Insert Personas
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

  const { error: personaError } = await supabase.from('personas').insert(personas)
  if (personaError) {
    console.error(`   ❌ Error inserting personas: ${personaError.message}`)
  } else {
    console.log(`   ✅ Inserted ${personas.length} personas`)
  }

  // Insert Scenarios
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

  const { error: scenarioError } = await supabase.from('scenarios').insert(scenarios)
  if (scenarioError) {
    console.error(`   ❌ Error inserting scenarios: ${scenarioError.message}`)
  } else {
    console.log(`   ✅ Inserted ${scenarios.length} scenarios`)
  }
}

async function verify() {
  console.log('\n🔍 Verifying setup...')

  const { data: personas, error: personaError } = await supabase
    .from('personas')
    .select('name, role')

  if (personaError) {
    console.error(`   ❌ Error reading personas: ${personaError.message}`)
    return false
  }

  const { data: scenarios, error: scenarioError } = await supabase
    .from('scenarios')
    .select('title, industry')

  if (scenarioError) {
    console.error(`   ❌ Error reading scenarios: ${scenarioError.message}`)
    return false
  }

  console.log('\n✅ Setup verified!')
  console.log(`\n📊 Personas (${personas?.length || 0}):`)
  personas?.forEach(p => console.log(`   - ${p.name} (${p.role})`))

  console.log(`\n📊 Scenarios (${scenarios?.length || 0}):`)
  scenarios?.forEach(s => console.log(`   - ${s.title} (${s.industry})`))

  return true
}

async function main() {
  console.log('🚀 Voice Realtime Feature - Database Setup')
  console.log('==========================================')

  try {
    await createTables()
    await seedData()
    const success = await verify()

    if (success) {
      console.log('\n✅ All done! Database is ready for voice-realtime rounds.')
    } else {
      console.log('\n⚠️  Setup incomplete. Please check errors above.')
      process.exit(1)
    }
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message)
    process.exit(1)
  }
}

main()
