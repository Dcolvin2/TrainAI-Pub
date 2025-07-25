import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

export async function POST(req: Request) {
  try {
    const { userId, messages } = await req.json()

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // A) Fetch comprehensive user context
    const [
      { data: profile }, 
      { data: equipment }, 
      { data: goals }, 
      { data: logs },
      { data: weightLogs }
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('equipment').select('name').eq('user_id', userId),
      supabase.from('user_goals').select('description').eq('user_id', userId),
      supabase.from('workouts').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(5),
      supabase.from('weight_logs').select('weight').eq('user_id', userId).order('created_at', { ascending: false }).limit(1)
    ])

    // B) Build dynamic system message with real user context
    const currentWeight = weightLogs?.[0]?.weight || 'Not logged'
    const goalsList = goals?.map(g => g.description).join(', ') || 'No goals set'
    const equipmentList = equipment?.map(e => e.name).join(', ') || 'Bodyweight only'
    const recentWorkouts = logs?.map(w => `${new Date(w.created_at).toLocaleDateString()} - ${w.type}`).join('; ') || 'None'

    const systemMsg = {
      role: 'system' as const,
      content: `
You are TrainAI, an AI fitness coach. 

User name: ${profile?.first_name || 'Unknown'}.
Goals: ${goalsList}.
Current weight: ${currentWeight} lbs.
Equipment available: ${equipmentList}.
Recent workouts (dates & types): ${recentWorkouts}.

When you reply, first ask the user:
  1) "What day is today's workout and how many minutes do you have?"
After they answer, respond ONLY with a JSON object under a \`generate_workout\` function call, with schema:
{
  warmup: string[],
  workout: { exercise: string, sets: number, reps: number, weight: number, rest: number }[],
  cooldown: string[]
}
      `.trim()
    }

    // C) Build chat history with system message
    const chatMessages = [systemMsg, ...messages]

    // D) Call OpenAI with function schema
    const resp = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: chatMessages,
      functions: [{
        name: 'generate_workout',
        description: 'Produce a workout plan',
        parameters: {
          type: 'object',
          properties: {
            warmup: { type: 'array', items: { type: 'string' } },
            workout: { 
              type: 'array', 
              items: { 
                type: 'object',
                properties: {
                  exercise: { type: 'string' },
                  sets: { type: 'number' },
                  reps: { type: 'number' },
                  weight: { type: 'number' },
                  rest: { type: 'number' }
                },
                required: ['exercise', 'sets', 'reps', 'weight', 'rest']
              }
            },
            cooldown: { type: 'array', items: { type: 'string' } }
          },
          required: ['warmup','workout','cooldown']
        }
      }],
      function_call: { name: 'generate_workout' }
    })

    // E) Parse response and return both message and plan
    const message = resp.choices[0].message
    let plan = null
    let assistantMessage = message.content || ''

    if (message.function_call) {
      plan = JSON.parse(message.function_call.arguments || '{}')
      // If there's a function call, we might want to add a natural language response
      assistantMessage = "Here's your personalized workout plan based on your goals and equipment!"
    }

    return NextResponse.json({ 
      assistantMessage, 
      plan 
    })
  } catch (error) {
    console.error('Workout chat error:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to process chat' 
    }, { status: 500 })
  }
} 