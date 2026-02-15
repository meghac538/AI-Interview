-- Seed Full-stack Engineering rounds (blueprints + generated items)
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
      'fullstack',
      'Build + Test a Rotating Feature',
      'L2',
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
      'Code Review Trap + Cascading Failure',
      'L2',
      'mcq',
      '{
        "dimensions": [
          {"name": "bug_finding", "description": "Identifies security + correctness issues", "maxScore": 30},
          {"name": "fix_quality", "description": "Proposes safe fixes", "maxScore": 25},
          {"name": "impact_analysis", "description": "Predicts downstream effects", "maxScore": 25},
          {"name": "debugging", "description": "Approach + prioritization", "maxScore": 20}
        ]
      }'::jsonb,
      '{"flags": ["misses auth bypass", "ignores race condition", "no error handling"]}'::jsonb,
      '{"constraints": ["call out injection risk", "mention off-by-one"]}'::jsonb,
      '{"evidence": ["issue list", "fix proposal", "impact analysis", "cascade response"]}'::jsonb,
      20
    ),
    (
      'fullstack',
      'Systems Thinking: Production Evaluation',
      'L1',
      'short_answer',
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
    WHEN competency = 'Build + Test a Rotating Feature' THEN
      $$Round 1: Build + test a rotating feature (15–20 minutes).

App gives:
- feature request
- tech stack
- constraints (time, acceptance criteria)

Candidate produces:
- design outline
- implementation skeleton
- test plan + at least 2 tests
- verification checklist

Scoring focuses on decomposition, correctness instincts, verification discipline, security/performance awareness, and ability to ship incrementally.$$ 
    WHEN competency = 'Code Review Trap + Cascading Failure' THEN
      $$Code review trap + cascading failure (15–20 minutes).

Select the one correct snippet. The others contain at least one issue:
- auth bypass
- race condition
- off-by-one causing data corruption
- missing error handling
- injection risk$$
    ELSE
      $$Optional Round 3: Systems thinking (5–8 minutes).

Prompt: “How would you evaluate this agent feature in production?”
Expect metrics, rollback plan, monitoring, and regression plan.$$ 
  END AS prompt,
  CASE
    WHEN competency = 'Build + Test a Rotating Feature' THEN
      $$- Design outline
- Implementation skeleton (pseudocode ok)
- Test plan (2+ tests)
- Verification checklist$$
    WHEN competency = 'Code Review Trap + Cascading Failure' THEN
      $$Select one option. No written response required.$$ 
    ELSE
      $$- Metrics
- Monitoring/alerting
- Rollback + regression plan$$
  END AS expected_output,
  scoring_rubric,
  red_flags,
  anti_cheat_constraints,
  evidence_requirements,
  time_limit_minutes,
  1 AS version,
  CASE
    WHEN competency = 'Build + Test a Rotating Feature' THEN 'seed_fullstack_round1_v1'
    WHEN competency = 'Code Review Trap + Cascading Failure' THEN 'seed_fullstack_round2_v1'
    ELSE 'seed_fullstack_round3_v1'
  END AS hash,
  'validated' AS status,
  CASE
    WHEN competency = 'Code Review Trap + Cascading Failure' THEN
      '{
        "options": [
          {
            "id": "A",
            "label": "Snippet A",
            "code": "app.get('/users/:id', async (req, res) => {\\n  const { id } = req.params;\\n  const user = await db.query(`SELECT * FROM users WHERE id = ${id}`);\\n  res.json(user.rows[0]);\\n});",
            "description": "Potential SQL injection."
          },
          {
            "id": "B",
            "label": "Snippet B",
            "code": "app.get('/users/:id', async (req, res) => {\\n  const { id } = req.params;\\n  const user = await db.query('SELECT * FROM users WHERE id = $1', [id]);\\n  if (!user.rows[0]) return res.status(404).json({ error: 'Not found' });\\n  res.json(user.rows[0]);\\n});",
            "description": "Parameterized query with error handling."
          },
          {
            "id": "C",
            "label": "Snippet C",
            "code": "app.get('/users/:id', async (req, res) => {\\n  const { id } = req.params;\\n  const user = await db.query('SELECT * FROM users WHERE id = $1', [id]);\\n  res.json(user.rows[1]);\\n});",
            "description": "Off-by-one bug."
          },
          {
            "id": "D",
            "label": "Snippet D",
            "code": "app.get('/users/:id', async (req, res) => {\\n  if (req.headers['x-admin'] !== 'true') {\\n    res.json({ ok: true });\\n    return;\\n  }\\n  const user = await db.query('SELECT * FROM users');\\n  res.json(user.rows[0]);\\n});",
            "description": "Auth bypass + data leak."
          }
        ]\n      }'::jsonb
    ELSE '{}'::jsonb
  END AS validation_report
FROM blueprints;
