import { supabase } from '@/lib/supabaseClient';

export async function getExercisePool(exclude: string[] = []) {
  const { data, error } = await supabase
    .from('exercise_timings')  // ← the view you made
    .select('name, required_equipment, rest_seconds_default, set_duration_seconds');

  if (error || !data) {
    console.error('timing fetch error', error);
    return [];
  }
  return data.filter(row => !exclude.includes(row.name));
} 