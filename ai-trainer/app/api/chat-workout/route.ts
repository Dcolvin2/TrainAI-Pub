import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { claude } from '@/lib/claudeClient';

export async function POST(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { message, context } = await request.json();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user data
    const [profileResult, equipmentResult] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', user.id).single(),
      supabase.from('user_equipment')
        .select('equipment:equipment_id(name)')
        .eq('user_id', user.id)
        .eq('is_available', true)
    ]);

    const profile = profileResult.data;
    const equipment = equipmentResult.data?.map((eq: any) => eq.equipment.name) || [];

    // Check if asking for Nike workouts
    if (message.toLowerCase().includes('nike workout')) {
      const nextNum = ((profile?.last_nike_workout || 0) % 24) + 1;
      
      const { data: workouts } = await supabase
        .from('nike_workouts')
        .select('workout, workout_type')
        .gte('workout', nextNum)
        .lte('workout', nextNum + 4)
        .order('workout');

      const uniqueWorkouts = Array.from(
        new Map(workouts?.map((w: any) => [w.workout, w])).values()
      );

      return NextResponse.json({
        type: 'nike_list',
        message: 'Here are your upcoming Nike workouts:',
        workouts: uniqueWorkouts.map((w: any) => ({
          number: w.workout,
          name: w.workout_type,
          isCurrent: w.workout === nextNum
        }))
      });
    }

    // Generate custom workout based on chat
    const prompt = `You are an expert fitness coach creating a personalized workout based on the user's request.

User Profile:
- Current: ${profile.current_weight} lbs → Goal: ${profile.goal_weight} lbs
- Fitness Level: ${profile.fitness_level || 'intermediate'}
- Equipment: ${equipment.join(', ')}

User Request: "${message}"
${context ? `\nContext: ${JSON.stringify(context)}` : ''}

Create a workout that:
1. Directly addresses their request
2. Uses ONLY their available equipment
3. Aligns with weight loss while maintaining muscle
4. Considers any limitations mentioned

Return this EXACT JSON structure:
{
  "introduction": "2-3 sentence acknowledgment of their request",
  "workoutName": "Descriptive workout name",
  "duration": 45,
  "focus": ["primary muscles", "secondary muscles"],
  "phases": {
    "warmup": {
      "duration": "5-10 minutes",
      "exercises": [
        {
          "name": "Exercise Name",
          "sets": "2",
          "reps": "10",
          "instruction": "Brief form cue"
        }
      ]
    },
    "main": {
      "duration": "25-35 minutes",
      "instructions": "Complete X rounds with Y rest",
      "exercises": [
        {
          "name": "Exercise Name",
          "sets": "3",
          "reps": "12-15",
          "weight": "moderate",
          "rest": 60,
          "instruction": "Key form point"
        }
      ]
    },
    "cooldown": {
      "duration": "5 minutes",
      "exercises": [
        {
          "name": "Stretch Name",
          "duration": "30-60 seconds",
          "instruction": "Breathing cue"
        }
      ]
    }
  }
}`;

    const response = await claude.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 2000,
      temperature: 0.7,
      messages: [{ role: "user", content: prompt }]
    });

    const content = response.content[0];
    const workout = JSON.parse(content.type === 'text' ? content.text : '{}');

    // Save workout session
    const { data: session } = await supabase
      .from('workout_sessions')
      .insert({
        user_id: user.id,
        date: new Date().toISOString().split('T')[0],
        workout_source: 'chat',
        workout_name: workout.workoutName,
        planned_exercises: workout,
        chat_context: { message, context }
      })
      .select()
      .single();

    // Log chat
    await supabase
      .from('workout_chat_log')
      .insert({
        workout_session_id: session.id,
        user_message: message,
        ai_response: JSON.stringify(workout)
      });

    return NextResponse.json({
      type: 'custom_workout',
      sessionId: session.id,
      workout,
      formattedResponse: formatWorkoutResponse(workout)
    });

  } catch (error) {
    console.error('Chat workout error:', error);
    return NextResponse.json(
      { error: 'Failed to generate workout' },
      { status: 500 }
    );
  }
}

function formatWorkoutResponse(workout: any) {
  return `${workout.introduction}

💪 **${workout.workoutName}** (${workout.duration} min)
**Focus:** ${workout.focus.join(', ')}

🔹 **Warm-Up** (${workout.phases.warmup.duration})
${workout.phases.warmup.exercises.map((ex: any, i: number) => 
  `${i + 1}. ${ex.name} - ${ex.sets} x ${ex.reps}\n   ${ex.instruction}`
).join('\n')}

🔹 **Main Workout** (${workout.phases.main.duration})
${workout.phases.main.instructions}
${workout.phases.main.exercises.map((ex: any, i: number) => 
  `${i + 1}. ${ex.name} - ${ex.sets} x ${ex.reps}${ex.weight ? ` @ ${ex.weight}` : ''}\n   ${ex.instruction}\n   Rest: ${ex.rest}s`
).join('\n\n')}

🔹 **Cool-Down** (${workout.phases.cooldown.duration})
${workout.phases.cooldown.exercises.map((ex: any, i: number) => 
  `${i + 1}. ${ex.name} - ${ex.duration}\n   ${ex.instruction}`
).join('\n')}`;
} 