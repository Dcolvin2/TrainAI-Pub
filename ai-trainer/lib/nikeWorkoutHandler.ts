import { NextResponse } from 'next/server';
import { supabase as supabaseClient } from '@/lib/supabaseClient';

export async function handleNikeWorkoutRequest(
  user: { id: string },
  profile: { last_nike_workout?: number | null }
) {
  const supabase = supabaseClient;

  const nextWorkout = (((profile?.last_nike_workout || 0) as number) % 24) + 1;

  const { data: nikeWorkout, error: nikeErr } = await supabase
    .from('nike_workouts')
    .select('*')
    .eq('workout', nextWorkout);

  if (nikeErr) {
    return NextResponse.json({ error: 'Failed to fetch Nike workout' }, { status: 500 });
  }

  if (!nikeWorkout || nikeWorkout.length === 0) {
    return NextResponse.json({ error: 'Nike workout not found' }, { status: 404 });
  }

  const { data: session, error: sessionErr } = await supabase
    .from('workout_sessions')
    .insert({
      user_id: user.id,
      workout_source: 'nike',
      nike_workout_number: nextWorkout,
      workout_name: nikeWorkout[0].workout_type,
      planned_exercises: nikeWorkout
    })
    .select()
    .single();

  if (sessionErr) {
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }

  await supabase
    .from('profiles')
    .update({ last_nike_workout: nextWorkout })
    .eq('user_id', user.id);

  return NextResponse.json({
    type: 'nike_workout',
    sessionId: session!.id,
    workoutNumber: nextWorkout,
    workoutName: nikeWorkout[0].workout_type,
    exercises: nikeWorkout
  });
}


