-- Seed Marketing Blueprint Templates
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
    'marketing',
    'campaign_strategy',
    'adaptive',  -- Will be set to L1/L2/L3 at session time based on PI + experience
    'text',
    '{
      "dimensions": [
        {"name": "audience_targeting", "description": "Defines target audience with precision", "maxScore": 25},
        {"name": "channel_selection", "description": "Justifies channel mix with data", "maxScore": 25},
        {"name": "messaging_strategy", "description": "Crafts compelling value proposition", "maxScore": 25},
        {"name": "measurement_plan", "description": "Defines KPIs and attribution model", "maxScore": 25}
      ]
    }'::jsonb,
    '{"flags": ["vague audience", "no measurement plan", "channel overload", "weak value prop"]}'::jsonb,
    '{"constraints": ["define at least 3 KPIs", "justify budget allocation"]}'::jsonb,
    '{"evidence": ["audience definition", "channel rationale", "KPI framework", "budget breakdown"]}'::jsonb,
    20
  ),
  (
    'marketing',
    'content_strategy',
    'adaptive',
    'text',
    '{
      "dimensions": [
        {"name": "content_planning", "description": "Maps content to buyer journey stages", "maxScore": 30},
        {"name": "distribution_strategy", "description": "Multi-channel distribution plan", "maxScore": 25},
        {"name": "seo_optimization", "description": "Considers search and discoverability", "maxScore": 20},
        {"name": "repurposing_leverage", "description": "Plans for content repurposing", "maxScore": 25}
      ]
    }'::jsonb,
    '{"flags": ["no buyer journey mapping", "single channel", "ignores SEO", "one-off content"]}'::jsonb,
    '{"constraints": ["address awareness, consideration, decision stages"]}'::jsonb,
    '{"evidence": ["journey mapping", "content calendar", "distribution plan", "repurposing strategy"]}'::jsonb,
    18
  ),
  (
    'marketing',
    'performance_analysis',
    'adaptive',
    'text',
    '{
      "dimensions": [
        {"name": "data_interpretation", "description": "Correctly interprets marketing metrics", "maxScore": 30},
        {"name": "insight_extraction", "description": "Identifies actionable insights from data", "maxScore": 30},
        {"name": "optimization_recommendations", "description": "Proposes data-driven improvements", "maxScore": 25},
        {"name": "experimentation_design", "description": "Designs A/B test or experiment", "maxScore": 15}
      ]
    }'::jsonb,
    '{"flags": ["misinterprets metrics", "no actionable insights", "vague recommendations", "no testing plan"]}'::jsonb,
    '{"constraints": ["analyze funnel conversion rates", "propose specific experiments"]}'::jsonb,
    '{"evidence": ["metric interpretation", "insights list", "optimization plan", "experiment design"]}'::jsonb,
    15
  ),
  (
    'marketing',
    'brand_positioning',
    'adaptive',
    'text',
    '{
      "dimensions": [
        {"name": "competitive_analysis", "description": "Maps competitive landscape", "maxScore": 25},
        {"name": "differentiation", "description": "Defines unique positioning", "maxScore": 30},
        {"name": "messaging_framework", "description": "Creates clear messaging hierarchy", "maxScore": 25},
        {"name": "brand_guidelines", "description": "Outlines voice, tone, visual guidelines", "maxScore": 20}
      ]
    }'::jsonb,
    '{"flags": ["generic positioning", "no competitive analysis", "unclear differentiation", "inconsistent messaging"]}'::jsonb,
    '{"constraints": ["analyze at least 3 competitors", "define 3-5 key messages"]}'::jsonb,
    '{"evidence": ["competitive map", "positioning statement", "messaging framework", "brand guidelines"]}'::jsonb,
    18
  )
ON CONFLICT DO NOTHING;
