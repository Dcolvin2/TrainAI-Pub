import { supabase } from '@/lib/supabaseClient';

export async function getExercisePool(exclude: string[] = []) {
  const { data, error } = await supabase
    .from('exercises')              // ← real table, not view
    .select('name, rest_seconds_default, set_duration_seconds');

  if (error || !data) {
    console.error('timing fetch error', error);
    return [];
  }
  return data
    .filter(row => !exclude.includes(row.name))
    .map(row => ({
      name:  row.name,
      rest:  row.rest_seconds_default ?? 60,
      setSec: row.set_duration_seconds ?? 30
    }));
} 