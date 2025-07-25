import { NextApiHandler } from 'next'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

// Verify environment variables are loaded (remove this after testing)
console.log('OpenAI API Key loaded:', process.env.OPENAI_API_KEY ? 'Yes' : 'No')
console.log('Supabase URL loaded:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Yes' : 'No')
console.log('Supabase Service Key loaded:', process.env.SUPABASE_SERVICE_KEY ? 'Yes' : 'No')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

const handler: NextApiHandler = async (req, res) => {
  const { userId, minutes } = req.query
  const timeAvailable = Number(minutes) || 30

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'User ID is required' })
  }

  // Check if required environment variables are set
  if (!process.env.OPENAI_API_KEY) {
    console.error('OpenAI API key is missing')
    return res.status(500).json({ error: 'OpenAI API key not configured' })
  }

  if (!process.env.SUPABASE_SERVICE_KEY) {
    console.error('Supabase service key is missing')
    return res.status(500).json({ error: 'Supabase service key not configured' })
  }

  try {
    console.log('=== WORKOUT GENERATION START ===')
    console.log('User ID:', userId)
    console.log('Time Available:', timeAvailable, 'minutes')
    
    // 1) Fetch user context
    console.log('Step 1: Fetching user equipment and goals...')
    const [{ data: equip, error: equipError }, { data: goals, error: goalsError }] = await Promise.all([
      supabase.from('equipment').select('name').eq('user_id', userId),
      supabase.from('user_goals').select('description').eq('user_id', userId),
    ])
    
    console.log('Equipment query result:', { data: equip, error: equipError })
    console.log('Goals query result:', { data: goals, error: goalsError })
    console.log('Equipment found:', equip?.length || 0, 'items')
    console.log('Goals found:', goals?.length || 0, 'items')

    // 2) Build prompt with timeAvailable
    const systemPrompt = `
You are TrainAI, an expert fitness coach.
User goals: ${(goals||[]).map(g=>g.description).join(', ') || 'None'}.
Available equipment: ${(equip||[]).map(e=>e.name).join(', ') || 'Bodyweight only'}.
User has ${timeAvailable} minutes today.
Design a balanced workout (5–10min warm-up, main session, 5min cool-down) that fits in ${timeAvailable} minutes, adjusting sets, reps, and rest periods.
Return JSON with: { warmup: string[], workout: string[], cooldown: string[] }.
`.trim()

    console.log('Step 2: Built system prompt:', systemPrompt)

    console.log('Step 3: Calling OpenAI API...')
    // 3) Call OpenAI with function schema
    const chat = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Generate today\'s workout.' }
      ],
      functions: [{
        name: 'generate_workout',
        description: 'Return a workout plan',
        parameters: {
          type: 'object',
          properties: {
            warmup: { type: 'array', items: { type: 'string' } },
            workout: { type: 'array', items: { type: 'string' } },
            cooldown: { type: 'array', items: { type: 'string' } }
          },
          required: ['warmup','workout','cooldown']
        }
      }],
      function_call: { name: 'generate_workout' }
    })

    console.log('Step 4: OpenAI response received')
    console.log('Response structure:', {
      hasChoices: !!chat.choices,
      choicesLength: chat.choices?.length,
      hasMessage: !!chat.choices?.[0]?.message,
      hasFunctionCall: !!chat.choices?.[0]?.message?.function_call
    })

    const args = JSON.parse(chat.choices[0].message.function_call!.arguments!)
    console.log('Step 5: Parsed function arguments:', args)
    console.log('=== WORKOUT GENERATION SUCCESS ===')
    
    res.status(200).json({
      ...args,
      prompt: systemPrompt
    })
  } catch (error) {
    console.error('=== WORKOUT GENERATION ERROR ===')
    console.error('Error type:', typeof error)
    console.error('Error message:', error instanceof Error ? error.message : error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    
    // Check if it's an OpenAI API error
    if (error instanceof Error && error.message.includes('OpenAI')) {
      console.error('This appears to be an OpenAI API error')
    }
    
    res.status(500).json({ 
      error: 'Failed to generate workout',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
  }
}

export default handler 