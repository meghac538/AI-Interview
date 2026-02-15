import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { supabaseAdmin } from '@/lib/supabase/server'
import { randomUUID } from 'crypto'
import { extractResumeSkills, computeInterviewLevel } from '@/lib/db/helpers'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(request: Request) {
  try {
    const { candidate_name, role, level, track, difficulty } = await request.json()

    // Validate inputs
    if (!candidate_name || !role || !level) {
      return NextResponse.json(
        { error: 'Missing required fields: candidate_name, role, level' },
        { status: 400 }
      )
    }

    // Resolve track: use request track if provided, else derive from role
    const resolvedTrack = track
      ? (track as string)
      : (() => {
          const normalizedRole = role.toLowerCase()
          if (normalizedRole.includes('marketing') || normalizedRole.includes('growth marketing') || normalizedRole.includes('brand strategist') || normalizedRole.includes('campaign ops')) return 'marketing'
          if (normalizedRole.includes('solutions consultant') || normalizedRole.includes('pre-sales') || normalizedRole.includes('client delivery') || normalizedRole.includes('customer outcomes') || normalizedRole.includes('enablement') || normalizedRole.includes('launch') || normalizedRole.includes('implementation')) return 'implementation'
          if (normalizedRole.includes('sales') || normalizedRole.includes('bdr') || normalizedRole.includes('ae') || normalizedRole.includes('account executive') || normalizedRole.includes('sales development') || normalizedRole.includes('sdr') || normalizedRole.includes('solutions account executive')) return 'sales'
          if (normalizedRole.includes('fullstack') || normalizedRole.includes('full-stack') || normalizedRole.includes('full stack') || normalizedRole.includes('full-stack engineer') || normalizedRole.includes('full stack engineer') || normalizedRole.includes('software engineer') || normalizedRole.includes('growth automation')) return 'fullstack'
          if (normalizedRole.includes('data steward') || normalizedRole.includes('data_steward') || normalizedRole.includes('knowledge') || normalizedRole.includes('taxonomy') || normalizedRole.includes('labeling') || normalizedRole.includes('classification') || normalizedRole.includes('knowledge readiness')) return 'data_steward'
          if (normalizedRole.includes('agentic') || normalizedRole.includes('agentic systems') || normalizedRole.includes('ai-native') || normalizedRole.includes('ai assisted') || normalizedRole.includes('ai-assisted') || normalizedRole.includes('ai solutions engineer') || normalizedRole.includes('internal automation') || normalizedRole.includes('ai research intern') || normalizedRole.includes('applied ai') || normalizedRole.includes('ai security') || normalizedRole.includes('ai ethics')) return 'agentic_eng'
          if (normalizedRole.includes('security')) return 'security'
          if (normalizedRole.includes('data')) return 'data'
          if (normalizedRole.includes('hr') || normalizedRole.includes('people ops') || normalizedRole.includes('people operations') || normalizedRole.includes('people-ops') || normalizedRole.includes('peopleops') || normalizedRole.includes('people ops coordinator')) return 'HR'
          return 'sales'
        })()

    const voiceDifficulty = difficulty ?? 3
    const expMatch = role.match(/(\d+)\s*[–\-]\s*(\d+)\s*yr/i)
    const experience_years_min = expMatch ? parseInt(expMatch[1], 10) : null
    const experience_years_max = expMatch ? parseInt(expMatch[2], 10) : null

    // Step 1: Create job profile
    const { data: jobProfile, error: jobError } = await supabaseAdmin
      .from('job_profiles')
      .insert({
        job_id: `temp_${Date.now()}`,
        title: role,
        location: 'Remote',
        level_band: level.toLowerCase() as 'junior' | 'mid' | 'senior',
        track: resolvedTrack,
        role_success_criteria: getRoleSuccessCriteria(resolvedTrack),
        must_have_flags: [],
        disqualifiers: [],
        gating_thresholds: { proceed: 70, caution: 50, stop: 30 },
        experience_years_min,
        experience_years_max
      })
      .select()
      .single()

    if (jobError) throw jobError

    // Step 2: Create canonical job row (best-effort for legacy FK compatibility)
    const { error: canonicalJobError } = await supabaseAdmin
      .from('jobs')
      .insert({
        job_id: jobProfile.job_id,
        job_title: role,
        location: 'Remote'
      })
    if (canonicalJobError) {
      console.warn('Jobs table insert skipped:', canonicalJobError.message)
    }

    // Step 3: Find existing candidate or create new one
    const candidateEmail = `${candidate_name.toLowerCase().replace(/\s+/g, '.')}@temp.com`
    const { data: existingCandidate } = await supabaseAdmin
      .from('candidates')
      .select('*')
      .eq('email', candidateEmail)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let candidate = existingCandidate
    if (!candidate) {
      const { data: newCandidate, error: candidateError } = await supabaseAdmin
        .from('candidates')
        .insert({
          hash_id: randomUUID(),
          rippling_candidate_id: `temp_${Date.now()}`,
          name: candidate_name,
          email: candidateEmail,
          job_id: jobProfile.job_id,
          applied_at: new Date().toISOString(),
          status: 'live_scheduled'
        })
        .select()
        .single()

      if (candidateError) throw candidateError
      candidate = newCandidate
    } else {
      // Update status for existing candidate
      await supabaseAdmin
        .from('candidates')
        .update({ status: 'live_scheduled' })
        .eq('id', candidate.id)
    }

    // Step 4: Create session
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('interview_sessions')
      .insert({
        candidate_id: candidate.id,
        job_id: jobProfile.id,
        session_type: 'live',
        status: 'scheduled',
        scheduled_at: new Date().toISOString()
      })
      .select()
      .single()

    if (sessionError) throw sessionError

    const useVoiceRealtime = track !== undefined && difficulty !== undefined && resolvedTrack === 'sales'

    let roundPlan: Array<Record<string, any>>
    let questionSet: Record<string, any>

    if (useVoiceRealtime) {
      roundPlan = [
        {
          round_number: 1,
          round_type: 'voice-realtime' as const,
          title: 'Round 1: Live Voice Call with AI Prospect',
          prompt: 'Conduct a live voice discovery call with an AI prospect. Ask discovery questions, handle objections, demonstrate value, and close for next steps.',
          duration_minutes: 12,
          status: 'pending' as const,
          config: {
            persona_id: null,
            scenario_id: null,
            initial_difficulty: voiceDifficulty,
            allow_curveballs: false,
            voice: 'sage'
          }
        }
      ]
      questionSet = {}
    } else {
      const { data: blueprints } = await supabaseAdmin
        .from('assessment_blueprints')
        .select('*')
        .eq('track', resolvedTrack)
        .order('created_at', { ascending: true })
        .limit(3)

      const { data: generatedItems } = await supabaseAdmin
        .from('generated_question_items')
        .select('*')
        .eq('track', resolvedTrack)
        .eq('status', 'validated')
        .order('created_at', { ascending: false })
        .limit(3)

      const { data: piScreenings, error: piError } = await supabaseAdmin
        .from('pi_screenings')
        .select('*')
        .eq('candidate_id', candidate.id)
        .order('created_at', { ascending: false })
        .limit(1)

      if (piError) {
        console.warn('PI screenings query failed (table may not exist yet):', piError.message)
      }
      const latestPi = piScreenings?.[0] || null
      const piScore = latestPi?.pi_score_overall ?? null
      const interviewLevel = computeInterviewLevel(level, piScore, experience_years_max)
      const resumeSkills = extractResumeSkills(latestPi?.resume_analysis)
      const piDimensionScores = latestPi?.dimension_scores || {}

      const roleSignals = {
        jd_text: jobProfile.role_success_criteria,
        must_haves: jobProfile.must_have_flags,
        nice_to_haves: jobProfile.disqualifiers,
        ai_native_behaviors: resumeSkills.filter((s: string) => /ai|ml|llm|gpt|agent|automat/i.test(s)),
        track_skill_graph: {
          extracted_skills: resumeSkills,
          pi_dimension_scores: piDimensionScores,
          pi_score_overall: piScore,
          interview_level: interviewLevel
        },
        past_outcomes: {
          pi_pass_fail: latestPi?.pass_fail ?? null,
          pi_score: piScore
        },
        failure_modes: {}
      }

      roundPlan =
        generatedItems && generatedItems.length > 0
          ? buildRoundsFromGeneratedItems(generatedItems, interviewLevel)
          : await buildRoundsFromBlueprints(blueprints || [], roleSignals, resolvedTrack, interviewLevel)

      if (!roundPlan || roundPlan.length === 0) {
        roundPlan = buildFallbackRounds(resolvedTrack, role, interviewLevel)
      }

      questionSet = {
        interview_level: interviewLevel,
        role_signals: roleSignals,
        pi_screening_id: latestPi?.id || null,
        pi_score_overall: piScore,
        pi_pass_fail: latestPi?.pass_fail ?? null
      }
    }

    // Step 5: Create scope package with round plan
    const { data: scopePackage, error: scopeError } = await supabaseAdmin
      .from('interview_scope_packages')
      .insert({
        session_id: session.id,
        generated_at: new Date().toISOString(),
        track: resolvedTrack,
        round_plan: roundPlan,
        question_set: useVoiceRealtime ? {} : questionSet,
        simulation_payloads: {
          role_widget_config: {
            role_family: resolvedTrack,
            lanes: []
          }
        },
        rubric_version: '1.0',
        models_used: ['gpt-4o'],
        approved_by: null
      })
      .select()
      .single()

    if (scopeError) throw scopeError

    // Step 6: Log session creation event
    await supabaseAdmin.from('live_events').insert({
      session_id: session.id,
      event_type: 'session_created',
      payload: {
        candidate_id: candidate.id,
        job_id: jobProfile.id,
        track: resolvedTrack
      }
    })

    return NextResponse.json({
      session: {
        ...session,
        candidate,
        job: jobProfile,
        currentRound: 1
      },
      scopePackage,
      rounds: roundPlan
    })
  } catch (error: any) {
    console.error('Session creation error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function buildRoundsFromBlueprints(blueprints: any[], roleSignals: any, track: string, level?: string) {
  if (track === 'sales') {
    return buildSalesRounds(blueprints, roleSignals)
  }
  if (track === 'marketing') {
    return buildMarketingRounds(blueprints, roleSignals)
  }
  if (track === 'HR') {
    return buildPeopleOpsRounds(blueprints, roleSignals, level)
  }

  const rounds = []

  for (const [index, blueprint] of blueprints.entries()) {
    const prompt = await generatePromptFromBlueprint(blueprint, roleSignals)
    const roundType = mapFormatToRoundType(blueprint.format)

    rounds.push({
      round_number: index + 1,
      round_type: roundType,
      title: `${blueprint.competency} (${blueprint.format})`,
      prompt,
      duration_minutes: blueprint.time_limit_minutes || 10,
      status: 'pending',
      config: {
        blueprint_id: blueprint.id,
        competency: blueprint.competency,
        difficulty: blueprint.difficulty,
        format: blueprint.format,
        scoring_rubric: blueprint.scoring_rubric,
        red_flags: blueprint.red_flags,
        anti_cheat_constraints: blueprint.anti_cheat_constraints,
        evidence_requirements: blueprint.evidence_requirements
      }
    })
  }

  return rounds
}

function mapFormatToRoundType(format: string) {
  switch (format) {
    case 'code':
    case 'coding':
      return 'code'
    case 'mcq':
      return 'mcq'
    case 'ranking':
      return 'text'
    case 'scenario':
    case 'short_answer':
    default:
      return 'text'
  }
}

function getRoleSuccessCriteria(track: string): string {
  switch (track) {
    case 'sales':
      return 'Discovery quality, objection handling, negotiation posture, and closing discipline'
    case 'marketing':
      return 'Marketing strategy, experimentation, and execution'
    case 'HR':
      return 'Employee relations, onboarding design, policy judgment, and clear communication'
    case 'fullstack':
      return 'Code quality, systems thinking, testing discipline, and incremental delivery'
    case 'agentic_eng':
      return 'AI systems design, automation architecture, prompt engineering, and evaluation methodology'
    case 'data_steward':
      return 'Taxonomy design, labeling precision, retrieval quality, and data governance'
    case 'implementation':
      return 'Client delivery, requirements translation, stakeholder management, and solution design'
    case 'security':
      return 'Threat modeling, security architecture, compliance frameworks, and risk assessment'
    case 'data':
      return 'Data analysis, pipeline design, statistical reasoning, and data quality'
    default:
      return 'Role-specific competency, reasoning, communication, and problem-solving'
  }
}

function buildFallbackRounds(track: string, role: string, level?: string) {
  switch (track) {
    case 'fullstack':
      return buildFullstackFallbackRounds(role)
    case 'agentic_eng':
      return buildAgenticEngFallbackRounds(role)
    case 'data_steward':
      return buildDataStewardFallbackRounds(role, level)
    case 'implementation':
      return buildImplementationFallbackRounds(role)
    default:
      return [
        {
          round_number: 1,
          round_type: 'text' as const,
          title: 'Round 1: Structured Response',
          prompt:
            `Provide a structured response for the ${role} role. ` +
            'Include a short plan, key decisions, and any risks or open questions.',
          duration_minutes: 15,
          status: 'pending',
          config: {}
        }
      ]
  }
}

function buildFullstackFallbackRounds(role: string) {
  return [
    {
      round_number: 1,
      round_type: 'code' as const,
      title: 'Round 1: Build + Test a Feature',
      prompt:
        'You are building a small rotating feature (e.g., a promotional banner that cycles through items on a schedule). ' +
        'Provide: (1) A brief design outline, (2) Core implementation in TypeScript, (3) At least 2 test cases covering edge cases. ' +
        'Think about security, performance, and how you would ship this incrementally.',
      duration_minutes: 20,
      status: 'pending',
      config: {
        competency: 'Build + Test a Rotating Feature',
        difficulty: 'L2',
        format: 'code',
        scoring_rubric: {
          dimensions: [
            { name: 'decomposition', description: 'Breaks work into clear, sequential steps', maxScore: 20 },
            { name: 'correctness', description: 'Reasoning about edge cases and expected behavior', maxScore: 20 },
            { name: 'verification', description: 'Test plan + at least 2 tests', maxScore: 20 },
            { name: 'security_performance', description: 'Mentions security/perf concerns', maxScore: 20 },
            { name: 'incremental_shipping', description: 'Can ship in small steps', maxScore: 20 }
          ]
        },
        evidence_requirements: { required: ['design outline', 'implementation', 'test plan', '2+ tests'] }
      }
    },
    {
      round_number: 2,
      round_type: 'mcq' as const,
      title: 'Round 2: Code Review Trap',
      prompt:
        'Review the following 4 code snippets. Identify which one is safe for production and explain the bugs in the others. ' +
        'For each buggy snippet, describe the fix and its downstream impact.\n\n' +
        'Snippet A: `db.query("SELECT * FROM users WHERE id = " + userId)`\n' +
        'Snippet B: `db.query("SELECT * FROM users WHERE id = $1", [userId])`\n' +
        'Snippet C: `for (let i = 0; i <= items.length; i++) { process(items[i]) }`\n' +
        'Snippet D: `if (user.role !== "admin") { return getAllUserData(requesterId) }`',
      duration_minutes: 15,
      status: 'pending',
      config: {
        competency: 'Code Review Trap + Cascading Failure',
        difficulty: 'L2',
        format: 'mcq',
        options: [
          { label: 'Snippet A', description: 'SQL injection vulnerability' },
          { label: 'Snippet B', description: 'Parameterized query - CORRECT', correct: true },
          { label: 'Snippet C', description: 'Off-by-one bug' },
          { label: 'Snippet D', description: 'Auth bypass + data leak' }
        ],
        scoring_rubric: {
          dimensions: [
            { name: 'bug_finding', description: 'Identifies security + correctness issues', maxScore: 30 },
            { name: 'fix_quality', description: 'Proposes safe fixes', maxScore: 25 },
            { name: 'impact_analysis', description: 'Predicts downstream effects', maxScore: 25 },
            { name: 'debugging', description: 'Approach + prioritization', maxScore: 20 }
          ]
        }
      }
    },
    {
      round_number: 3,
      round_type: 'text' as const,
      title: 'Round 3: Systems Thinking',
      prompt:
        'You just shipped the feature from Round 1 to production. Define: ' +
        '(1) Success and guardrail metrics, (2) A monitoring and alerting plan, (3) A rollback and regression plan.',
      duration_minutes: 8,
      status: 'pending',
      config: {
        competency: 'Systems Thinking: Production Evaluation',
        difficulty: 'L1',
        format: 'short_answer',
        scoring_rubric: {
          dimensions: [
            { name: 'metrics', description: 'Defines success + guardrail metrics', maxScore: 40 },
            { name: 'observability', description: 'Monitoring + alerting plan', maxScore: 30 },
            { name: 'rollback', description: 'Rollback + regression plan', maxScore: 30 }
          ]
        }
      }
    }
  ]
}

function buildAgenticEngFallbackRounds(role: string) {
  return [
    {
      round_number: 1,
      round_type: 'text' as const,
      title: 'Round 1: Agentic System Design',
      prompt:
        'Design an AI agent that automates a repetitive internal workflow (e.g., document classification, ticket triage, or report generation). ' +
        'Provide: (1) Architecture overview — which components and models would you use, (2) Prompt design for the core task, ' +
        '(3) Error handling and fallback strategy, (4) How you would evaluate the agent\'s output quality.',
      duration_minutes: 18,
      status: 'pending',
      config: {
        competency: 'Agentic System Design',
        difficulty: 'L2',
        format: 'short_answer',
        scoring_rubric: {
          dimensions: [
            { name: 'architecture', description: 'Clear component design with model selection rationale', maxScore: 25 },
            { name: 'prompt_engineering', description: 'Well-structured prompts with constraints and examples', maxScore: 25 },
            { name: 'error_handling', description: 'Graceful fallbacks, retries, human-in-the-loop', maxScore: 25 },
            { name: 'evaluation', description: 'Defines metrics, test cases, and quality gates', maxScore: 25 }
          ]
        },
        evidence_requirements: { required: ['architecture diagram or description', 'sample prompt', 'evaluation plan'] }
      }
    },
    {
      round_number: 2,
      round_type: 'text' as const,
      title: 'Round 2: Failure Diagnosis + Iteration',
      prompt:
        'Your agent from Round 1 has been deployed for 2 weeks. Users report: ' +
        '(A) 15% of classifications are wrong, (B) It sometimes hallucinates categories that don\'t exist, ' +
        '(C) Latency spikes to 8s during peak hours. ' +
        'Diagnose root causes for each issue and propose fixes. Prioritize by impact.',
      duration_minutes: 12,
      status: 'pending',
      config: {
        competency: 'Production AI Debugging',
        difficulty: 'L2',
        format: 'short_answer',
        scoring_rubric: {
          dimensions: [
            { name: 'diagnosis', description: 'Identifies plausible root causes for each issue', maxScore: 35 },
            { name: 'fixes', description: 'Proposes pragmatic, implementable improvements', maxScore: 35 },
            { name: 'prioritization', description: 'Ranks by impact and effort', maxScore: 30 }
          ]
        }
      }
    }
  ]
}

function buildDataStewardFallbackRounds(role: string, level?: string) {
  const difficulty = level || 'L2'
  const pdfByDifficulty: Record<string, string> = {
    L1: '/docs/messy-doc-set-l1.pdf',
    L2: '/docs/messy-doc-set-l2.pdf',
    L3: '/docs/messy-doc-set-l3.pdf'
  }
  const pdfUrl = pdfByDifficulty[difficulty] || pdfByDifficulty['L2']

  return [
    {
      round_number: 1,
      round_type: 'text' as const,
      title: 'Round 1: Taxonomy + Labeling Plan',
      prompt:
        'Review the document set shown above. These are real messy internal documents with issues like ' +
        'duplicate sections, inconsistent metadata, mixed ownership, and conflicting information.\n\n' +
        'Create:\n' +
        '(1) A taxonomy of document categories that covers all documents in the set\n' +
        '(2) Labeling rules for each category with clear decision criteria\n' +
        '(3) A QA sampling plan to ensure label consistency across reviewers\n\n' +
        'Consider edge cases like multi-category documents, version conflicts, and outdated content.',
      duration_minutes: 15,
      status: 'pending',
      config: {
        competency: 'Taxonomy + Labeling Plan',
        difficulty,
        format: 'short_answer',
        pdf_url: pdfUrl,
        pdf_by_difficulty: pdfByDifficulty,
        pdf_title: 'Document Set — Review & Classify',
        scoring_rubric: {
          dimensions: [
            { name: 'precision', description: 'Taxonomy clarity and label precision', maxScore: 35 },
            { name: 'practicality', description: 'Operationally feasible labeling plan', maxScore: 35 },
            { name: 'auditability', description: 'QA and review process is traceable', maxScore: 30 }
          ]
        },
        evidence_requirements: { required: ['taxonomy', 'labeling rules', 'QA sampling plan'] }
      }
    },
    {
      round_number: 2,
      round_type: 'text' as const,
      title: 'Round 2: Retrieval Failure Diagnosis',
      prompt:
        'An AI assistant retrieves documents to answer employee questions. Here are 3 bad outputs:\n' +
        '(A) Q: "What is our refund policy?" → Retrieved: onboarding guide, product roadmap\n' +
        '(B) Q: "How do I submit expenses?" → Retrieved: correct doc but from 2019 (outdated)\n' +
        '(C) Q: "What are our data retention rules?" → Retrieved: partially relevant compliance doc, missing key sections\n\n' +
        'For each: diagnose the likely root cause, propose a fix, and describe how you would evaluate improvement.',
      duration_minutes: 12,
      status: 'pending',
      config: {
        competency: 'Retrieval Failure Diagnosis',
        difficulty,
        format: 'short_answer',
        scoring_rubric: {
          dimensions: [
            { name: 'diagnosis', description: 'Identifies likely root causes', maxScore: 40 },
            { name: 'fixes', description: 'Proposes pragmatic improvements', maxScore: 35 },
            { name: 'evaluation', description: 'Defines evaluation approach', maxScore: 25 }
          ]
        }
      }
    }
  ]
}

function buildImplementationFallbackRounds(role: string) {
  return [
    {
      round_number: 1,
      round_type: 'text' as const,
      title: 'Round 1: Requirements Translation',
      prompt:
        'A client says: "We need AI to help our support team respond faster. They currently handle 200 tickets/day and ' +
        'average response time is 4 hours. We want it under 1 hour." ' +
        'Translate this into: (1) Functional requirements, (2) Technical constraints, (3) Success metrics, ' +
        '(4) A phased rollout plan with milestones. Identify risks and assumptions.',
      duration_minutes: 14,
      status: 'pending',
      config: {
        competency: 'Requirements Translation',
        difficulty: 'L2',
        format: 'short_answer',
        scoring_rubric: {
          dimensions: [
            { name: 'requirements_clarity', description: 'Clear functional and technical requirements', maxScore: 25 },
            { name: 'feasibility', description: 'Realistic constraints and assumptions identified', maxScore: 25 },
            { name: 'metrics', description: 'Measurable success criteria tied to client goals', maxScore: 25 },
            { name: 'rollout_plan', description: 'Phased approach with risk mitigation', maxScore: 25 }
          ]
        },
        evidence_requirements: { required: ['requirements list', 'success metrics', 'rollout plan'] }
      }
    },
    {
      round_number: 2,
      round_type: 'text' as const,
      title: 'Round 2: Stakeholder Communication',
      prompt:
        'The client from Round 1 emails you 3 weeks into implementation: "The AI is giving wrong answers 20% of the time ' +
        'and my team is losing trust. I\'m considering pulling the plug." ' +
        'Draft: (1) Your immediate response email to the client, (2) An internal action plan for your team, ' +
        '(3) A revised timeline with checkpoints to rebuild confidence.',
      duration_minutes: 11,
      status: 'pending',
      config: {
        competency: 'Client Delivery Under Pressure',
        difficulty: 'L2',
        format: 'short_answer',
        scoring_rubric: {
          dimensions: [
            { name: 'client_communication', description: 'Professional, empathetic, solutions-focused', maxScore: 34 },
            { name: 'action_plan', description: 'Concrete steps to fix the accuracy issue', maxScore: 33 },
            { name: 'recovery_strategy', description: 'Revised timeline with trust-rebuilding checkpoints', maxScore: 33 }
          ]
        }
      }
    }
  ]
}

async function generatePromptFromBlueprint(blueprint: any, roleSignals: any) {
  const prompt = `You are generating a live interview question from a blueprint.

Blueprint:
${JSON.stringify(blueprint)}

Role signals:
${JSON.stringify(roleSignals)}

Requirements:
- Provide a clear prompt and expected output format
- Must be time-bound to ${blueprint.time_limit_minutes} minutes
- Enforce anti-cheat constraints
- Require reasoning (no trivia)
- Align to competency and difficulty

Return JSON:
{"prompt":"...","expected_output":"..."}`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      response_format: { type: 'json_object' },
      max_tokens: 500
    })

    const result = JSON.parse(completion.choices[0].message.content || '{}')
    const promptText = result.prompt || 'Provide a structured response based on the blueprint constraints.'
    const expected = result.expected_output ? `\n\nExpected output:\n${result.expected_output}` : ''
    return `${promptText}${expected}`
  } catch (error) {
    console.error('Blueprint prompt generation error:', error)
    return `Provide a response aligned to the competency "${blueprint.competency}" and format "${blueprint.format}". Include evidence and reasoning.`
  }
}

