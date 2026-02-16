-- Seed Data Steward Blueprint Templates
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
    'data_steward',
    'taxonomy_labeling',
    'adaptive',  -- Will be set to L1/L2/L3 at session time based on PI + experience
    'text',
    '{
      "dimensions": [
        {"name": "precision", "description": "Taxonomy clarity and label precision", "maxScore": 35},
        {"name": "practicality", "description": "Operationally feasible labeling plan", "maxScore": 35},
        {"name": "auditability", "description": "QA and review process is traceable", "maxScore": 30}
      ]
    }'::jsonb,
    '{"flags": ["vague categories", "no QA sampling", "overly complex schema"]}'::jsonb,
    '{"constraints": ["define decision rules", "ensure label consistency"]}'::jsonb,
    '{"evidence": ["taxonomy", "labeling rules", "QA sampling plan"]}'::jsonb,
    15
  ),
  (
    'data_steward',
    'retrieval_failure_diagnosis',
    'adaptive',
    'text',
    '{
      "dimensions": [
        {"name": "diagnosis", "description": "Identifies likely root causes", "maxScore": 40},
        {"name": "fixes", "description": "Proposes pragmatic improvements", "maxScore": 35},
        {"name": "evaluation", "description": "Defines evaluation approach", "maxScore": 25}
      ]
    }'::jsonb,
    '{"flags": ["no root cause", "no evaluation plan"]}'::jsonb,
    '{"constraints": ["reference retrieved sources", "consider chunking + freshness"]}'::jsonb,
    '{"evidence": ["diagnosis", "improvements", "evaluation plan"]}'::jsonb,
    12
  )
ON CONFLICT DO NOTHING;
