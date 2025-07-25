import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId') || ''
    const minutes = Number(searchParams.get('minutes')) || 30

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    console.log('=== WORKOUT GENERATION START ===')
    console.log('User ID:', userId)
    console.log('Time Available:', minutes, 'minutes')

    // 1) Fetch user profile, equipment, and goals
    console.log('Step 1: Fetching user data...')
    const [{ data: profile }, { data: equipment }, { data: goals }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('equipment').select('name').eq('user_id', userId),
      supabase.from('user_goals').select('description').eq('user_id', userId),
    ])

    console.log('Profile found:', !!profile)
    console.log('Equipment found:', equipment?.length || 0, 'items')
    console.log('Goals found:', goals?.length || 0, 'items')

    // 2) Build the prompt
    const equipmentList = equipment?.map(e => e.name).join(', ') || 'none'
    const goalsList = goals?.map(g => g.description).join(', ') || 'none'
    const systemPrompt = `
You are TrainAI, an expert fitness coach.
User goals: ${goalsList}.
Available equipment: ${equipmentList}.
User has ${minutes} minutes today.
Generate a workout with a 5–10min warm-up, main session, and 5min cool-down, fitting in ${minutes} minutes.
Return JSON: { warmup: string[], workout: string[], cooldown: string[] }.
`.trim()

    console.log('Step 2: Built system prompt:', systemPrompt)

    // 3) Call OpenAI with function schema
    console.log('Step 3: Calling OpenAI API...')
    const resp = await openai.chat.completions.create({
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
    const plan = JSON.parse(resp.choices[0].message.function_call!.arguments!)
    console.log('Step 5: Parsed workout plan')
    console.log('=== WORKOUT GENERATION SUCCESS ===')

    return NextResponse.json({
      ...plan,
      prompt: systemPrompt
    })
  } catch (error: any) {
    console.error('=== WORKOUT GENERATION ERROR ===')
    console.error('Error type:', typeof error)
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
    
    return NextResponse.json({ 
      error: 'Failed to generate workout',
      details: error.message 
    }, { status: 500 })
  }
} 