function buildRoundsFromGeneratedItems(items: any[], level?: string) {
  return items.map((item, index) => ({
    round_number: index + 1,
    round_type: mapFormatToRoundType(item.format),
    title: `${item.competency} (${item.format})`,
    prompt: item.prompt + (item.expected_output ? `\n\nExpected output:\n${item.expected_output}` : ''),
    duration_minutes: item.time_limit_minutes || 10,
    status: 'pending',
    config: {
      item_id: item.id,
      blueprint_id: item.blueprint_id,
      version: item.version,
      hash: item.hash,
      competency: item.competency,
      difficulty: item.difficulty,
      format: item.format,
      options: Array.isArray(item?.validation_report?.options)
        ? item.validation_report.options
        : Array.isArray(item?.options)
          ? item.options
          : undefined,
      pdf_by_difficulty: item?.validation_report?.pdf_by_difficulty || undefined,
      pdf_url: selectPdfUrl(item, level),
      pdf_title: item?.validation_report?.pdf_title || item?.pdf_title || undefined,
      scoring_rubric: item.scoring_rubric,
      red_flags: item.red_flags,
      anti_cheat_constraints: item.anti_cheat_constraints,
      evidence_requirements: item.evidence_requirements
    }
  }))
}

function selectPdfUrl(item: any, level?: string) {
  const override =
    item?.validation_report?.escalation_level ||
    item?.validation_report?.difficulty_override ||
    item?.difficulty_override ||
    item?.escalation_level

  const baseDifficulty = typeof item?.difficulty === 'string' ? item.difficulty : undefined
  const computedDifficulty = computeDifficulty(baseDifficulty, level, override)

  const byDifficulty = item?.validation_report?.pdf_by_difficulty
  if (byDifficulty && computedDifficulty && byDifficulty[computedDifficulty]) {
    return byDifficulty[computedDifficulty]
  }

  if (Array.isArray(item?.validation_report?.pdf_urls)) {
    return pickRandom(item.validation_report.pdf_urls)
  }

  return item?.validation_report?.pdf_url || item?.pdf_url || undefined
}

