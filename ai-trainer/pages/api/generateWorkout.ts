import { NextApiHandler } from 'next'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

const handler: NextApiHandler = async (req, res) => {
  const { userId, minutes } = req.query
  const timeAvailable = Number(minutes) || 30

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'User ID is required' })
  }

  // 1) Fetch user context
  const [{ data: prof }, { data: equip }, { data: goals }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('equipment').select('name').eq('user_id', userId),
    supabase.from('user_goals').select('description').eq('user_id', userId),
  ])

  // 2) Build prompt with timeAvailable
  const systemPrompt = `
You are TrainAI, an expert fitness coach.
User goals: ${(goals||[]).map(g=>g.description).join(', ') || 'None'}.
Available equipment: ${(equip||[]).map(e=>e.name).join(', ') || 'Bodyweight only'}.
User has ${timeAvailable} minutes today.
Design a balanced workout (5–10min warm-up, main session, 5min cool-down) that fits in ${timeAvailable} minutes, adjusting sets, reps, and rest periods.
Return JSON with: { warmup: string[], workout: string[], cooldown: string[] }.
`.trim()

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

  const args = JSON.parse(chat.choices[0].message.function_call!.arguments!)
  res.status(200).json(args)
}

export default handler 