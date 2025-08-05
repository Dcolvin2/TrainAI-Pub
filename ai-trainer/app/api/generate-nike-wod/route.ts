import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { claude } from '@/lib/claudeClient';
import { buildNikeWODPrompt } from '@/lib/buildNikeWODPrompt';

export async function POST(request: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { workoutNumber } = await request.json();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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

  // Get Nike workout
  const { data: nikeExercises } = await supabase
    .from('nike_workouts')
    .select('*')
    .eq('workout', workoutNumber)
    .order('exercise_phase');

  if (!nikeExercises?.length) {
    return NextResponse.json({ error: 'Workout not found' }, { status: 404 });
  }

  // Group by phase
  const phases = {
    warmup: nikeExercises.filter(e => e.exercise_phase === 'warmup'),
    main: nikeExercises.filter(e => e.exercise_phase === 'main'),
    accessory: nikeExercises.filter(e => e.exercise_phase === 'accessory'),
    cooldown: nikeExercises.filter(e => e.exercise_phase === 'cooldown')
  };

  // Build prompt for Claude to adapt the workout
  const prompt = buildNikeWODPrompt(
    workoutNumber,
    nikeExercises[0].workout_type,
    phases,
    equipment,
    profile
  );

  const response = await claude.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }]
  });

  const content = response.content[0];
  const adaptedWorkout = JSON.parse(content.type === 'text' ? content.text : '{}');

  // Create workout session
  const { data: session } = await supabase
    .from('workout_sessions')
    .insert({
      user_id: user.id,
      workout_source: 'nike',
      nike_workout_number: workoutNumber,
      workout_name: adaptedWorkout.workoutName,
      planned_exercises: adaptedWorkout
    })
    .select()
    .single();

  // Update last Nike workout
  await supabase
    .from('profiles')
    .update({ last_nike_workout: workoutNumber })
    .eq('user_id', user.id);

  return NextResponse.json({
    sessionId: session.id,
    ...adaptedWorkout
  });
} 