function computeDifficulty(baseDifficulty?: string, level?: string, override?: string) {
  if (typeof override === 'string' && override.length > 0) return override
  if (!baseDifficulty) return undefined

  const normalizedLevel = typeof level === 'string' ? level.toLowerCase() : ''
  const order = ['L1', 'L2', 'L3']
  let index = order.indexOf(baseDifficulty)
  if (index < 0) return baseDifficulty

  if (normalizedLevel === 'junior') {
    index = Math.min(index, 1)
  } else if (normalizedLevel === 'senior') {
    index = Math.min(index + 1, order.length - 1)
  }

  return order[index]
}

function pickRandom(list: any) {
  if (!Array.isArray(list) || list.length === 0) return undefined
  const index = Math.floor(Math.random() * list.length)
  return list[index]
}

async function buildSalesRounds(blueprints: any[], roleSignals: any) {
  const defaults = [
    {
      title: 'Round 1: Live Persona Sell',
      round_type: 'voice' as const,
      duration_minutes: 12,
      prompt:
        'Conduct a discovery call with a prospect. Ask at least 5 discovery questions, quantify value, and handle objections professionally.',
      config: {
        persona: 'prospect_with_objections',
        required_questions: 5,
        required_objections: 3,
        curveballs: ['budget_cut', 'security_concern', 'timeline_mismatch'],
        scoring_rubric: {
          dimensions: [
            {
              name: 'discovery_quality',
              description: 'Quality and depth of discovery questions',
              maxScore: 20,
              scoringCriteria: [
                'Asked at least 5 discovery questions',
                'Uncovered pain points, budget authority, timeline',
                'Followed up on vague responses'
              ]
            },
            {
              name: 'clarity_and_confidence',
              description: 'Clear, confident communication',
              maxScore: 20,
              scoringCriteria: [
                'Clear and confident delivery',
                'Structured responses',
                'Avoided filler and ambiguity'
              ]
            },
            {
              name: 'objection_handling',
              description: 'Handling of prospect objections',
              maxScore: 20,
              scoringCriteria: [
                'Acknowledged concerns',
                'Addressed objections with value-based responses',
                'Did not deflect or overpromise'
              ]
            },
            {
              name: 'honesty_about_constraints',
              description: 'Honesty about constraints and limitations',
              maxScore: 20,
              scoringCriteria: [
                'No overpromising',
                'Set realistic expectations',
                'Admitted uncertainty when needed'
              ]
            },
            {
              name: 'closing_next_step',
              description: 'Professional closing and next steps',
              maxScore: 20,
              scoringCriteria: [
                'Attempted to close or advance',
                'Established clear next steps',
                'Confirmed commitment'
              ]
            }
          ]
        }
      }
    },
    {
      title: 'Round 2: Negotiation via Email Thread',
      round_type: 'email' as const,
      duration_minutes: 15,
      prompt:
        'Respond to the prospect email asking for pricing concessions and timeline demands. Draft two responses; the second addresses a harder objection.',
      config: {
        thread_depth: 2,
        initial_objection: 'discount_request',
        escalation_objection: 'timeline_pressure',
        scoring_rubric: {
          dimensions: [
            {
              name: 'negotiation_posture',
              description: 'Firmness and collaboration balance',
              maxScore: 20,
              scoringCriteria: [
                'Maintained firm stance on value',
                'Stayed collaborative, not defensive',
                'Justified pricing with evidence'
              ]
            },
            {
              name: 'clarity_and_professionalism',
              description: 'Clear, professional tone',
              maxScore: 20,
              scoringCriteria: [
                'Professional email structure',
                'Clear and concise writing',
                'Respectful tone under pressure'
              ]
            },
            {
              name: 'handling_rejection',
              description: 'Response to pushback',
              maxScore: 20,
              scoringCriteria: [
                'No desperation or panic',
                'Reframed objections as opportunities',
                'Maintained confidence'
              ]
            },
            {
              name: 'protecting_margin_and_scope',
              description: 'Protecting pricing and scope',
              maxScore: 20,
              scoringCriteria: [
                'Did not offer immediate discounts',
                'Tied flexibility to value exchange',
                'Protected company interests'
              ]
            },
            {
              name: 'realistic_commitments',
              description: 'Realistic promises and timelines',
              maxScore: 20,
              scoringCriteria: [
                'Only committed to deliverable items',
                'Set realistic timelines',
                'Acknowledged constraints honestly'
              ]
            }
          ]
        }
      }
    },
    {
      title: 'Round 3: Follow-up Discipline',
      round_type: 'text' as const,
      duration_minutes: 5,
      prompt:
        'Write a clean internal handoff note summarizing what was learned, next steps, and risks.',
      config: {
        optional: true
      }
    }
  ]

  const rounds = []

  for (const [index, fallback] of defaults.entries()) {
    const blueprint = blueprints[index]
    const prompt = blueprint
      ? await generatePromptFromBlueprint(blueprint, roleSignals)
      : fallback.prompt

    rounds.push({
      round_number: index + 1,
      round_type: fallback.round_type,
      title: fallback.title,
      prompt,
      duration_minutes: fallback.duration_minutes,
      status: 'pending',
      config: {
        ...(fallback.config || {}),
        ...(blueprint
          ? {
              blueprint_id: blueprint.id,
              competency: blueprint.competency,
              difficulty: blueprint.difficulty,
              format: blueprint.format,
              scoring_rubric: blueprint.scoring_rubric || fallback.config?.scoring_rubric,
              red_flags: blueprint.red_flags,
              anti_cheat_constraints: blueprint.anti_cheat_constraints,
              evidence_requirements: blueprint.evidence_requirements
            }
          : {})
      }
    })
  }

  return rounds
}

