export const PROVIDERS = [
  {
    value: "openai",
    label: "OpenAI",
    defaultEndpoint: "https://api.openai.com/v1",
    authStyle: "bearer" as const,
  },
  {
    value: "anthropic",
    label: "Anthropic",
    defaultEndpoint: "https://api.anthropic.com/v1",
    authStyle: "header" as const,
    authHeader: "x-api-key",
    extraHeaders: { "anthropic-version": "2023-06-01" },
  },
  {
    value: "google",
    label: "Google (Gemini)",
    defaultEndpoint: "https://generativelanguage.googleapis.com/v1beta",
    authStyle: "query" as const,
  },
  {
    value: "openrouter",
    label: "OpenRouter",
    defaultEndpoint: "https://openrouter.ai/api/v1",
    authStyle: "bearer" as const,
  },
] as const;

export type ProviderValue = (typeof PROVIDERS)[number]["value"];

export function getProviderByValue(value: string) {
  return PROVIDERS.find((p) => p.value === value) ?? null;
}
