import { NextRequest, NextResponse } from 'next/server'
import { fetchNikeWorkout } from '@/lib/nikeWorkoutHelper'

interface WorkoutChatRequest {
  userId: string;
  messages: Array<{
    role: string;
    content: string;
    name?: string;
  }>;
}

export async function POST(req: NextRequest) {
  try {
    // Initialize Supabase inside the function using dynamic import
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase environment variables');
      return NextResponse.json({ error: 'Database configuration error' }, { status: 500 });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Initialize Anthropic inside the function
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      return NextResponse.json({ error: 'AI service not configured' }, { status: 500 });
    }

    const { userId, messages }: WorkoutChatRequest = await req.json();

    if (!userId || !messages || messages.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const lastMessage = messages[messages.length - 1];
    const userInput = lastMessage.content.toLowerCase().trim();

    // ── INSTRUCTION LOOKUP (EARLY RETURN) ──
    const maybe = await getInstruction(userInput);
    if (maybe) {
      console.log('[TRACE] instruction found, early return');
      const response = `**Exercise Instructions**\n\n${maybe}`;
      return NextResponse.json({
        assistantMessage: response,
        plan: null
      });
    }

    // ── NIKE SHORTCUT HANDLER ──
    const nikeResult = await handleNikeShortcut(userInput, userId);
    if (nikeResult) {
      return NextResponse.json(nikeResult);
    }

    // ── DAY-OF-WEEK WORKOUT GENERATION ──
    const dayMatch = userInput.match(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
    if (dayMatch) {
      const day = dayMatch[1];
      return NextResponse.json({
        assistantMessage: `I'll create a ${day} workout plan for you! Let me generate that now...`,
        plan: null
      });
    }

    // ── HYBRID CLAUDE ROUTER ──
    // Fetch user context from Supabase
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('name, goals, current_weight, equipment')
      .eq('user_id', userId)
      .single();

    const { data: recentWorkouts } = await supabase
      .from('workout_sessions')
      .select('created_at, workout_type')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    const { data: maxes } = await supabase
      .from('user_maxes')
      .select('exercise_name, max_weight')
      .eq('user_id', userId);

    // Build context for Claude
    const userContext = {
      name: userProfile?.name || 'User',
      goals: userProfile?.goals || [],
      currentWeight: userProfile?.current_weight || 'Unknown',
      equipment: userProfile?.equipment || [],
      recentWorkouts: recentWorkouts?.map(w => w.workout_type) || [],
      maxes: maxes?.map(m => `${m.exercise_name}: ${m.max_weight}lbs`) || []
    };

    // System prompt for Claude with function calling instructions
    const systemPrompt = `You are TrainAI, an expert fitness trainer and workout coach. You help users create personalized workout plans and provide fitness guidance.

User Context:
- Name: ${userContext.name}
- Goals: ${userContext.goals.join(', ')}
- Current Weight: ${userContext.currentWeight}
- Available Equipment: ${userContext.equipment.join(', ')}
- Recent Workouts: ${userContext.recentWorkouts.join(', ')}
- Personal Bests: ${userContext.maxes.join(', ')}

Guidelines:
1. Create personalized workout plans based on user goals and equipment
2. Provide clear, actionable fitness advice
3. Be encouraging and motivational
4. Ask clarifying questions when needed
5. Suggest progressive overload strategies
6. Consider user's fitness level and experience

IMPORTANT: When creating or modifying workouts, you MUST respond with a JSON object in this exact format:
{
  "function": "updateWorkout",
  "arguments": {
    "warmup": ["exercise1", "exercise2"],
    "core_lift": "main exercise",
    "accessories": ["exercise3", "exercise4"],
    "cooldown": ["exercise5", "exercise6"],
    "minutes": 45
  }
}

Respond in a helpful, encouraging tone.`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1000,
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages
          ]
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Claude API error:', response.status, errorData);
        throw new Error(`Claude API error: ${response.status}`);
      }

      const data = await response.json();
      const claudeResponse = data.content[0].text;

      // Try to parse function call from Claude's response
      try {
        const jsonMatch = claudeResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.function === 'updateWorkout' && parsed.arguments) {
            const workoutData = parsed.arguments;
            
            return NextResponse.json({
              assistantMessage: "✅ Workout updated! *(powered by Claude)*",
              plan: {
                planId: crypto.randomUUID(),
                workoutType: "Custom",
                warmup: workoutData.warmup || [],
                workout: workoutData.core_lift ? [workoutData.core_lift] : [],
                cooldown: workoutData.cooldown || [],
                accessories: workoutData.accessories || [],
                minutes: workoutData.minutes || 45
              }
            });
          }
        }
      } catch (parseError) {
        console.log('Could not parse function call from Claude response');
      }

      // Return regular Claude response
      return NextResponse.json({
        assistantMessage: claudeResponse + "\n\n*(powered by Claude)*",
        plan: null
      });

    } catch (claudeError) {
      console.error('Claude chat error:', claudeError);
      return NextResponse.json({
        assistantMessage: "I'll help you with your workout! *(powered by Claude)*",
        plan: null
      });
    }

  } catch (error) {
    console.error('Workout chat error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

/* helper */
async function getInstruction(name: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const { data } = await supabase
    .from("exercises_final")
    .select("instruction")
    .ilike("name", `%${name}%`)
    .maybeSingle();
  return data?.instruction ?? null;
}

// Nike Workout Shortcut Handler
async function handleNikeShortcut(rawInput: string, userId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    return false;
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, supabaseKey);

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
  const isNext = workoutNo === last + 1;
  const message = isNext 
    ? `Here's your next Nike workout (#${workoutNo}):`
    : `Here's Nike workout #${workoutNo}:`;

  return {
    assistantMessage: message,
    plan: nikeWorkout
  };
} 