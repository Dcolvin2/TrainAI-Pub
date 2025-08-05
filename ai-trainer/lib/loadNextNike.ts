import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function loadNextNike(userId: string) {
  const { data: prof } = await supabase
    .from('profiles')
    .select('last_nike_workout')
    .eq('user_id', userId)
    .single();

  // next workout #
  const next = (prof?.last_nike_workout ?? 0) + 1;

  // grab all rows that share that id
  const { data: rows } = await supabase
    .from('nike_workouts')
    .select('*')
    .eq('workout', next);

  // wrap-around when we run out
  if (!rows?.length) {
    await supabase.from('profiles')
      .update({ last_nike_workout: 0 })
      .eq('user_id', userId);
    return loadNextNike(userId);
  }

  // bump counter
  await supabase.from('profiles')
    .update({ last_nike_workout: next })
    .eq('user_id', userId);

  return {
    workoutNo: next,
    workoutType: rows[0].workout_type,            // "AMRAP", "Chipper", etc.
    minutes: rows.reduce((m, r) => m + (r.set_duration_seconds ?? 30) * Number(r.sets ?? 1) / 60, 0),
    mainSets: rows.map(r => ({
      exercise:  r.exercise,
      sets:      Number(r.sets),
      reps:      r.reps,
      notes:     r.instructions,
    })),
    warmup:   [],
    cooldown: [],
    accessories: [],
  };
} 