// Database Types - Production Schema

export type SessionStatus = 'scheduled' | 'live' | 'completed' | 'aborted'
export type RoundStatus = 'pending' | 'active' | 'completed' | 'skipped'
export type RoundType = 'voice' | 'email' | 'text' | 'code'
export type CandidateStatus = 'applied' | 'pi_scheduled' | 'pi_passed' | 'live_scheduled' | 'live_completed' | 'rejected' | 'advanced'
export type Track = 'sales' | 'agentic_eng' | 'fullstack' | 'marketing' | 'implementation' | 'HR' | 'security'

// 1. Job Profiles
export interface JobProfile {
  id: string
  job_id: string // Rippling job id
  title: string
  location: string
  level_band: 'junior' | 'mid' | 'senior'
  track: Track
  role_success_criteria: string
  must_have_flags: string[]
  disqualifiers: string[]
  gating_thresholds: Record<string, any>
  created_at?: string
}

// 2. Assessment Blueprints
export interface AssessmentBlueprint {
  id: string
  track: Track
  module_name: string
  difficulty: string
  question_templates: Record<string, any>
  rubric: Record<string, any>
  red_flags: Record<string, any>
  time_limits: Record<string, any>
  created_at?: string
}

// 3. Agents Registry
export interface AgentRegistry {
  id: string
  agent_type: string
  provider: 'ElevenLabs' | 'internal'
  agent_id: string
  supported_tracks: Track[]
  region: 'US' | 'IN'
  voice_profile: Record<string, any>
  created_at?: string
}

// 4. Models Registry
export interface ModelRegistry {
  id: string
  model_key: string
  provider: string
  purpose: string
  edgeadmin_endpoint: string | null
  budget_policy: Record<string, any>
  created_at?: string
}

// 5. Candidates
export interface Candidate {
  id: string
  rippling_candidate_id: string
  name: string
  email: string
  phone: string | null
  country: string | null
  job_id: string
  applied_at: string
  status: CandidateStatus
  created_at?: string
}

// 6. PI Screenings
export interface PIScreening {
  id: string
  candidate_id: string
  scheduled_at: string | null
  completed_at: string | null
  resume_analysis: Record<string, any>
  transcript: any
  audio_url: string | null
  pi_score_overall: number | null
  dimension_scores: Record<string, any>
  pass_fail: boolean | null
  created_at?: string
}

// 7. Interview Sessions
export interface InterviewSession {
  id: string
  candidate_id: string | null
  job_id: string | null
  session_type: 'live'
  meeting_link: string | null
  scheduled_at: string | null
  interviewer_user_id: string | null
  status: SessionStatus
  created_at?: string
}

// Alias for backward compatibility
export type Session = InterviewSession

// 8. Interview Scope Packages
export interface InterviewScopePackage {
  id: string
  session_id: string
  generated_at: string
  track: Track
  round_plan: Round[]
  question_set: Record<string, any>
  simulation_payloads: Record<string, any>
  rubric_version: string
  models_used: string[]
  approved_by: string | null
  created_at?: string
}

export interface Round {
  id: string
  round_number: number
  round_type: RoundType
  title: string
  prompt: string
  duration_minutes: number
  status?: RoundStatus
  started_at?: string | null
  completed_at?: string | null
  config: Record<string, any>
}

// 9. Live Events
export interface LiveEvent {
  id: string
  session_id: string
  event_type: string
  payload: Record<string, any>
  created_at: string
}

// Alias for backward compatibility
export type Event = LiveEvent

// 10. Scores
export interface Score {
  id: string
  session_id: string
  round: number
  overall_score: number
  dimension_scores: Record<string, number>
  red_flags: Record<string, any>
  confidence: number
  evidence_quotes: Array<{ dimension: string; quote: string; line?: number }>
  recommendation: 'proceed' | 'caution' | 'stop'
  created_at?: string
}

// 11. Artifacts
export interface Artifact {
  id: string
  session_id: string
  artifact_type: string
  url: string
  metadata: Record<string, any>
  created_at?: string
}

// 12. Rippling Writebacks
export interface RipplingWriteback {
  id: string
  candidate_id: string
  action: 'note' | 'tag' | 'stage_move'
  payload: Record<string, any>
  status: 'queued' | 'sent' | 'failed'
  error: string | null
  created_at?: string
}

// Helper types for MVP (temporary)
export interface SessionWithDetails extends InterviewSession {
  candidate?: Candidate
  job?: JobProfile
  currentRound?: number // Computed from scope package
}
