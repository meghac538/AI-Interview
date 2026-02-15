/**
 * Script to create 5 ElevenLabs agents for different difficulty levels
 * Run with: npx tsx scripts/create-elevenlabs-agents.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'

// Load .env.local
config({ path: resolve(process.cwd(), '.env.local') })

const API_KEY = process.env.ELEVENLABS_API_KEY

if (!API_KEY) {
  console.error('❌ ELEVENLABS_API_KEY not found in environment')
  process.exit(1)
}

const difficulties = [
  {
    level: 1,
    name: 'Sales Prospect - Easy',
    prompt:
      "You are Alex Morgan, a sales prospect in a discovery call. You are friendly, open, and easy to convince. You have budget, authority, and clear needs. You raise minimal objections and are enthusiastic about solutions. Be receptive to suggestions.",
    firstMessage:
      "Hi! Thanks for reaching out. I'm really interested in learning more about what you offer."
  },
  {
    level: 2,
    name: 'Sales Prospect - Moderate',
    prompt:
      "You are Alex Morgan, a sales prospect in a discovery call. You're interested but have some concerns. You raise 1-2 mild objections about budget or timeline but are open to good answers.",
    firstMessage: "Hey there. I have about 20 minutes for this call. What's this about?"
  },
  {
    level: 3,
    name: 'Sales Prospect - Medium',
    prompt:
      "You are Alex Morgan, a sales prospect in a discovery call. You're moderately skeptical with competing priorities and need strong evidence of value. Raise 2-3 objections during the call and push for concrete examples.",
    firstMessage:
      "Hi. I'm pretty busy today, so let's make this quick. What did you want to discuss?"
  },
  {
    level: 4,
    name: 'Sales Prospect - Hard',
    prompt:
      "You are Alex Morgan, a sales prospect in a discovery call. You're highly skeptical and push back on most claims. You have significant budget concerns and timeline pressure. Raise 3-4 challenging objections and demand proof for every claim.",
    firstMessage:
      "Yeah, I got your email. I'm skeptical this is worth my time, but I'll give you 10 minutes. Go ahead."
  },
  {
    level: 5,
    name: 'Sales Prospect - Expert',
    prompt:
      "You are Alex Morgan, a sales prospect in a discovery call. You're adversarial and hostile. You question everything, compare aggressively to competitors, and make unreasonable demands. You're very hard to convince. Raise 4+ difficult objections and be dismissive of weak answers.",
    firstMessage:
      "Look, I've seen a dozen pitches like this already. You have 5 minutes to convince me why I shouldn't hang up. What do you got?"
  }
]

async function createAgent(difficulty: {
  level: number
  name: string
  prompt: string
  firstMessage: string
}) {
  try {
    console.log(`\n🔄 Creating agent: ${difficulty.name}...`)

    const response = await fetch('https://api.elevenlabs.io/v1/convai/agents/create', {
      method: 'POST',
      headers: {
        'xi-api-key': API_KEY!,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: difficulty.name,
        conversation_config: {
          agent: {
            prompt: {
              prompt: difficulty.prompt,
              llm: 'gpt-4o'
            },
            first_message: difficulty.firstMessage,
            language: 'en'
          }
        }
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`ElevenLabs API error: ${error}`)
    }

    const agent = await response.json()

    console.log(`✅ Created: ${difficulty.name}`)
    console.log(`   Agent ID: ${agent.agent_id}`)

    return {
      level: difficulty.level,
      agentId: agent.agent_id
    }
  } catch (error: any) {
    console.error(`❌ Failed to create ${difficulty.name}:`, error.message)
    return null
  }
}

async function main() {
  console.log('🚀 Creating ElevenLabs agents for all difficulty levels...\n')

  const results = []

  for (const difficulty of difficulties) {
    const result = await createAgent(difficulty)
    if (result) {
      results.push(result)
    }
    // Small delay between requests
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  console.log('\n\n✅ Agent creation complete!\n')
  console.log('📝 Add these to your .env.local:\n')
  console.log(`ELEVENLABS_API_KEY=${API_KEY}`)

  results.forEach((result) => {
    const envVar = `ELEVENLABS_AGENT_${['EASY', 'MODERATE', 'MEDIUM', 'HARD', 'EXPERT'][result.level - 1]}`
    console.log(`${envVar}=${result.agentId}`)
  })

  console.log('\n')
}

main()