async function buildMarketingRounds(blueprints: any[], roleSignals: any) {
  const defaults = [
    {
      title: 'Round 1: Campaign Design Under Constraints',
      round_type: 'text' as const,
      duration_minutes: 14,
      prompt:
        'Scenario: New product capability, limited credibility, need qualified demos. Provide: ICP definition, message pillars, 2-week experiment plan, channels + cadence, and metrics that matter.',
      config: {
        outputs: [
          'ICP definition',
          'message pillars',
          '2-week experiment plan',
          'channels and cadence',
          'metrics that matter'
        ],
        scoring_rubric: {
          dimensions: [
            {
              name: 'clarity_and_positioning',
              description: 'Clarity of positioning and narrative',
              maxScore: 25,
              scoringCriteria: [
                'ICP and positioning are clear and specific',
                'Messaging pillars connect to value and credibility',
                'Avoids vague or generic claims'
              ]
            },
            {
              name: 'experiment_discipline',
              description: 'Quality of experiment plan and constraints',
              maxScore: 25,
              scoringCriteria: [
                '2-week plan is realistic and sequenced',
                'Includes hypothesis and test cadence',
                'Resource and credibility constraints are considered'
              ]
            },
            {
              name: 'measurability',
              description: 'Metrics and success criteria',
              maxScore: 25,
              scoringCriteria: [
                'Defines success metrics beyond vanity',
                'Links metrics to qualified demos',
                'Includes baseline and targets'
              ]
            },
            {
              name: 'credibility_proof',
              description: 'Credibility and proof strategy',
              maxScore: 25,
              scoringCriteria: [
                'Includes proof points or validation plans',
                'Avoids overclaiming',
                'Leverages credible channels or assets'
              ]
            }
          ]
        }
      }
    },
      {
        title: 'Round 2: Content + Distribution Workflow',
        round_type: 'text' as const,
        duration_minutes: 11,
        prompt:
          'Design an AI-assisted content ops pipeline: research → outline → draft → QA → distribution → learnings. Include quality control and brand consistency checks.',
        config: {
          workflow_stages: ['Research', 'Outline', 'Draft', 'QA', 'Distribution', 'Learnings'],
          scoring_rubric: {
            dimensions: [
              {
              name: 'system_thinking',
              description: 'End-to-end workflow design',
              maxScore: 34,
              scoringCriteria: [
                'Covers full pipeline stages',
                'Defines ownership and inputs/outputs',
                'Addresses feedback loop'
              ]
            },
            {
              name: 'quality_gates',
              description: 'Quality control and brand consistency',
              maxScore: 33,
              scoringCriteria: [
                'Includes QA steps and brand checks',
                'Defines acceptance criteria',
                'Prevents low-quality output'
              ]
            },
            {
              name: 'scale_without_noise',
              description: 'Scaling output while maintaining signal',
              maxScore: 33,
              scoringCriteria: [
                'Avoids volume for volume’s sake',
                'Uses prioritization and channel fit',
                'Measures impact and iterates'
              ]
            }
          ]
        }
      }
    },
    {
      title: 'Round 3: Crisis Response (Optional)',
      round_type: 'text' as const,
      duration_minutes: 6,
      prompt:
        'Scenario: Backlash / negative comment thread. Provide a response and containment plan.',
      config: {
        optional: true
      }
    }
  ]

  const rounds = []

  for (const [index, fallback] of defaults.entries()) {
    const blueprint = blueprints[index]
    const prompt = blueprint
      ? await generatePromptFromBlueprint(blueprint, roleSignals)
      : fallback.prompt

    rounds.push({
      round_number: index + 1,
      round_type: fallback.round_type,
      title: fallback.title,
      prompt,
      duration_minutes: fallback.duration_minutes,
      status: 'pending',
      config: {
        ...(fallback.config || {}),
        ...(blueprint
          ? {
              blueprint_id: blueprint.id,
              competency: blueprint.competency,
              difficulty: blueprint.difficulty,
              format: blueprint.format,
              scoring_rubric: blueprint.scoring_rubric || fallback.config?.scoring_rubric,
              red_flags: blueprint.red_flags,
              anti_cheat_constraints: blueprint.anti_cheat_constraints,
              evidence_requirements: blueprint.evidence_requirements
            }
          : {})
      }
    })
  }

  return rounds
}

