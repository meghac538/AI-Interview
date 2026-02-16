-- Seed HR (People Ops) Blueprint Templates
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
    'HR',
    'employee_relations',
    'adaptive',  -- Will be set to L1/L2/L3 at session time based on PI + experience
    'text',
    '{
      "dimensions": [
        {"name": "situation_assessment", "description": "Accurately assesses employee relations issue", "maxScore": 25},
        {"name": "legal_compliance", "description": "Considers legal and policy implications", "maxScore": 30},
        {"name": "intervention_strategy", "description": "Proposes appropriate intervention", "maxScore": 25},
        {"name": "documentation", "description": "Plans for proper documentation", "maxScore": 20}
      ]
    }'::jsonb,
    '{"flags": ["ignores legal risk", "no documentation plan", "biased approach", "overly punitive"]}'::jsonb,
    '{"constraints": ["consider employment law", "balance employee and company interests"]}'::jsonb,
    '{"evidence": ["situation analysis", "legal considerations", "intervention plan", "documentation approach"]}'::jsonb,
    18
  ),
  (
    'HR',
    'talent_acquisition',
    'adaptive',
    'text',
    '{
      "dimensions": [
        {"name": "job_analysis", "description": "Defines role requirements accurately", "maxScore": 25},
        {"name": "sourcing_strategy", "description": "Develops multi-channel sourcing plan", "maxScore": 25},
        {"name": "selection_criteria", "description": "Creates objective selection criteria", "maxScore": 25},
        {"name": "candidate_experience", "description": "Designs positive candidate journey", "maxScore": 25}
      ]
    }'::jsonb,
    '{"flags": ["vague requirements", "single source channel", "subjective criteria", "poor candidate experience"]}'::jsonb,
    '{"constraints": ["define must-have vs nice-to-have", "plan for diversity sourcing"]}'::jsonb,
    '{"evidence": ["job analysis", "sourcing channels", "selection rubric", "candidate journey map"]}'::jsonb,
    20
  ),
  (
    'HR',
    'performance_management',
    'adaptive',
    'text',
    '{
      "dimensions": [
        {"name": "goal_setting", "description": "Creates SMART performance goals", "maxScore": 25},
        {"name": "feedback_delivery", "description": "Plans for constructive feedback", "maxScore": 30},
        {"name": "development_planning", "description": "Creates actionable development plan", "maxScore": 25},
        {"name": "performance_issues", "description": "Addresses underperformance appropriately", "maxScore": 20}
      ]
    }'::jsonb,
    '{"flags": ["vague goals", "avoids difficult feedback", "no development plan", "delayed intervention"]}'::jsonb,
    '{"constraints": ["goals must be measurable", "include improvement timeline"]}'::jsonb,
    '{"evidence": ["SMART goals", "feedback plan", "development actions", "PIP if needed"]}'::jsonb,
    18
  ),
  (
    'HR',
    'compensation_benefits',
    'adaptive',
    'text',
    '{
      "dimensions": [
        {"name": "market_analysis", "description": "Analyzes compensation market data", "maxScore": 30},
        {"name": "equity_analysis", "description": "Ensures internal equity", "maxScore": 25},
        {"name": "total_rewards", "description": "Considers total compensation package", "maxScore": 25},
        {"name": "communication_strategy", "description": "Plans transparent comp communication", "maxScore": 20}
      ]
    }'::jsonb,
    '{"flags": ["ignores market data", "equity concerns", "focus only on cash", "opaque communication"]}'::jsonb,
    '{"constraints": ["reference market benchmarks", "address pay equity"]}'::jsonb,
    '{"evidence": ["market data", "equity analysis", "total rewards summary", "communication plan"]}'::jsonb,
    20
  ),
  (
    'HR',
    'organizational_development',
    'adaptive',
    'text',
    '{
      "dimensions": [
        {"name": "needs_assessment", "description": "Identifies organizational development needs", "maxScore": 25},
        {"name": "intervention_design", "description": "Designs appropriate OD intervention", "maxScore": 30},
        {"name": "change_management", "description": "Plans for change adoption", "maxScore": 25},
        {"name": "measurement", "description": "Defines success metrics", "maxScore": 20}
      ]
    }'::jsonb,
    '{"flags": ["no needs analysis", "generic intervention", "ignores resistance", "no metrics"]}'::jsonb,
    '{"constraints": ["use data to identify needs", "plan for resistance"]}'::jsonb,
    '{"evidence": ["needs assessment", "intervention plan", "change strategy", "success metrics"]}'::jsonb,
    20
  )
ON CONFLICT DO NOTHING;
