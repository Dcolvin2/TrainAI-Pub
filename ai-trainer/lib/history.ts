// lib/history.ts
import { supabase } from '@/lib/supabaseClient';

export type SimpleSet = {
  date: string;
  exercise_name: string;
  actual_weight: number | null;
  reps: number | null;
  rpe: number | null;
};

export async function fetchRecentSetsForExercise(
  userId: string,
  exerciseName: string,
  count = 12
): Promise<SimpleSet[]> {
  if (!userId || !exerciseName) return [];
  const { data, error } = await supabase
    .from('workout_sets')
    .select(
      'exercise_name, actual_weight, reps, rpe, session:workout_sessions!inner(date, user_id)'
    )
    .eq('session.user_id', userId)
    .eq('exercise_name', exerciseName)
    .order('date', { foreignTable: 'workout_sessions', ascending: false })
    .limit(count);

  if (error) {
    console.error('fetchRecentSetsForExercise error', error);
    return [];
  }

  return (data || []).map((r: any) => ({
    date: r?.session?.date || '',
    exercise_name: r?.exercise_name || '',
    actual_weight: r?.actual_weight ?? null,
    reps: r?.reps ?? null,
    rpe: r?.rpe ?? null,
  }));
}

export function summarizeHistory(sets: SimpleSet[]) {
  const recent = sets[0];
  const last3 = sets.slice(0, 3).filter(s => s.actual_weight && s.reps);
  const top = last3[0];

  const e1rm =
    top && top.actual_weight && top.reps
      ? Math.round(top.actual_weight / (1 - (Number(top.reps) / 30)))
      : null;

  const trendUp =
    last3.length >= 2 &&
    !!top &&
    ((Number(top.actual_weight) > Number(last3[1].actual_weight)) ||
      (Number(top.reps) > Number(last3[1].reps)));

  return {
    recent,       // most recent set (date, weight, reps, rpe)
    e1rm,         // estimated 1RM from top recent set
    trendUp,      // simple up/down flag
  };
}