async function buildPeopleOpsRounds(blueprints: any[], roleSignals: any, level?: string) {
  const levelLabel = typeof level === 'string' ? level.toLowerCase() : 'junior'
  const defaults = [
    {
      title: 'Round 1: Sensitive Employee Query Response',
      round_type: 'text' as const,
      duration_minutes: 9,
      prompt:
        'Scenario: A manager asks you (People Ops) to share details about another employee’s recent performance issues and health-related leave. Draft a response that is discreet, policy-aware, and supportive while still helping the manager move forward. Include: what you can/can’t share, next steps, and how you’ll document/escalate as needed.',
      config: {
        expected_output: [
          'Short response message (5-10 sentences)',
          'Clear boundaries on confidentiality',
          'Next-step actions for the manager'
        ],
        scoring_rubric: {
          dimensions: [
            {
              name: 'confidentiality_and_policy',
              description: 'Protects sensitive information and follows policy',
              maxScore: 25,
              scoringCriteria: [
                'Does not disclose private health or performance details',
                'States boundaries clearly and calmly',
                'Aligns with standard HR confidentiality expectations'
              ]
            },
            {
              name: 'clarity_and_tone',
              description: 'Clear, professional, and empathetic communication',
              maxScore: 25,
              scoringCriteria: [
                'Tone is respectful and supportive',
                'Message is concise and easy to understand',
                'Avoids legalistic or cold language'
              ]
            },
            {
              name: 'actionability',
              description: 'Provides next steps and support',
              maxScore: 25,
              scoringCriteria: [
                'Offers concrete next steps for the manager',
                'Suggests appropriate channels or documentation',
                'Invites follow-up without overcommitting'
              ]
            },
            {
              name: 'judgment_under_uncertainty',
              description: 'Good judgment for a junior People Ops role',
              maxScore: 25,
              scoringCriteria: [
                'Acknowledges limits of authority',
                'Escalates appropriately when needed',
                'Avoids making promises or decisions outside role'
              ]
            }
          ]
        }
      }
    },
    {
      title: 'Round 2: Onboarding Checklist + Cadence',
      round_type: 'text' as const,
      duration_minutes: 11,
      prompt:
        `You are onboarding a ${levelLabel} new hire for a remote team. Create a structured onboarding checklist and a 30/60/90-day cadence plan. Include owners, timing, and follow-ups for each item.`,
      config: {
        outputs: [
          'Checklist by timeframe (Day 1, Week 1, Weeks 2-4, 30/60/90)',
          'Owner for each item (People Ops, Manager, Buddy, IT)',
          'Cadence of check-ins and follow-ups'
        ],
        scoring_rubric: {
          dimensions: [
            {
              name: 'structure_and_completeness',
              description: 'Checklist covers key onboarding needs',
              maxScore: 34,
              scoringCriteria: [
                'Covers logistics, access, and role enablement',
                'Includes culture/team integration',
                'Addresses compliance or policy steps'
              ]
            },
            {
              name: 'cadence_and_ownership',
              description: 'Clear timing and ownership',
              maxScore: 33,
              scoringCriteria: [
                'Defines who owns each step',
                'Cadence includes manager and People Ops check-ins',
                'Includes follow-up reminders or checkpoints'
              ]
            },
            {
              name: 'practicality_for_junior_level',
              description: 'Realistic plan for a junior hire',
              maxScore: 33,
              scoringCriteria: [
                'Scopes expectations appropriately',
                'Balances learning with early delivery',
                'Avoids overloading the first week'
              ]
            }
          ]
        }
      }
    }
  ]

  const rounds = []

  for (const [index, fallback] of defaults.entries()) {
    const blueprint = blueprints[index]
    const prompt = blueprint
      ? await generatePromptFromBlueprint(blueprint, roleSignals)
      : fallback.prompt

    rounds.push({
      round_number: index + 1,
      round_type: fallback.round_type,
      title: fallback.title,
      prompt,
      duration_minutes: fallback.duration_minutes,
      status: 'pending',
      config: {
        ...(fallback.config || {}),
        ...(blueprint
          ? {
              blueprint_id: blueprint.id,
              competency: blueprint.competency,
              difficulty: blueprint.difficulty,
              format: blueprint.format,
              scoring_rubric: blueprint.scoring_rubric || fallback.config?.scoring_rubric,
              red_flags: blueprint.red_flags,
              anti_cheat_constraints: blueprint.anti_cheat_constraints,
              evidence_requirements: blueprint.evidence_requirements
            }
          : {})
      }
    })
  }

  return rounds
}
