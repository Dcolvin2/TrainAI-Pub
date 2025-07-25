import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { userId, exerciseName, sets } = await req.json();

    // 1) Create or reuse a session
    const { data: session, error: sessionError } = await supabase
      .from('workout_sessions')
      .insert([{ user_id: userId }])
      .select('id')
      .single();

    if (sessionError || !session) {
      throw new Error('Failed to create workout session');
    }

    // 2) Upsert each set
    for (const s of sets) {
      await supabase.from('workout_sets').upsert({
        session_id: session.id,
        exercise_name: exerciseName,
        set_number: s.setNumber,
        previous_weight: s.previousWeight,
        prescribed_weight: s.prescribedWeight,
        actual_weight: s.actualWeight,
        reps: s.reps,
        rest_seconds: s.restSeconds,
        rpe: s.rpe
      });
    }

    // 3) Compute total_volume and update session
    const { data: volumeAgg, error: volumeError } = await supabase
      .from('workout_sets')
      .select('actual_weight, reps')
      .eq('session_id', session.id);

    if (volumeError) {
      throw new Error('Failed to calculate volume');
    }

    const totalVolume = volumeAgg?.reduce((sum, set) => sum + ((set.actual_weight || 0) * (set.reps || 0)), 0) || 0;

    await supabase
      .from('workout_sessions')
      .update({ total_volume: totalVolume })
      .eq('id', session.id);

    return NextResponse.json({ sessionId: session.id, total_volume: totalVolume });
  } catch (error) {
    console.error('Complete workout error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to complete workout' 
    }, { status: 500 });
  }
} 