import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { chatWithFunctions } from '@/lib/chatService'
import { fetchNikeWorkout } from '@/lib/nikeWorkoutHelper'
import OpenAI from 'openai'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

// Nike Workout Shortcut Handler
async function handleNikeShortcut(rawInput: string, userId: string) {
  // 1️⃣ VERIFY WE'RE HITTING THE INTENDED PROJECT
  console.log('SUPA URL', process.env.NEXT_PUBLIC_SUPABASE_URL);
  
  // STEP 0: Match "Nike" or "Nike 2" (case-insensitive)
  const m = /^nike\s*(\d+)?/i.exec(rawInput.trim());
  if (!m) return false;

  // STEP 1: Determine which workout #
  const explicit = m[1] ? parseInt(m[1], 10) : null;

  // always fetch profile progress so we can increment if needed
  const { data: profile } = await supabase
    .from("profiles")
    .select("last_nike_workout")
    .eq("user_id", userId)
    .single();

  const last = profile?.last_nike_workout ?? 0;
  const workoutNo = explicit ?? last + 1;

  // STEP 2: 👇  THE ONLY QUERY – points at **public.nike_workouts**
  const { data: rows, error } = await fetchNikeWorkout(workoutNo);

  // 2️⃣ LOG EXACT QUERY RESULTS
  console.debug('NIKE rows', { workoutNo, rows: rows?.length, error });

  // 3️⃣ DUMP DISTINCT WORKOUT NUMBERS DIRECTLY THROUGH SUPABASE
  const { data: availableWorkouts } = await supabase
    .from('nike_workouts')
    .select('workout')
    .order('workout', { ascending: true })
    .limit(100);
  console.debug('Available Nike workouts', availableWorkouts?.map(r => r.workout));

  // 4️⃣ CHECK COLUMN NAME & TYPE ON THE FLY
  try {
    const { data: info } = await supabase.rpc('pg_catalog.get_columns', { table_name: 'nike_workouts' });
    console.debug('Table schema info', info);
  } catch (schemaError) {
    console.debug('Schema check failed:', schemaError);
  }

  if (error) {
    return {
      assistantMessage: `Supabase error: ${error.message}`,
      plan: null
    };
  }
  if (!rows || rows.length === 0) {
    return {
      assistantMessage: `I couldn't find Nike workout ${workoutNo}.`,
      plan: null
    };
  }

  // STEP 3: Group rows by phase and render
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const phases = { warmup: [], main: [], cooldown: [] } as Record<string, any[]>;
  rows.forEach(r => phases[r.exercise_phase || "main"].push(r));

  const nikeWorkout = {
    workoutType: "Nike",
    workoutNumber: workoutNo,
    warmup: phases.warmup.map(r => `${r.exercise}: ${r.sets}x${r.reps}`),
    workout: phases.main.map(r => `${r.exercise}: ${r.sets}x${r.reps}`),
    cooldown: phases.cooldown.map(r => `${r.exercise}: ${r.sets}x${r.reps}`)
  };

  // STEP 4: Return appropriate message based on whether it's the next workout
  const assistantMessage = workoutNo === last + 1
    ? `Loaded Nike Workout ${workoutNo}. Ready to begin?`
    : `Loaded Nike Workout ${workoutNo}.`;

  return {
    assistantMessage,
    plan: nikeWorkout
  };
}

export async function POST(req: NextRequest) {
  try {
    const { userId, messages }: WorkoutChatRequest = await req.json()

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Check for Nike shortcut in the latest message
    const latestMessage = messages[messages.length - 1];
    if (latestMessage && latestMessage.role === 'user') {
      const nikeResult = await handleNikeShortcut(latestMessage.content, userId);
      
      if (nikeResult) {
        return NextResponse.json(nikeResult);
      }

      // Check for debug command
      if (latestMessage.content.trim().toLowerCase() === "/debug") {
        const { choices } = await client.chat.completions.create({
          model: "gpt-4o-mini",               // same model you hard-coded
          temperature: 0.3,
          messages: [
            { role: "system", content: "Identify your model." },
            { role: "assistant", content: "Model: gpt-4o-mini" }
          ],
        });

        return NextResponse.json({
          assistantMessage: choices[0].message.content, // sends "Model: gpt-4o-mini"
          plan: null
        });
      }
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
    const chatMessages = [
      systemMsg,
      ...messages.map(msg => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mappedMsg: any = {
          role: msg.role,
          content: msg.content
        };
        if (msg.name) {
          mappedMsg.name = msg.name;
        }
        return mappedMsg;
      })
    ]

    // D) Call OpenAI with function schema
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resp = await chatWithFunctions(chatMessages as any)

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