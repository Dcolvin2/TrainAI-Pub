import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function POST(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { message, context, sessionId } = await request.json();
    
    console.log('📨 Chat request:', { message, sessionId });
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user data
    const [profileResult, equipmentResult, previousWorkoutsResult] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', user.id).single(),
      supabase.from('user_equipment')
        .select('equipment:equipment_id(name)')
        .eq('user_id', user.id)
        .eq('is_available', true),
      // Get previous workout data for weight tracking
      supabase.from('workout_sets')
        .select('exercise_name, actual_weight, reps')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100)
    ]);

    const profile = profileResult.data;
    const equipment = equipmentResult.data?.map((eq: any) => eq.equipment.name) || [];
    const previousLifts = previousWorkoutsResult.data || [];

    // Check for Nike workout request
    if (message.toLowerCase().includes('nike workout')) {
      return handleNikeWorkoutRequest(supabase, user, profile);
    }

    // Generate workout with Claude
    const prompt = buildWorkoutPrompt(message, profile, equipment, previousLifts);
    
    console.log('🤖 Calling Claude...');
    
    const response = await anthropic.messages.create({
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
    const responseText = content.type === 'text' ? content.text : '';

    console.log('✅ Claude response received');

    // Parse the workout from Claude's response
    let workout;
    try {
      // Extract JSON from response if Claude included it
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        workout = JSON.parse(jsonMatch[0]);
      } else {
        // If no JSON, create a basic structure
        workout = {
          type: 'text_response',
          message: responseText
        };
      }
    } catch (e) {
      workout = {
        type: 'text_response',
        message: responseText
      };
    }

    // If it's a proper workout, save it
    if (workout.exercises) {
      const { data: session } = await supabase
        .from('workout_sessions')
        .insert({
          user_id: user.id,
          date: new Date().toISOString().split('T')[0],
          workout_source: 'chat',
          workout_name: workout.name || 'Custom Workout',
          workout_type: workout.type || 'custom',
          planned_exercises: workout
        })
        .select()
        .single();

      return NextResponse.json({
        type: 'workout',
        sessionId: session.id,
        workout: workout,
        message: 'Here\'s your workout! Tap on each exercise to log your sets.'
      });
    }

    // Return text response
    return NextResponse.json({
      type: 'assistant',
      message: responseText
    });

  } catch (error) {
    console.error('❌ Chat error:', error);
    return NextResponse.json({
      type: 'error',
      message: 'Sorry, I had trouble generating that workout. Please try again.'
    });
  }
}

function buildWorkoutPrompt(
  message: string, 
  profile: any, 
  equipment: string[], 
  previousLifts: any[]
): string {
  // Get previous weights for reference
  const liftHistory: Record<string, number> = {};
  previousLifts.forEach((lift: any) => {
    if (!liftHistory[lift.exercise_name] || lift.actual_weight > liftHistory[lift.exercise_name]) {
      liftHistory[lift.exercise_name] = lift.actual_weight;
    }
  });

  return `
You are an expert fitness coach. The user said: "${message}"

User Profile:
- Current weight: ${profile?.current_weight || 185} lbs
- Goal weight: ${profile?.goal_weight || 170} lbs  
- Training goal: ${profile?.training_goal || 'weight_loss'}
- Available equipment: ${equipment.join(', ')}

Previous Lift History (for reference):
${Object.entries(liftHistory).slice(0, 10).map(([exercise, weight]) => 
  `- ${exercise}: ${weight} lbs`
).join('\n')}

Generate a workout that EXACTLY matches their request. 

CRITICAL: Return a JSON object with this EXACT structure:
{
  "name": "Workout Name",
  "type": "strength|hiit|endurance",
  "duration": 20,
  "exercises": [
    {
      "name": "Exercise Name",
      "phase": "warmup|main|accessory|cooldown",
      "sets": [
        {
          "setNumber": 1,
          "reps": 10,
          "weight": 135,
          "previousWeight": 125,
          "rest": 90,
          "notes": "Focus on form"
        },
        {
          "setNumber": 2,
          "reps": 10,
          "weight": 135,
          "previousWeight": 125,
          "rest": 90
        }
      ],
      "instructions": "Key form cues"
    }
  ],
  "notes": "Overall workout notes"
}

IMPORTANT:
- For kettlebell workouts, use appropriate KB exercises (swings, goblet squats, Turkish get-ups, etc.)
- Include specific weights based on their history or reasonable defaults
- Include warmup and cooldown
- Make the workout fit their exact time constraint
- Use ONLY their available equipment`;
}

async function handleNikeWorkoutRequest(supabase: any, user: any, profile: any) {
  const nextNum = ((profile?.last_nike_workout || 0) % 24) + 1;
  
  const { data: workouts } = await supabase
    .from('nike_workouts')
    .select('workout, workout_type')
    .gte('workout', nextNum)
    .lte('workout', Math.min(nextNum + 4, 24))
    .order('workout');

  const uniqueWorkouts = Array.from(
    new Map(workouts?.map((w: any) => [w.workout, w])).values()
  );

  return NextResponse.json({
    type: 'nike_list',
    message: `Your next Nike workout is #${nextNum}`,
    workouts: uniqueWorkouts.map((w: any) => ({
      number: w.workout,
      name: w.workout_type,
      isCurrent: w.workout === nextNum
    }))
  });
} 