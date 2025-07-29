import { supabase } from '@/lib/supabaseClient';

type RawRow = {
  name: string;
  category: string | null;
  rest_seconds_default: number | null;
  set_duration_seconds: number | null;
  is_main_lift: boolean | null;
};

const BAD_CATEGORIES = ['warmup', 'mobility', 'cooldown'];

export async function getAccessoryPool(exclude: string[] = []) {
  // Fetch the global list of main-lifts
  const { data: mainLiftRows = [], error: mainLiftErr } = await supabase
    .from('exercises')
    .select('name')
    .eq('is_main_lift', true);
  
  if (mainLiftErr) {
    console.error('main-lifts fetch error', mainLiftErr);
  }
  
  const mainLiftNames = (mainLiftRows || []).map(r => r.name.toLowerCase());

  const { data, error } = await supabase
    .from('exercises')
    .select('name, category, rest_seconds_default, set_duration_seconds, is_main_lift')
    .not('category', 'in', `(${BAD_CATEGORIES.map(c => `'${c}'`).join(',')})`);

  if (error || !data) {
    console.error('accessory fetch error', error);
    return [];
  }

  const excludeSet = new Set(exclude.map(n => n.toLowerCase()));
  
  return data
    .filter(row => {
      const nameLower = row.name.toLowerCase();
      return !excludeSet.has(nameLower) && !mainLiftNames.includes(nameLower);
    })
    .map(row => ({
      name:  row.name,
      rest:  row.rest_seconds_default ?? 60,
      setSec: row.set_duration_seconds ?? 30
    }));
} 