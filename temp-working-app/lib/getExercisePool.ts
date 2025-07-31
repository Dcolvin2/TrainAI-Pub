import { supabase } from '@/lib/supabaseClient';

type RawRow = {
  name: string;
  category: string | null;
  rest_seconds_default: number | null;
  set_duration_seconds: number | null;
  exercise_phase: string;
};

const BAD_CATEGORIES = ['warmup', 'mobility', 'cooldown'];

export async function getAccessoryPool(exclude: string[] = []) {
  // Fetch the global list of core-lifts
  const { data: coreLiftRows = [], error: coreLiftErr } = await supabase
    .from('exercises_final')
    .select('name')
    .eq('exercise_phase', 'core_lift');
  
  if (coreLiftErr) {
    console.error('core-lifts fetch error', coreLiftErr);
  }
  
  const coreLiftNames = (coreLiftRows || []).map(r => r.name.toLowerCase());

  const { data, error } = await supabase
    .from('exercises_final')
    .select('name, category, rest_seconds_default, set_duration_seconds, exercise_phase')
    .not('category', 'in', `(${BAD_CATEGORIES.map(c => `'${c}'`).join(',')})`);

  if (error || !data) {
    console.error('accessory fetch error', error);
    return [];
  }

  const excludeSet = new Set(exclude.map(n => n.toLowerCase()));
  
  return data
    .filter(row => {
      const nameLower = row.name.toLowerCase();
      return !excludeSet.has(nameLower) && !coreLiftNames.includes(nameLower);
    })
    .map(row => ({
      name:  row.name,
      rest:  row.rest_seconds_default ?? 60,
      setSec: row.set_duration_seconds ?? 30
    }));
} 