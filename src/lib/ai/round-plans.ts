import type { Round, Track } from '@/lib/types/database'

export function getRoundPlan(track: Track): Round[] {
  switch (track) {
    case 'sales':
      return getSalesRounds()
    case 'implementation':
      return getImplementationRounds()
    default:
      throw new Error(`No round plan defined for track: ${track}`)
  }
}

function getSalesRounds(): Round[] {
  return [
    {
      round_number: 1,
      round_type: 'voice',
      title: 'Round 1: Live Persona Sell',
      prompt: 'Conduct a discovery call with a prospect. Ask at least 5 discovery questions, quantify value, and handle objections professionally.',
      duration_minutes: 12,
      status: 'pending',
      config: {
        persona: 'skeptical_buyer',
        required_questions: 5,
        required_objections: 3,
        curveballs: ['budget_cut', 'security_concern', 'timeline_mismatch']
      }
    },
    {
      round_number: 2,
      round_type: 'email',
      title: 'Round 2: Negotiation via Email Thread',
      prompt: 'Respond to the prospect\'s email objections. Maintain professional tone, protect margins, and demonstrate strong negotiation posture.',
      duration_minutes: 15,
      status: 'pending',
      config: {
        thread_depth: 2,
        initial_objection: 'discount_request',
        escalation_objection: 'timeline_pressure'
      }
    },
    {
      round_number: 3,
      round_type: 'text',
      title: 'Round 3: Follow-up Discipline',
      prompt: 'Write an internal handoff note summarizing the deal status, key commitments, and next steps for the account team.',
      duration_minutes: 5,
      status: 'pending',
      config: {
        optional: true
      }
    }
  ]
}

function getImplementationRounds(): Round[] {
  return [
    {
      round_number: 1,
      round_type: 'email',
      title: 'Round 1: Customer Anxiety Response',
      prompt: 'A key client has sent a worried email about contract scope and schedule risk. Write a response that is calm, clear, accountable, and actionable. Restate facts, outline next steps and timeline, and avoid legal overreach.',
      duration_minutes: 10,
      status: 'pending',
      config: {
        track: 'implementation',
        persona_type: 'implementation_client',
        initial_email: {
          from: 'David Park',
          title: 'Director of IT, Meridian Health',
          subject: 'RE: Concerns about Phase 2 Timeline and Scope',
          body: `Hi,

I need to flag some serious concerns about our Phase 2 rollout. We're 3 weeks from go-live and I'm hearing from my team that:

1. The SSO integration is still failing intermittently in staging
2. The data migration scripts haven't been tested against our production dataset (we have 2.3M patient records)
3. Two of the custom workflow configurations we discussed in the SOW haven't been started

We signed this contract expecting a Q1 go-live. My CTO is asking me for a status update on Monday and I need to give her honest answers.

I don't want to escalate this to your leadership but I'm running out of options. Can you help me understand where we actually stand?

David Park
Director of IT, Meridian Health`
        },
        thread_depth: 2,
        scoring_dimensions: ['tone_and_clarity', 'de_escalation', 'commitment_accuracy', 'next_step_structure']
      }
    },
    {
      round_number: 2,
      round_type: 'multi_channel',
      title: 'Round 2: Technical Integration & Internal Alignment',
      prompt: 'A customer has sent technical API/integration questions. Coordinate with your internal team (Pre-sales Engineer and Product Owner) to gather accurate information, then craft a precise customer response with realistic timelines and expectations.',
      duration_minutes: 18,
      status: 'pending',
      config: {
        track: 'implementation',
        customer_email: {
          from: 'David Park',
          title: 'Director of IT, Meridian Health',
          subject: 'RE: API Integration Questions for Phase 2',
          body: `Following up on our earlier conversation. My engineering team has specific questions:

1. Does your REST API support bulk operations for patient record imports? We need to handle 50K+ records per batch.
2. What's the authentication mechanism for the webhook callbacks? We need this to comply with our HIPAA audit requirements.
3. Can we get a sandbox environment that mirrors production data schemas? Our QA team needs 2 weeks minimum for regression testing.
4. The SOW mentions "custom workflow engine" -- is this configurable via API or does it require professional services engagement?

We need answers this week to stay on track. I've also CC'd our CISO who will need the security documentation.

David`
        },
        internal_agents: [
          {
            agent_id: 'presales_engineer',
            name: 'Alex Rivera',
            role: 'Pre-sales Engineer',
            avatar_color: 'bg-indigo-100',
            persona: `You are Alex Rivera, a Pre-sales Engineer at this company. You have deep technical knowledge of the platform's API capabilities, but you sometimes overcommit on timelines. You know:
- The REST API supports bulk operations up to 10K records per batch (NOT 50K — this is a hard platform limit)
- Webhook auth uses OAuth 2.0 with JWT tokens, fully HIPAA compliant
- Sandbox environments take 3-5 business days to provision
- The workflow engine has a REST API for basic configurations, but complex custom workflows need professional services engagement (typically 2-3 week engagement)
Be helpful but technically precise. If asked about things you're unsure of, say so. Keep responses to 2-4 sentences.`
          },
          {
            agent_id: 'product_owner',
            name: 'Maria Santos',
            role: 'Product Owner',
            avatar_color: 'bg-amber-100',
            persona: `You are Maria Santos, a Product Owner who owns the product roadmap and knows feature status. You know:
- Bulk import API enhancement to 50K is on the roadmap for Q3 (not available now — current limit is 10K per batch)
- The sandbox provisioning process was recently improved; it's now 2-3 business days
- Custom workflow API v2 is in beta; stable release is 6 weeks out
- HIPAA documentation package is available but needs to be updated for the latest release (last updated 3 months ago)
Be honest about limitations. Push back gently if the implementation manager tries to promise things that aren't ready yet. Raise risks proactively. Keep responses to 2-4 sentences.`
          }
        ],
        scoring_dimensions: ['internal_coordination', 'technical_comprehension', 'customer_communication_quality', 'risk_identification']
      }
    },
    {
      round_number: 3,
      round_type: 'text',
      title: 'Round 3: Go-live Gate Design',
      prompt: 'Based on what you learned in the previous rounds, produce a go-live checklist and acceptance criteria for Phase 2. Include technical readiness checks, stakeholder sign-offs, rollback plan, and success metrics.',
      duration_minutes: 8,
      status: 'pending',
      config: {
        track: 'implementation',
        optional: true,
        guidance: [
          'Technical readiness checks (SSO, data migration, API integrations)',
          'Stakeholder sign-off matrix (who approves what)',
          'Rollback plan with specific triggers',
          'Success metrics and monitoring for first 48 hours',
          'Communication plan for go-live day'
        ]
      }
    }
  ]
}
