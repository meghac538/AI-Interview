export const MODEL_STAGES = [
  {
    value: "candidate_sidekick",
    label: "Candidate Sidekick",
    description: "AI assistant for candidates during interviews",
  },
  {
    value: "scoring",
    label: "Scoring Engine",
    description: "Evaluates responses and generates scores",
  },
  {
    value: "prospect",
    label: "AI Prospect",
    description: "Simulated buyer persona for role-play rounds",
  },
] as const;

export type ModelStageValue = (typeof MODEL_STAGES)[number]["value"];

export function getStageLabelByValue(value: string): string {
  const stage = MODEL_STAGES.find((s) => s.value === value);
  return stage?.label ?? value;
}
