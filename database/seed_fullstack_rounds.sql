-- Seed Full-stack Engineering Blueprint Templates
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
    'fullstack',
    'feature_implementation',
    'adaptive',  -- Will be set to L1/L2/L3 at session time based on PI + experience
    'code',
    '{
      "dimensions": [
        {"name": "decomposition", "description": "Breaks work into clear, sequential steps", "maxScore": 20},
        {"name": "correctness", "description": "Reasoning about edge cases and expected behavior", "maxScore": 20},
        {"name": "verification", "description": "Test plan + at least 2 tests", "maxScore": 20},
        {"name": "security_performance", "description": "Mentions security/perf concerns", "maxScore": 20},
        {"name": "incremental_shipping", "description": "Can ship in small steps", "maxScore": 20}
      ]
    }'::jsonb,
    '{"flags": ["hand-wavy tests", "no edge cases", "overpromising scope"]}'::jsonb,
    '{"constraints": ["no external libs without justification", "avoid copy-paste"]}'::jsonb,
    '{"evidence": ["design outline", "implementation skeleton", "test plan", "2+ tests", "verification checklist"]}'::jsonb,
    20
  ),
  (
    'fullstack',
    'code_review_debugging',
    'adaptive',
    'text',  -- Changed from mcq to text for flexibility
    '{
      "dimensions": [
        {"name": "bug_finding", "description": "Identifies security + correctness issues", "maxScore": 30},
        {"name": "fix_quality", "description": "Proposes safe fixes", "maxScore": 25},
        {"name": "impact_analysis", "description": "Predicts downstream effects", "maxScore": 25},
        {"name": "debugging", "description": "Approach + prioritization", "maxScore": 20}
      ]
    }'::jsonb,
    '{"flags": ["misses auth bypass", "ignores race condition", "no error handling"]}'::jsonb,
    '{"constraints": ["code must contain real bugs", "cascading effects required"]}'::jsonb,
    '{"evidence": ["issue list", "fix proposal", "impact analysis", "cascade response"]}'::jsonb,
    15
  ),
  (
    'fullstack',
    'systems_thinking',
    'adaptive',
    'text',
    '{
      "dimensions": [
        {"name": "metrics", "description": "Defines success + guardrail metrics", "maxScore": 40},
        {"name": "observability", "description": "Monitoring + alerting plan", "maxScore": 30},
        {"name": "rollback", "description": "Rollback + regression plan", "maxScore": 30}
      ]
    }'::jsonb,
    '{"flags": ["no metrics", "no rollback"]}'::jsonb,
    '{"constraints": ["include rollout + rollback"]}'::jsonb,
    '{"evidence": ["metrics list", "monitoring plan", "rollback steps"]}'::jsonb,
    8
  )
ON CONFLICT DO NOTHING;
