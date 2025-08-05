import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { claude } from '@/lib/claudeClient';

export async function POST(request: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { message, sessionId, context } = await request.json();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Get user profile and equipment
  const [profileResult, equipmentResult] = await Promise.all([
    supabase.from('profiles').select('*').eq('user_id', user.id).single(),
    supabase.from('user_equipment')
      .select('equipment:equipment_id(name)')
      .eq('user_id', user.id)
      .eq('is_available', true)
  ]);

  const profile = profileResult.data;
  const equipment = equipmentResult.data?.map((eq: any) => eq.equipment.name) || [];

  // Handle Nike workout requests
  if (message.toLowerCase().includes('nike workout')) {
    return handleNikeWorkouts(supabase, user, profile);
  }

  // Handle equipment updates
  if (message.toLowerCase().includes('available equipment') || 
      message.toLowerCase().includes('i have') || 
      message.toLowerCase().includes('using')) {
    return handleEquipmentUpdate(supabase, user, message, equipment);
  }

  // Generate custom workout
  const prompt = buildWorkoutPrompt(message, profile, equipment, context);
  
  try {
    const response = await claude.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 2000,
      temperature: 0.7,
      messages: [
        { 
          role: "user", 
          content: prompt 
        }
      ]
    });

    const content = response.content[0];
    const workoutPlan = JSON.parse(content.type === 'text' ? content.text : '{}');

    // Store in workout_sessions
    const { data: session } = await supabase
      .from('workout_sessions')
      .insert({
        user_id: user.id,
        date: new Date().toISOString().split('T')[0],
        workout_source: 'chat',
        workout_name: workoutPlan.workoutName,
        planned_exercises: workoutPlan,
        chat_context: { message, context }
      })
      .select()
      .single();

    // Log the chat
    await supabase
      .from('workout_chat_log')
      .insert({
        workout_session_id: session.id,
        user_message: message,
        ai_response: JSON.stringify(workoutPlan)
      });

    return NextResponse.json({
      type: 'custom_workout',
      sessionId: session.id,
      workout: workoutPlan,
      formattedResponse: formatWorkoutResponse(workoutPlan)
    });

  } catch (error) {
    console.error('Claude error:', error);
    return NextResponse.json({ error: 'Failed to generate workout' }, { status: 500 });
  }
}

async function handleNikeWorkouts(supabase: any, user: any, profile: any) {
  const nextNum = ((profile?.last_nike_workout || 0) % 24) + 1;
  
  // Get next 5 Nike workouts
  const { data: workouts } = await supabase
    .from('nike_workouts')
    .select('workout, workout_type')
    .gte('workout', nextNum)
    .order('workout')
    .limit(5);

  // Get unique workout types
  const uniqueWorkouts = workouts?.reduce((acc: any[], curr: any) => {
    if (!acc.find(w => w.workout === curr.workout)) {
      acc.push(curr);
    }
    return acc;
  }, []) || [];

  return NextResponse.json({
    type: 'nike_list',
    message: `Here are your upcoming Nike workouts:`,
    workouts: uniqueWorkouts.map((w: any) => ({
      number: w.workout,
      name: w.workout_type,
      isCurrent: w.workout === nextNum
    }))
  });
}

async function handleEquipmentUpdate(supabase: any, user: any, message: string, currentEquipment: string[]) {
  // Parse equipment from message
  const equipmentKeywords = [
    'dumbbells', 'barbell', 'kettlebells', 'pull up bar', 'bench', 
    'squat rack', 'cables', 'trx', 'medicine ball', 'resistance bands'
  ];
  
  const mentioned = equipmentKeywords.filter(eq => 
    message.toLowerCase().includes(eq)
  );

  if (mentioned.length > 0) {
    // Update equipment availability
    // This is simplified - you'd want more sophisticated parsing
    return NextResponse.json({
      type: 'equipment_update',
      message: `Updated your available equipment to include: ${mentioned.join(', ')}`,
      equipment: mentioned
    });
  }

  return NextResponse.json({
    type: 'equipment_current',
    message: `Your current equipment: ${currentEquipment.join(', ')}`,
    equipment: currentEquipment
  });
}

function buildWorkoutPrompt(message: string, profile: any, equipment: string[], context: any) {
  return `You are an expert fitness coach creating a personalized workout.

User Profile:
- Current weight: ${profile.current_weight} lbs
- Goal weight: ${profile.goal_weight} lbs
- Goal: Weight loss while maintaining strength and muscle
- Available equipment: ${equipment.join(', ')}
${profile.injuries ? `- Injuries/Limitations: ${profile.injuries}` : ''}

User's Request: "${message}"

${context ? `Previous Context: ${JSON.stringify(context)}` : ''}

IMPORTANT: Address their specific request directly. If they mention:
- Pain/soreness: Modify exercises to avoid that area
- Time constraints: Adjust workout length
- Specific muscles: Focus on those areas
- Fatigue: Reduce intensity

Create a workout following this EXACT JSON structure:
{
  "introduction": "Brief acknowledgment of their request (2-3 sentences)",
  "workoutName": "Descriptive workout name",
  "duration": 45,
  "focus": ["primary", "secondary"],
  "equipment": ["actual equipment used"],
  "phases": {
    "warmup": {
      "duration": "X minutes",
      "exercises": [
        {
          "name": "Exercise Name",
          "sets": "2",
          "reps": "10",
          "notes": "Form cue"
        }
      ]
    },
    "main": {
      "duration": "X minutes", 
      "instructions": "Complete X rounds with Y rest",
      "exercises": [
        {
          "name": "Exercise Name",
          "sets": "3",
          "reps": "8-10",
          "weight": "32 lb KB" (if applicable),
          "tempo": "2 sec lowering" (if applicable),
          "notes": "Key form point"
        }
      ]
    },
    "cooldown": {
      "duration": "X minutes",
      "exercises": [
        {
          "name": "Stretch Name",
          "duration": "30-60 seconds",
          "notes": "Breathing cue"
        }
      ]
    }
  }
}

ONLY return valid JSON. No markdown, no code blocks, just the JSON object.`;
}

function formatWorkoutResponse(workout: any) {
  // Format the workout into a readable response
  return `${workout.introduction}

💪 **${workout.workoutName} (${workout.duration} Minutes)**

**Focus**: ${workout.focus.join(', ')}
**Equipment**: ${workout.equipment.join(', ')}

🔹 **Warm-Up (${workout.phases.warmup.duration})**
${workout.phases.warmup.exercises.map((ex: any, i: number) => 
  `${i + 1}. **${ex.name}** – ${ex.sets} x ${ex.reps}${ex.notes ? '\n   ' + ex.notes : ''}`
).join('\n')}

🔹 **Main Workout (${workout.phases.main.duration})**
${workout.phases.main.instructions}
${workout.phases.main.exercises.map((ex: any, i: number) => 
  `${i + 1}. **${ex.name}**
   • ${ex.sets} x ${ex.reps}${ex.weight ? ' with ' + ex.weight : ''}${ex.tempo ? '\n   • ' + ex.tempo : ''}${ex.notes ? '\n   • ' + ex.notes : ''}`
).join('\n')}

🔹 **Cool-Down (${workout.phases.cooldown.duration})**
${workout.phases.cooldown.exercises.map((ex: any, i: number) => 
  `${i + 1}. **${ex.name}** – ${ex.duration}${ex.notes ? '\n   ' + ex.notes : ''}`
).join('\n')}`;
} 