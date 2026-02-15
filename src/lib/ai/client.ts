import OpenAI from 'openai'

type AIProvider = 'openai' | 'gemini'

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/'

// Model mapping: OpenAI model → Gemini equivalent
const GEMINI_MODEL_MAP: Record<string, string> = {
  'gpt-4o': 'gemini-2.0-flash',
  'gpt-4o-mini': 'gemini-2.0-flash-lite',
  'gpt-4': 'gemini-1.5-pro',
  'gpt-4-turbo': 'gemini-1.5-pro',
  'gpt-3.5-turbo': 'gemini-2.0-flash-lite',
}

let cachedClient: OpenAI | null = null
let cachedProvider: AIProvider | null = null

function getProvider(): AIProvider {
  const provider = (process.env.AI_PROVIDER || 'openai').toLowerCase()
  if (provider === 'gemini') return 'gemini'
  return 'openai'
}

/**
 * Returns an OpenAI-compatible client configured for the active AI provider.
 * Gemini uses the OpenAI-compatible REST endpoint so the same SDK works for both.
 */
export function getAIClient(): OpenAI {
  const provider = getProvider()

  if (cachedClient && cachedProvider === provider) return cachedClient

  if (provider === 'gemini') {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured')
    cachedClient = new OpenAI({ apiKey, baseURL: GEMINI_BASE_URL })
  } else {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('OPENAI_API_KEY is not configured')
    cachedClient = new OpenAI({ apiKey })
  }

  cachedProvider = provider
  return cachedClient
}

/**
 * Maps an OpenAI model name to the equivalent model for the active provider.
 * Pass-through when using OpenAI. Maps to Gemini equivalents when using Gemini.
 */
export function mapModel(openaiModel: string): string {
  if (getProvider() === 'openai') return openaiModel
  return GEMINI_MODEL_MAP[openaiModel] || 'gemini-2.0-flash'
}

/**
 * Returns the current provider name (for logging / error messages).
 */
export function getProviderName(): string {
  return getProvider() === 'gemini' ? 'Google Gemini' : 'OpenAI'
}
