import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { chatWithFunctions } from '@/lib/chatService';
import { fetchNikeWorkout } from '@/lib/nikeWorkoutHelper'

interface WorkoutChatRequest {
  userId: string;
  messages: Array<{
    role: string;
    content: string;
    name?: string;
  }>;
}

/* helper */
async function getInstruction(name: string) {
  const { data } = await supabase
    .from("exercises_final")
    .select("instruction")
    .ilike("name", `%${name}%`)
    .maybeSingle();
  return data?.instruction ?? null;
}

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
    if (messages[messages.length - 1] && messages[messages.length - 1].role === 'user') {
      const nikeResult = await handleNikeShortcut(messages[messages.length - 1].content, userId);
      
      if (nikeResult) {
        return NextResponse.json(nikeResult);
      }
    }

    // Check for instruction look-up in the latest message
    if (messages[messages.length - 1] && messages[messages.length - 1].role === 'user') {
      const userInput = messages[messages.length - 1].content;
      const tipsMatch = userInput.match(
        /(how (?:do|to) (?:i|you) (?:do )?|tips? (?:for )?)(.+?)\??$/i
      );

      if (tipsMatch) {
        const exerciseName = tipsMatch[2].trim();
        const text = await getInstruction(exerciseName);

        return NextResponse.json({
          assistantMessage: text
            ? `**${exerciseName}**\n${text}`
            : `I couldn't find a cue for "${exerciseName}". Check the name or add it to the DB!`,
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
You are a workout-builder AI.

• ALWAYS call updateWorkout when generating or revising a plan.
• Warm-up & cooldown must target AT LEAST one of the core-lift muscles.
  If strict pool < needed exercises, fall back to full-body moves.
• Accessories:
    – 40–50 % quad/hamstring/glute on squat/deadlift days
    – 40–50 % chest/shoulder/triceps on bench/press days
    – No more than 2 posterior-chain hinges in same plan
    – Fit accessory count to "minutes" (≈5 min each).
• When the user asks "how do I do X" or "tips for X":
    – Look up \`instruction_text\` in the \`exercises\` table.
    – If found, reply with that text; else tell them no record.

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

ALWAYS call updateWorkout function with warmup, core_lift, accessories, cooldown arrays and total minutes.

Select 3–4 cooldown exercises (≈ 5–10 min) that match the core-lift muscles. Return them in the cooldown array of the updateWorkout function call.

— ALWAYS invoke the function "updateWorkout" for ANY workout request or modification
— For time changes, adjust the minutes parameter and scale exercises accordingly
— For exercise swaps, modify the appropriate array (warmup, core_lift, accessories, cooldown)
— When generating workouts, always respect these personal bests and equipment constraints

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

    // ─── /debug early-exit ─────────────────────────────────
    const userInput = messages[messages.length - 1]?.content;
    if (userInput?.trim?.().toLowerCase() === "/debug") {
      return NextResponse.json({
        assistantMessage: `Model: ${resp.modelUsed}`,   // ← dynamic model
        plan: null
      });
    }
    // ───────────────────────────────────────────────────────

    // Handle function call response
    if (resp.functionCall && resp.functionCall.name === 'updateWorkout') {
      const workoutData = resp.functionCall.arguments;
      
      // Add model tag for GPT-4o responses
      let assistantMessage = "✅ Workout updated!";
      if (resp.modelUsed === "gpt-4o") {
        assistantMessage += "\n\n*(powered by GPT-4o)*";
      }
      
      return NextResponse.json({
        assistantMessage,
        plan: {
          planId: crypto.randomUUID(),  // ← inject new planId to trigger React refresh
          workoutType: "Custom",
          warmup: workoutData.warmup || [],
          workout: workoutData.core_lift ? [workoutData.core_lift] : [],
          cooldown: workoutData.cooldown || [],
          accessories: workoutData.accessories || [],
          minutes: workoutData.minutes || 45
        }
      });
    }

    // ── ALWAYS EXPECT FUNCTION CALL ──
    // If we reach here, something went wrong with function calling
    console.error("Expected function call but got:", resp);
    
    // Add model tag for non-function responses
    let assistantMessage = "I'll update your workout plan.";
    if (resp.modelUsed === "gpt-4o") {
      assistantMessage += "\n\n*(powered by GPT-4o)*";
    }
    
    return NextResponse.json({ 
      assistantMessage, 
      plan: null 
    })
  } catch (error) {
    console.error('Workout chat error:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to process chat' 
    }, { status: 500 })
  }
} 