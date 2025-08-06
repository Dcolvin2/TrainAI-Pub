import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface NikeExercise {
  workout: number;
  workout_type: string;
  exercise: string;
  exercise_phase: string;
  sets: string;
  reps: string;
  instructions?: string;
}

export async function POST(request: Request) {
  const { message, sessionId } = await request.json();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('last_nike_workout')
    .eq('user_id', user.id)
    .single();

  const messageLC = message.toLowerCase().trim();

  // Handle Nike workout requests
  if (messageLC === 'nike' || messageLC.includes('nike workout')) {
    const nextWorkout = (profile?.last_nike_workout || 0) + 1;
    
    // Get the next workout details
    const { data: nikeWorkout } = await supabase
      .from('nike_workouts')
      .select('workout, workout_type')
      .eq('workout', nextWorkout)
      .limit(1)
      .single();

    if (nikeWorkout) {
      return NextResponse.json({
        type: 'nike_prompt',
        message: `You previously completed workout ${profile?.last_nike_workout || 0}. Would you like to proceed with workout ${nextWorkout}: ${nikeWorkout.workout_type}?`,
        workoutNumber: nextWorkout,
        workoutName: nikeWorkout.workout_type,
        requiresConfirmation: true
      });
    }
  }

  // Handle Nike with specific number
  const nikeMatch = messageLC.match(/nike\s*(\d+)/);
  if (nikeMatch) {
    const workoutNum = parseInt(nikeMatch[1]);
    
    const { data: nikeWorkout } = await supabase
      .from('nike_workouts')
      .select('workout, workout_type')
      .eq('workout', workoutNum)
      .limit(1)
      .single();

    if (nikeWorkout) {
      return NextResponse.json({
        type: 'nike_prompt',
        message: `Nike workout ${workoutNum} is ${nikeWorkout.workout_type}. Would you like to proceed?`,
        workoutNumber: workoutNum,
        workoutName: nikeWorkout.workout_type,
        requiresConfirmation: true
      });
    }
  }

  // Handle confirmation (yes/proceed)
  if ((messageLC === 'yes' || messageLC === 'proceed') && sessionId) {
    // Get the pending Nike workout from session
    const { data: session } = await supabase
      .from('chat_sessions')
      .select('context')
      .eq('id', sessionId)
      .single();

    if (session?.context?.pendingNikeWorkout) {
      const workoutNum = session.context.pendingNikeWorkout;
      
      // Get full workout from nike_workouts
      const { data: exercises } = await supabase
        .from('nike_workouts')
        .select('*')
        .eq('workout', workoutNum)
        .order('exercise_phase');

      // Group by phase
      const warmup = exercises?.filter((e: NikeExercise) => e.exercise_phase === 'warmup') || [];
      const main = exercises?.filter((e: NikeExercise) => e.exercise_phase === 'main') || [];
      const accessories = exercises?.filter((e: NikeExercise) => e.exercise_phase === 'accessory') || [];
      const cooldown = exercises?.filter((e: NikeExercise) => e.exercise_phase === 'cooldown') || [];

      // Update last_nike_workout
      await supabase
        .from('profiles')
        .update({ last_nike_workout: workoutNum })
        .eq('user_id', user.id);

      return NextResponse.json({
        type: 'workout',
        workout: {
          name: exercises?.[0]?.workout_type || `Nike Workout ${workoutNum}`,
          warmup: warmup.map((e: NikeExercise) => ({
            name: e.exercise,
            sets: e.sets,
            reps: e.reps,
            instructions: e.instructions
          })),
          main: main.map((e: NikeExercise) => ({
            name: e.exercise,
            sets: e.sets,
            reps: e.reps,
            instructions: e.instructions
          })),
          accessories: accessories.map((e: NikeExercise) => ({
            name: e.exercise,
            sets: e.sets,
            reps: e.reps,
            instructions: e.instructions
          })),
          cooldown: cooldown.map((e: NikeExercise) => ({
            name: e.exercise,
            duration: e.reps,
            instructions: e.instructions
          }))
        },
        message: `Starting ${exercises?.[0]?.workout_type}. Let's get to work! 💪`
      });
    }
  }

  // Handle other workout requests...
  return NextResponse.json({
    type: 'general',
    message: 'What type of workout would you like? You can say "Nike" for your next Nike workout, or describe what you want to train.'
  });
} 