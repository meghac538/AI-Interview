import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { difficulty, name, prompt } = await request.json()

    const apiKey = process.env.ELEVENLABS_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ELEVENLABS_API_KEY not configured' },
        { status: 500 }
      )
    }

    // Create agent via ElevenLabs API
    const response = await fetch('https://api.elevenlabs.io/v1/convai/agents/create', {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: name || `Sales Prospect - Difficulty ${difficulty}`,
        conversation_config: {
          agent: {
            prompt: {
              prompt:
                prompt ||
                generatePromptForDifficulty(difficulty),
              llm: 'gpt-4o'
            },
            first_message: getFirstMessageForDifficulty(difficulty)
          }
        }
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`ElevenLabs API error: ${error}`)
    }

    const agent = await response.json()

    return NextResponse.json({
      agent_id: agent.agent_id,
      name: agent.name,
      difficulty
    })
  } catch (error: any) {
    console.error('Agent creation error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

function generatePromptForDifficulty(difficulty: number): string {
  const baseName = 'Alex Morgan'
  const baseContext =
    'You are a sales prospect in a discovery call with a sales representative.'

  const prompts: Record<number, string> = {
    1: `${baseContext} You are ${baseName}, a friendly and open prospect. You have budget, authority, and clear needs. You're easy to convince and raise minimal objections. Be enthusiastic and receptive to suggestions.`,
    2: `${baseContext} You are ${baseName}, an interested but cautious prospect. You have some concerns about budget or timeline. Raise 1-2 mild objections but be open to good answers.`,
    3: `${baseContext} You are ${baseName}, a moderately skeptical prospect. You have competing priorities and need strong evidence of value. Raise 2-3 objections during the call and push for concrete examples.`,
    4: `${baseContext} You are ${baseName}, a highly skeptical prospect. You push back on most claims and have significant budget concerns and timeline pressure. Raise 3-4 challenging objections and demand proof for every claim.`,
    5: `${baseContext} You are ${baseName}, an adversarial and hostile prospect. You question everything, compare aggressively to competitors, and make unreasonable demands. You're very hard to convince. Raise 4+ difficult objections and be dismissive of weak answers.`
  }

  return prompts[difficulty] || prompts[3]
}

function getFirstMessageForDifficulty(difficulty: number): string {
  const messages: Record<number, string> = {
    1: "Hi! Thanks for reaching out. I'm really interested in learning more about what you offer.",
    2: "Hey there. I have about 20 minutes for this call. What's this about?",
    3: "Hi. I'm pretty busy today, so let's make this quick. What did you want to discuss?",
    4: "Yeah, I got your email. I'm skeptical this is worth my time, but I'll give you 10 minutes. Go ahead.",
    5: "Look, I've seen a dozen pitches like this already. You have 5 minutes to convince me why I shouldn't hang up. What do you got?"
  }

  return messages[difficulty] || messages[3]
}
