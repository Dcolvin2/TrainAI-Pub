import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { chatWithFunctions } from '@/lib/chatService'

interface WorkoutChatRequest {
  userId: string;
  messages: Array<{
    role: string;
    content: string;
    name?: string;
  }>;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { userId, messages }: WorkoutChatRequest = await req.json()

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // A) Fetch comprehensive user context
    const [
      { data: equipment }, 
      { data: goals }, 
      { data: weightLogs },
      { data: maxes }
    ] = await Promise.all([
      supabase.from('user_equipment').select('equipment_id, custom_name').eq('user_id', userId),
      supabase.from('goals').select('goal_type').eq('user_id', userId),
      supabase.from('weight_logs').select('weight').eq('user_id', userId).order('created_at', { ascending: false }).limit(1),
      supabase.from('user_maxes').select('exercise_name, max_weight').eq('user_id', userId)
    ])

    // B) Build dynamic system message with real user context
    const currentWeight = weightLogs?.[0]?.weight || 'Not logged'
    const goalsList = goals?.map(g => g.goal_type).join(', ') || 'No goals set'
    const equipmentList = equipment?.map(e => e.custom_name || e.equipment_id).join(', ') || 'Bodyweight only'
    const maxesList = maxes?.map(m => `${m.exercise_name}: ${m.max_weight} lbs`).join('\n') || 'No personal bests recorded'

    const systemMsg = {
      role: 'system' as const,
      content: `
You are TrainAI, an expert fitness coach.

• Always answer as concisely as possible—one or two sentences unless more detail is explicitly requested.
• Recognize simple day-of-week cues (e.g. "It's Tuesday") and map them to my weekly split: Monday=legs, Tuesday=chest, Wed=cardio, Thu=HIIT, Fri=cardio, Sat=back, Sun=active recovery.
• When I say "It's <day>," immediately generate that day's workout plan (warm-up, main, cool-down) without any extra back-and-forth.
• Unless I ask otherwise, assume a default 45-minute window, but allow me to override with "I have X minutes."
• Always reference my profile's maxes and available equipment; adjust loads from last session.

You know:
· User goals: ${goalsList || 'None'}.
· Current weight: ${currentWeight ? `${currentWeight} lbs` : 'Not logged'}.
· Equipment: ${equipmentList || 'None'}.
· Personal bests: ${maxesList || 'None'}.

— Only invoke the function "generate_workout" when the user explicitly requests a workout plan, using phrases like "generate a workout", "plan my routine", "I need a workout routine", "nike workout", or day-of-week cues like "It's Tuesday".
— Otherwise, respond in plain language: give advice, ask follow-up questions, and never return the JSON plan.
— When generating workouts, always respect these personal bests and equipment constraints.

When you do call the function, you must return a JSON object matching its schema.
      `.trim()
    }

    // C) Build chat history with system message
    const chatMessages = [systemMsg, ...messages]

    // D) Call OpenAI with function schema
    const resp = await chatWithFunctions(chatMessages)

    // E) Parse response and return both message and plan
    const assistantMessage = resp || 'I understand your request. How can I help you with your workout?'
    const plan = null // For now, no function calls implemented

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