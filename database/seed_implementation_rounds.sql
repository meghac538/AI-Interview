-- Seed Implementation Blueprint Templates
-- Run after assessment_blueprints_migration.sql
-- Questions will be generated dynamically based on candidate profile + PI screening

INSERT INTO assessment_blueprints (
  track,
  competency,
  difficulty,
  format,
  scoring_rubric,
  red_flags,
  anti_cheat_constraints,
  evidence_requirements,
  time_limit_minutes
) VALUES
  (
    'implementation',
    'requirements_gathering',
    'adaptive',  -- Will be set to L1/L2/L3 at session time based on PI + experience
    'text',
    '{
      "dimensions": [
        {"name": "discovery_questions", "description": "Asks probing questions to understand needs", "maxScore": 25},
        {"name": "technical_scoping", "description": "Identifies technical constraints and requirements", "maxScore": 25},
        {"name": "stakeholder_alignment", "description": "Plans for multi-stakeholder alignment", "maxScore": 25},
        {"name": "success_criteria", "description": "Defines measurable success metrics", "maxScore": 25}
      ]
    }'::jsonb,
    '{"flags": ["assumes requirements", "ignores technical constraints", "no stakeholder mapping", "vague success criteria"]}'::jsonb,
    '{"constraints": ["identify at least 3 stakeholder groups", "define 3-5 success metrics"]}'::jsonb,
    '{"evidence": ["discovery questions", "technical requirements", "stakeholder map", "success criteria"]}'::jsonb,
    18
  ),
  (
    'implementation',
    'implementation_planning',
    'adaptive',
    'text',
    '{
      "dimensions": [
        {"name": "phased_approach", "description": "Breaks implementation into logical phases", "maxScore": 30},
        {"name": "risk_mitigation", "description": "Identifies and plans for risks", "maxScore": 25},
        {"name": "resource_planning", "description": "Defines resource needs and timeline", "maxScore": 25},
        {"name": "change_management", "description": "Plans for user adoption and training", "maxScore": 20}
      ]
    }'::jsonb,
    '{"flags": ["no phasing", "ignores risks", "unrealistic timeline", "no change management"]}'::jsonb,
    '{"constraints": ["define at least 3 phases", "identify 3-5 risks with mitigation"]}'::jsonb,
    '{"evidence": ["phase breakdown", "risk register", "resource plan", "adoption strategy"]}'::jsonb,
    20
  ),
  (
    'implementation',
    'technical_problem_solving',
    'adaptive',
    'text',
    '{
      "dimensions": [
        {"name": "root_cause_analysis", "description": "Systematically identifies root causes", "maxScore": 30},
        {"name": "solution_design", "description": "Proposes pragmatic technical solutions", "maxScore": 30},
        {"name": "trade_off_analysis", "description": "Evaluates solution trade-offs", "maxScore": 20},
        {"name": "validation_plan", "description": "Defines how to validate solution", "maxScore": 20}
      ]
    }'::jsonb,
    '{"flags": ["jumps to solution", "no root cause", "ignores trade-offs", "no validation plan"]}'::jsonb,
    '{"constraints": ["use structured problem-solving approach", "consider 2-3 alternative solutions"]}'::jsonb,
    '{"evidence": ["root cause analysis", "solution options", "trade-off matrix", "validation steps"]}'::jsonb,
    18
  ),
  (
    'implementation',
    'customer_communication',
    'adaptive',
    'email',
    '{
      "dimensions": [
        {"name": "clarity", "description": "Explains technical concepts clearly", "maxScore": 25},
        {"name": "empathy", "description": "Acknowledges customer concerns", "maxScore": 20},
        {"name": "action_orientation", "description": "Provides clear next steps", "maxScore": 30},
        {"name": "escalation_handling", "description": "Appropriately manages escalations", "maxScore": 25}
      ]
    }'::jsonb,
    '{"flags": ["technical jargon overload", "dismissive tone", "no action items", "defensive posture"]}'::jsonb,
    '{"constraints": ["explain technical issues in business terms", "provide specific timeline"]}'::jsonb,
    '{"evidence": ["clear explanation", "action items", "timeline", "escalation path"]}'::jsonb,
    15
  )
ON CONFLICT DO NOTHING;
