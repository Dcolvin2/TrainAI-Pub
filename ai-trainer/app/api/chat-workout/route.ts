import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { claude } from '@/lib/claudeClient';

export async function POST(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { message, context, sessionId } = await request.json();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get enhanced profile with new fields
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // Get user equipment
    const { data: userEquipment } = await supabase
      .from('user_equipment')
      .select('equipment:equipment_id(name)')
      .eq('user_id', user.id)
      .eq('is_available', true);

    const equipment = userEquipment?.map((eq: any) => eq.equipment.name) || [];

    // Check for Nike workout request
    if (message.toLowerCase().includes('nike workout')) {
      const nextNum = ((profile?.last_nike_workout || 0) % 24) + 1;
      
      const { data: workouts } = await supabase
        .from('nike_workouts')
        .select('id, workout, workout_type, exercise_phase')
        .gte('workout', nextNum)
        .lte('workout', nextNum + 4)
        .order('workout');

      const uniqueWorkouts = Array.from(
        new Map(workouts?.map((w: any) => [w.workout, w])).values()
      );

      // Store in chat_sessions
      await supabase
        .from('chat_sessions')
        .insert({
          user_id: user.id,
          context: { type: 'nike_list', message },
          is_active: true
        });

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

    // Generate custom workout using Claude
    const prompt = buildWorkoutPrompt(message, profile, equipment, context);
    
    const response = await claude.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 2000,
      temperature: 0.7,
      messages: [{ role: "user", content: prompt }]
    });

    const content = response.content[0];
    const workoutPlan = JSON.parse(content.type === 'text' ? content.text : '{}');

    // Create workout session with new schema
    const { data: session } = await supabase
      .from('workout_sessions')
      .insert({
        user_id: user.id,
        date: new Date().toISOString().split('T')[0],
        workout_source: 'chat',
        workout_name: workoutPlan.workoutName,
        workout_type: workoutPlan.focus?.[0],
        planned_exercises: workoutPlan,
        chat_context: { message, context }
      })
      .select()
      .single();

    // Log in workout_chat_log
    await supabase
      .from('workout_chat_log')
      .insert({
        workout_session_id: session.id,
        user_message: message,
        ai_response: JSON.stringify(workoutPlan)
      });

    // Store in chat_sessions
    await supabase
      .from('chat_sessions')
      .insert({
        user_id: user.id,
        context: { message, workout: workoutPlan },
        associated_workouts: [session.id],
        is_active: true
      });

    return NextResponse.json({
      type: 'custom_workout',
      sessionId: session.id,
      workout: workoutPlan,
      formattedResponse: formatWorkoutResponse(workoutPlan)
    });

  } catch (error) {
    console.error('Chat workout error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

function buildWorkoutPrompt(message: string, profile: any, equipment: string[], context: any) {
  return `
You are an expert fitness coach creating a personalized workout.

User Profile:
- Current weight: ${profile.current_weight} lbs
- Goal weight: ${profile.goal_weight} lbs
- Training goal: ${profile.training_goal || 'weight_loss'}
- Fitness level: ${profile.fitness_level || 'intermediate'}
- Injuries: ${profile.injuries || 'none'}
- Preferred rep range: ${profile.preferred_rep_range || 'hypertrophy_6-12'}
- Available equipment: ${equipment.join(', ')}

User's Request: "${message}"

Create a workout that addresses their specific request. If they mention pain/soreness, modify accordingly.

Return ONLY valid JSON in this format:
{
  "workoutName": "Descriptive name",
  "duration": 45,
  "focus": ["primary", "secondary"],
  "equipment": ["equipment used"],
  "phases": {
    "warmup": {
      "duration": "10 minutes",
      "exercises": [{"name": "Exercise", "sets": "2", "reps": "10", "notes": "Form cue"}]
    },
    "main": {
      "duration": "30 minutes",
      "exercises": [{"name": "Exercise", "sets": "3", "reps": "8-10", "weight": "heavy", "rest": "60s"}]
    },
    "cooldown": {
      "duration": "5 minutes",
      "exercises": [{"name": "Stretch", "duration": "30s", "notes": "Breathing"}]
    }
  }
}`;
}

function formatWorkoutResponse(workout: any) {
  return `${workout.workoutName} (${workout.duration} min)
  
Warmup:
${workout.phases?.warmup?.exercises?.map((e: any) => 
  `• ${e.name} - ${e.sets}x${e.reps}`
).join('\n')}

Main:
${workout.phases?.main?.exercises?.map((e: any) => 
  `• ${e.name} - ${e.sets}x${e.reps} ${e.weight || ''}`
).join('\n')}

Cooldown:
${workout.phases?.cooldown?.exercises?.map((e: any) => 
  `• ${e.name} - ${e.duration}`
).join('\n')}`;
} 