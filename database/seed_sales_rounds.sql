-- Seed Sales Blueprint Templates
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
    'sales',
    'discovery_qualification',
    'adaptive',  -- Will be set to L1/L2/L3 at session time based on PI + experience
    'voice',
    '{
      "dimensions": [
        {"name": "questioning", "description": "Asks probing questions to uncover needs", "maxScore": 25},
        {"name": "active_listening", "description": "Demonstrates understanding through paraphrasing", "maxScore": 20},
        {"name": "qualification", "description": "Identifies budget, timeline, decision process", "maxScore": 25},
        {"name": "value_articulation", "description": "Connects solution to prospect pain points", "maxScore": 30}
      ]
    }'::jsonb,
    '{"flags": ["talks over prospect", "pitches too early", "ignores objections", "no BANT qualification"]}'::jsonb,
    '{"constraints": ["must qualify before pitching", "handle at least 2 objections"]}'::jsonb,
    '{"evidence": ["qualifying questions", "objection handling", "value connection"]}'::jsonb,
    15
  ),
  (
    'sales',
    'objection_handling',
    'adaptive',
    'voice',
    '{
      "dimensions": [
        {"name": "acknowledgment", "description": "Validates concern without dismissing", "maxScore": 20},
        {"name": "reframing", "description": "Reframes objection into opportunity", "maxScore": 30},
        {"name": "evidence_based_response", "description": "Uses data, case studies, or testimonials", "maxScore": 25},
        {"name": "trial_close", "description": "Advances conversation after addressing concern", "maxScore": 25}
      ]
    }'::jsonb,
    '{"flags": ["defensive response", "no evidence", "fails to advance", "avoids pricing objection"]}'::jsonb,
    '{"constraints": ["handle pricing and competition objections", "must attempt trial close"]}'::jsonb,
    '{"evidence": ["acknowledgment phrases", "reframing technique", "trial close attempt"]}'::jsonb,
    12
  ),
  (
    'sales',
    'negotiation_closing',
    'adaptive',
    'email',
    '{
      "dimensions": [
        {"name": "value_reinforcement", "description": "Reminds of ROI and business impact", "maxScore": 25},
        {"name": "concession_strategy", "description": "Makes strategic concessions with reciprocity", "maxScore": 30},
        {"name": "urgency_creation", "description": "Creates legitimate urgency without pressure", "maxScore": 20},
        {"name": "deal_structure", "description": "Proposes creative deal structure", "maxScore": 25}
      ]
    }'::jsonb,
    '{"flags": ["heavy discounting", "no reciprocity", "artificial urgency", "gives away too much"]}'::jsonb,
    '{"constraints": ["max 15% discount without reciprocity", "must include next steps"]}'::jsonb,
    '{"evidence": ["value summary", "concession strategy", "urgency rationale", "proposed terms"]}'::jsonb,
    20
  ),
  (
    'sales',
    'enterprise_stakeholder_mapping',
    'adaptive',
    'text',
    '{
      "dimensions": [
        {"name": "stakeholder_identification", "description": "Identifies key decision makers and influencers", "maxScore": 30},
        {"name": "influence_mapping", "description": "Maps relationships and influence patterns", "maxScore": 25},
        {"name": "champion_development", "description": "Strategy for building internal champions", "maxScore": 25},
        {"name": "multi_threading", "description": "Plan for engaging multiple stakeholders", "maxScore": 20}
      ]
    }'::jsonb,
    '{"flags": ["single-threaded", "ignores procurement", "no champion strategy", "assumes authority"]}'::jsonb,
    '{"constraints": ["identify at least 5 stakeholders", "map power dynamics"]}'::jsonb,
    '{"evidence": ["stakeholder list with roles", "influence map", "champion strategy", "engagement plan"]}'::jsonb,
    15
  )
ON CONFLICT DO NOTHING;
