-- Seed Data Steward / Knowledge rounds (blueprints + generated items)
-- Run after assessment_blueprints_migration.sql and question_factory_migration.sql

WITH blueprints AS (
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
      'Taxonomy + Labeling Plan',
      'L2',
      'short_answer',
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
      'Retrieval Failure Diagnosis',
      'L2',
      'short_answer',
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
  RETURNING id, track, competency, difficulty, format, time_limit_minutes, scoring_rubric, red_flags, anti_cheat_constraints, evidence_requirements
)
INSERT INTO generated_question_items (
  blueprint_id,
  track,
  competency,
  difficulty,
  format,
  prompt,
  expected_output,
  scoring_rubric,
  red_flags,
  anti_cheat_constraints,
  evidence_requirements,
  time_limit_minutes,
  version,
  hash,
  status,
  validation_report
)
SELECT
  id,
  track,
  competency,
  difficulty,
  format,
  CASE
    WHEN competency = 'Taxonomy + Labeling Plan' THEN
      $$Round 1: Taxonomy + labeling plan (12–15 minutes).

Messy doc set: See the attached PDF in this round.

Create:
- a taxonomy (top-level + 1 level of subcategories)
- labeling rules (what qualifies for each label)
- a QA sampling plan (sample size + frequency + reviewer workflow)

Scoring focuses on precision, practicality, and auditability.$$ 
    ELSE
      $$Round 2: Retrieval failure diagnosis (10–12 minutes).

You are given 3 bad AI outputs and the retrieved sources used.
Diagnose likely issues (stale doc, wrong chunking, missing source, ambiguity),
propose improvements, and outline an evaluation approach.

Bad output 1:
“ISO 8601 recommends MM/DD/YYYY for international dates.”
Retrieved sources:
- ISO 8601 sets YYYY-MM-DD ordering; date elements are ordered year, month, day.

Bad output 2:
“NIST AI RMF 1.0 is a mandatory U.S. regulation that companies must follow.”
Retrieved sources:
- NIST AI RMF 1.0 is intended to be voluntary and flexible for organizations.

Bad output 3:
“Overtime exemption depends on job title; ‘manager’ titles are always exempt.”
Retrieved sources:
- DOL fact sheets state job titles do not determine exemption status; duties and salary do.

Your response should list likely root causes, fixes, and evaluation plan.$$ 
  END AS prompt,
  CASE
    WHEN competency = 'Taxonomy + Labeling Plan' THEN
      $$- Taxonomy
- Labeling rules
- QA sampling plan$$
    ELSE
      $$- Diagnosis per failure
- Proposed improvements
- Evaluation plan$$
  END AS expected_output,
  scoring_rubric,
  red_flags,
  anti_cheat_constraints,
  evidence_requirements,
  time_limit_minutes,
  1 AS version,
  CASE
    WHEN competency = 'Taxonomy + Labeling Plan' THEN 'seed_data_steward_round1_v1'
    ELSE 'seed_data_steward_round2_v1'
  END AS hash,
  'validated' AS status,
  CASE
    WHEN competency = 'Taxonomy + Labeling Plan' THEN
      jsonb_build_object(
        'pdf_by_difficulty',
        jsonb_build_object(
          'L1', '/docs/messy-doc-set-l1.pdf',
          'L2', '/docs/messy-doc-set-l2.pdf',
          'L3', '/docs/messy-doc-set-l3.pdf'
        ),
        'pdf_title',
        'Messy Doc Set'
      )
    ELSE '{}'::jsonb
  END AS validation_report
FROM blueprints;
