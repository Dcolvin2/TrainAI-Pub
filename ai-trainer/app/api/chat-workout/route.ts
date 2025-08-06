import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const { message, currentWorkout, sessionId } = await request.json();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const messageLC = message.toLowerCase().trim();

    // ONLY ADD THIS SECTION - Handle Nike workouts
    if (messageLC === 'nike' || messageLC.includes('nike workout')) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('last_nike_workout')
        .eq('user_id', user.id)
        .single();

      const nextWorkout = (profile?.last_nike_workout || 0) + 1;
      
      const { data: nikeWorkout } = await supabase
        .from('nike_workouts')
        .select('workout, workout_type')
        .eq('workout', nextWorkout)
        .limit(1)
        .single();

      if (nikeWorkout) {
        // Store pending workout in session for confirmation
        if (sessionId) {
          await supabase
            .from('chat_sessions')
            .update({ context: { pendingNikeWorkout: nextWorkout } })
            .eq('id', sessionId);
        }

        return NextResponse.json({
          success: true,
          message: `You previously completed workout ${profile?.last_nike_workout || 0}. Would you like to proceed with workout ${nextWorkout}: ${nikeWorkout.workout_type}?`,
          requiresConfirmation: true
        });
      }
    }

    // Handle "yes" confirmation for Nike workout
    if (messageLC === 'yes' && sessionId) {
      // Check if there's a pending Nike workout
      const { data: session } = await supabase
        .from('chat_sessions')
        .select('context')
        .eq('id', sessionId)
        .single();

      if (session?.context?.pendingNikeWorkout) {
        const workoutNum = session.context.pendingNikeWorkout;
        
        // Get exercises from nike_workouts
        const { data: exercises } = await supabase
          .from('nike_workouts')
          .select('*')
          .eq('workout', workoutNum);

        if (exercises && exercises.length > 0) {
          // Format exercises properly
          const warmup = exercises
            .filter(e => e.exercise_phase === 'warmup')
            .map(e => ({ name: e.exercise, sets: e.sets, reps: e.reps }));
          
          const main = exercises
            .filter(e => e.exercise_phase === 'main')
            .map(e => ({ name: e.exercise, sets: e.sets, reps: e.reps }));
          
          const accessories = exercises
            .filter(e => e.exercise_phase === 'accessory')
            .map(e => ({ name: e.exercise, sets: e.sets, reps: e.reps }));
          
          const cooldown = exercises
            .filter(e => e.exercise_phase === 'cooldown')
            .map(e => ({ name: e.exercise, duration: e.reps }));

          // Update user's progress
          await supabase
            .from('profiles')
            .update({ last_nike_workout: workoutNum })
            .eq('user_id', user.id);

          // Clear pending workout
          await supabase
            .from('chat_sessions')
            .update({ context: {} })
            .eq('id', sessionId);

          return NextResponse.json({
            success: true,
            workout: {
              name: exercises[0]?.workout_type || `Nike Workout ${workoutNum}`,
              warmup,
              main,
              accessories,
              cooldown
            },
            message: `Starting ${exercises[0]?.workout_type}! 💪`
          });
        }
      }
    }

    // CRITICAL: Get user's available equipment
    const { data: userEquipment } = await supabase
      .from('user_equipment')
      .select('equipment:equipment_id(name)')
      .eq('user_id', user.id)
      .eq('is_available', true);

    const availableEquipment = userEquipment?.map((eq: any) => eq.equipment.name) || [];

    // CRITICAL: Get exercises that match available equipment
    const { data: exercises } = await supabase
      .from('exercises')
      .select('*');

    // Filter exercises by available equipment
    const availableExercises = exercises?.filter((exercise: any) => {
      if (!exercise.equipment_required || exercise.equipment_required.length === 0) {
        return true; // Bodyweight exercises
      }
      return exercise.equipment_required.every((req: string) => 
        availableEquipment.includes(req)
      );
    }) || [];

    // Build prompt that MODIFIES the workout
    const prompt = `
You are a fitness coach. The user said: "${message}"

CURRENT WORKOUT:
${JSON.stringify(currentWorkout, null, 2)}

USER'S AVAILABLE EQUIPMENT:
${availableEquipment.join(', ')}

AVAILABLE EXERCISES (filtered by equipment):
${availableExercises.map((e: any) => `- ${e.name} (${e.category}, ${e.primary_muscle})`).join('\n')}

CRITICAL INSTRUCTIONS:
1. You MUST return a MODIFIED workout, not suggestions
2. Replace exercises the user can't do with ones from AVAILABLE EXERCISES list
3. ONLY use exercises from the AVAILABLE EXERCISES list
4. Return exercises as a clean array without workout instructions. Each exercise should be:
   {
     "name": "Exercise Name",  // Just the name, no numbers or instructions
     "sets": "3",
     "reps": "15"
   }
5. Do NOT include items like 'Perform 3 rounds of:' in the exercise list
6. Return the COMPLETE modified workout in this exact JSON format:

{
  "workout": {
    "warmup": [
      {"name": "Exercise Name", "sets": 1, "reps": "10", "duration": "30s"}
    ],
    "main": [
      {"name": "Exercise Name", "sets": 3, "reps": "8-10", "rest": "60s", "weight": "moderate"}
    ],
    "cooldown": [
      {"name": "Exercise Name", "duration": "30s"}
    ]
  },
  "changes": "Brief description of what was changed"
}

Return ONLY valid JSON, no other text.`;

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 2000,
      temperature: 0.7,
      messages: [{ role: "user", content: prompt }]
    });

    const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
    const modifiedWorkout = JSON.parse(responseText);

    // UPDATE the workout session in database
    if (sessionId) {
      await supabase
        .from('workout_sessions')
        .update({
          planned_exercises: modifiedWorkout.workout,
          modifications: { 
            timestamp: new Date().toISOString(),
            reason: message,
            changes: modifiedWorkout.changes
          }
        })
        .eq('id', sessionId);
    }

    return NextResponse.json({
      success: true,
      workout: modifiedWorkout.workout,
      message: modifiedWorkout.changes
    });

  } catch (error) {
    console.error('Chat workout error:', error);
    return NextResponse.json({ error: 'Failed to modify workout' }, { status: 500 });
  }
} 