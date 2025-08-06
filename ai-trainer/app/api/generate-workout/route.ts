import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { workoutType, timeAvailable = 45 } = await request.json();
    
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's equipment
    const { data: userEquipment } = await supabase
      .from('user_equipment')
      .select(`
        equipment:equipment_id (
          name
        )
      `)
      .eq('user_id', user.id)
      .eq('is_available', true);

    const equipment = userEquipment?.map(eq => eq.equipment.name) || [];

    // Get exercises from database
    const { data: exercises } = await supabase
      .from('exercises')
      .select('*');

    // Filter exercises by equipment
    const availableExercises = exercises?.filter(ex => {
      if (!ex.equipment_required || ex.equipment_required.length === 0) return true;
      return ex.equipment_required.some(req => equipment.includes(req));
    }) || [];

    // Build workout based on type
    const workout = buildWorkout(workoutType, availableExercises, timeAvailable);

    // Create session
    const { data: session } = await supabase
      .from('workout_sessions')
      .insert({
        user_id: user.id,
        workout_source: 'ai_generated',
        workout_type: workoutType,
        planned_exercises: workout,
        date: new Date().toISOString()
      })
      .select()
      .single();

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      workout: workout
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate workout', details: error.message },
      { status: 500 }
    );
  }
}

function buildWorkout(type: string, exercises: any[], time: number) {
  const workoutType = type.toLowerCase();
  
  // Define muscle groups for each workout type
  const muscleGroups = {
    push: ['chest', 'shoulders', 'triceps'],
    pull: ['back', 'biceps', 'rear delts'],
    legs: ['quads', 'hamstrings', 'glutes', 'calves'],
    'upper body': ['chest', 'back', 'shoulders', 'arms'],
    'full body': ['full body', 'compound'],
    hiit: ['full body', 'cardio', 'explosive']
  };

  const targetMuscles = muscleGroups[workoutType] || muscleGroups['full body'];

  // Categorize exercises
  const warmupExercises = exercises.filter(e => 
    e.category === 'mobility' || e.exercise_phase === 'warmup'
  );
  
  const mainExercises = exercises.filter(e => 
    (e.category === 'strength' || e.is_compound) &&
    targetMuscles.some(muscle => e.primary_muscle?.toLowerCase().includes(muscle))
  );
  
  const accessoryExercises = exercises.filter(e => 
    e.category === 'hypertrophy' &&
    targetMuscles.some(muscle => e.primary_muscle?.toLowerCase().includes(muscle))
  );
  
  const cooldownExercises = exercises.filter(e => 
    e.category === 'mobility' && e.exercise_phase === 'cooldown'
  );

  // Build the workout
  return {
    warmup: selectRandomExercises(warmupExercises, 3),
    main: selectRandomExercises(mainExercises, 4),
    accessories: selectRandomExercises(accessoryExercises, 2),
    cooldown: selectRandomExercises(cooldownExercises, 3)
  };
}

function selectRandomExercises(pool: any[], count: number): string[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map(e => e.name);
} 