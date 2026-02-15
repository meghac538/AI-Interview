export const RED_FLAG_TYPES = {
  unsafe_data_handling: {
    label: 'Unsafe Data Handling',
    description: 'PII leakage, secret sharing, or security negligence',
    defaultSeverity: 'critical' as const,
    autoStop: true,
  },
  overconfident_without_verification: {
    label: 'Overconfident Without Verification',
    description: 'Makes claims without any verification or testing plan',
    defaultSeverity: 'critical' as const,
    autoStop: true,
  },
  overpromising: {
    label: 'Overpromising',
    description: 'Overpromises capabilities or invents terms/features',
    defaultSeverity: 'critical' as const,
    autoStop: true,
  },
  no_testing_mindset: {
    label: 'No Testing Mindset',
    description: 'Ignores testing, QA, or security basics',
    defaultSeverity: 'critical' as const,
    autoStop: true,
  },
  conflict_escalation: {
    label: 'Conflict Escalation',
    description: 'Escalates conflict or makes commitments they cannot own',
    defaultSeverity: 'critical' as const,
    autoStop: true,
  },
  insufficient_response: {
    label: 'Insufficient Response',
    description: 'Response too short to evaluate',
    defaultSeverity: 'warning' as const,
    autoStop: false,
  },
  no_evidence: {
    label: 'No Evidence',
    description: 'No evidence quotes available for scoring',
    defaultSeverity: 'warning' as const,
    autoStop: false,
  },
  custom: {
    label: 'Custom Observation',
    description: 'Manually flagged by interviewer',
    defaultSeverity: 'warning' as const,
    autoStop: false,
  },
} as const

export type RedFlagTypeKey = keyof typeof RED_FLAG_TYPES

// Track-specific flag mappings: which flags apply to which tracks
export const TRACK_FLAG_FILTERS: Partial<Record<RedFlagTypeKey, string[]>> = {
  overpromising: ['sales', 'marketing'],
  no_testing_mindset: ['agentic_eng', 'fullstack'],
  conflict_escalation: ['implementation', 'HR', 'data_steward', 'knowledge'],
  unsafe_data_handling: ['security', 'data', 'data_steward'],
}
