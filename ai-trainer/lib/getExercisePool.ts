import { supabase } from '@/lib/supabaseClient';

type RawRow = {
  name: string;
  category: string | null;
  rest_seconds_default: number | null;
  set_duration_seconds: number | null;
};

const BAD_CATEGORIES = ['warmup', 'mobility', 'cooldown'];

export async function getAccessoryPool(exclude: string[] = []) {
  const { data, error } = await supabase
    .from('exercises')
    .select('name, category, rest_seconds_default, set_duration_seconds')
    .not('category', 'in', `(${BAD_CATEGORIES.map(c => `'${c}'`).join(',')})`);

  if (error || !data) {
    console.error('accessory fetch error', error);
    return [];
  }

  const excludeSet = new Set(exclude.map(n => n.toLowerCase()));
  return data
    .filter(row => !excludeSet.has(row.name.toLowerCase()))
    .map(row => ({
      name:  row.name,
      rest:  row.rest_seconds_default ?? 60,
      setSec: row.set_duration_seconds ?? 30
    }));
} 