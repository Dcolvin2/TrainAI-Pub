import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

// TypeScript-safe workout completion handler
interface LogSet {
  exerciseName: string;
  setNumber: number;
  previousWeight: number;
  prescribedWeight: number;
  actualWeight: number | string;
  reps: number;
  restSeconds: number;
  rpe: number;
  done: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const { userId, logSets } = await req.json();

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
    for (const s of logSets) {
      await supabase.from('workout_sets').upsert({
        session_id: session.id,
        exercise_name: s.exerciseName,
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

    // Track personal bests
    const byExercise = logSets.reduce((acc: Record<string, LogSet[]>, s: LogSet) => {
      (acc[s.exerciseName] ||= []).push(s);
      return acc;
    }, {});

    for (const [exerciseName, setsArr] of Object.entries(byExercise)) {
      const newMax = Math.max(...(setsArr as LogSet[]).map((s: LogSet) => Number(s.actualWeight) || 0));
      
      if (newMax > 0) {
        // fetch existing max
        const { data: existing } = await supabase
          .from('user_maxes')
          .select('max_weight')
          .eq('user_id', userId)
          .eq('exercise_name', exerciseName)
          .single();

        if (!existing || newMax > existing.max_weight) {
          // upsert the new PR
          await supabase.from('user_maxes').upsert([{
            user_id: userId,
            exercise_name: exerciseName,
            max_weight: newMax,
            updated_at: new Date().toISOString()
          }]);
        }
      }
    }

    return NextResponse.json({ sessionId: session.id, total_volume: totalVolume });
  } catch (error) {
    console.error('Complete workout error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to complete workout' 
    }, { status: 500 });
  }
} 