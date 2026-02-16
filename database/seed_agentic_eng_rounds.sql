-- Seed Agentic Engineering Blueprint Templates
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
    'agentic_eng',
    'agent_architecture_design',
    'adaptive',  -- Will be set to L1/L2/L3 at session time based on PI + experience
    'text',
    '{
      "dimensions": [
        {"name": "task_decomposition", "description": "Breaks problem into agent-solvable subtasks", "maxScore": 25},
        {"name": "tool_selection", "description": "Identifies appropriate tools and APIs", "maxScore": 25},
        {"name": "orchestration_strategy", "description": "Designs agent coordination and state management", "maxScore": 25},
        {"name": "error_handling", "description": "Plans for failure modes and recovery", "maxScore": 25}
      ]
    }'::jsonb,
    '{"flags": ["monolithic design", "no error handling", "poor state management", "tool overload"]}'::jsonb,
    '{"constraints": ["define agent boundaries", "consider latency and cost"]}'::jsonb,
    '{"evidence": ["task decomposition", "tool selection rationale", "orchestration diagram", "error handling strategy"]}'::jsonb,
    20
  ),
  (
    'agentic_eng',
    'prompt_engineering',
    'adaptive',
    'text',
    '{
      "dimensions": [
        {"name": "instruction_clarity", "description": "Writes clear, unambiguous prompts", "maxScore": 25},
        {"name": "context_optimization", "description": "Efficiently provides necessary context", "maxScore": 25},
        {"name": "output_structuring", "description": "Specifies structured output format", "maxScore": 25},
        {"name": "edge_case_handling", "description": "Addresses edge cases in prompt", "maxScore": 25}
      ]
    }'::jsonb,
    '{"flags": ["vague instructions", "excessive context", "no output format", "ignores edge cases"]}'::jsonb,
    '{"constraints": ["use few-shot examples", "specify output JSON schema"]}'::jsonb,
    '{"evidence": ["prompt text", "example inputs/outputs", "edge case handling", "output schema"]}'::jsonb,
    18
  ),
  (
    'agentic_eng',
    'tool_implementation',
    'adaptive',
    'code',
    '{
      "dimensions": [
        {"name": "function_design", "description": "Designs clean function interface", "maxScore": 25},
        {"name": "parameter_validation", "description": "Validates inputs robustly", "maxScore": 20},
        {"name": "error_handling", "description": "Handles errors gracefully", "maxScore": 25},
        {"name": "documentation", "description": "Documents function for LLM consumption", "maxScore": 30}
      ]
    }'::jsonb,
    '{"flags": ["no input validation", "cryptic errors", "missing docstring", "side effects not documented"]}'::jsonb,
    '{"constraints": ["return structured data", "include usage examples in docstring"]}'::jsonb,
    '{"evidence": ["function signature", "validation logic", "error handling", "docstring with examples"]}'::jsonb,
    20
  ),
  (
    'agentic_eng',
    'agent_evaluation',
    'adaptive',
    'text',
    '{
      "dimensions": [
        {"name": "test_case_design", "description": "Designs comprehensive test cases", "maxScore": 30},
        {"name": "evaluation_metrics", "description": "Defines appropriate success metrics", "maxScore": 25},
        {"name": "edge_case_coverage", "description": "Covers edge cases and failure modes", "maxScore": 25},
        {"name": "benchmarking", "description": "Plans for performance benchmarking", "maxScore": 20}
      ]
    }'::jsonb,
    '{"flags": ["only happy path tests", "no metrics", "ignores edge cases", "no performance baseline"]}'::jsonb,
    '{"constraints": ["define pass/fail criteria", "include latency and cost metrics"]}'::jsonb,
    '{"evidence": ["test case list", "evaluation metrics", "edge case coverage", "benchmark plan"]}'::jsonb,
    18
  ),
  (
    'agentic_eng',
    'rag_system_design',
    'adaptive',
    'text',
    '{
      "dimensions": [
        {"name": "chunking_strategy", "description": "Designs appropriate document chunking", "maxScore": 25},
        {"name": "retrieval_approach", "description": "Selects retrieval method (vector, hybrid, etc)", "maxScore": 25},
        {"name": "reranking_strategy", "description": "Plans for result reranking and filtering", "maxScore": 25},
        {"name": "context_optimization", "description": "Optimizes context window usage", "maxScore": 25}
      ]
    }'::jsonb,
    '{"flags": ["naive chunking", "no reranking", "context overflow", "ignores document structure"]}'::jsonb,
    '{"constraints": ["consider document types", "plan for context limits"]}'::jsonb,
    '{"evidence": ["chunking approach", "retrieval strategy", "reranking logic", "context management"]}'::jsonb,
    20
  ),
  (
    'agentic_eng',
    'agent_debugging',
    'adaptive',
    'text',
    '{
      "dimensions": [
        {"name": "issue_diagnosis", "description": "Systematically diagnoses agent failures", "maxScore": 30},
        {"name": "root_cause_analysis", "description": "Identifies root causes vs symptoms", "maxScore": 30},
        {"name": "fix_strategy", "description": "Proposes targeted fixes", "maxScore": 25},
        {"name": "prevention", "description": "Plans for preventing similar issues", "maxScore": 15}
      ]
    }'::jsonb,
    '{"flags": ["treats symptoms", "no systematic debugging", "band-aid fixes", "no prevention plan"]}'::jsonb,
    '{"constraints": ["analyze logs and traces", "consider prompt, tools, and orchestration"]}'::jsonb,
    '{"evidence": ["diagnosis process", "root cause", "proposed fix", "prevention strategy"]}'::jsonb,
    18
  )
ON CONFLICT DO NOTHING;
