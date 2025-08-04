import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface CoreLift {
  name: string;
  equipment_required: string[];
}

const FOCUS_MAP: Record<string, string[]> = {
  push:     ['chest', 'shoulders', 'triceps'],
  pull:     ['back', 'biceps'],
  legs:     ['quadriceps', 'hamstrings', 'glutes'],
  chest:    ['chest'],
  shoulders:['shoulders'],
  back:     ['back'],
};

export async function buildCoreLiftPool(
  focus: string,
  userEquip: string[],
): Promise<CoreLift[]> {
  try {
    console.log(`[buildCoreLiftPool] Building pool for focus: ${focus}, user equipment:`, userEquip);

    const muscles = FOCUS_MAP[focus] ?? [focus];
    console.log(`[buildCoreLiftPool] Target muscles:`, muscles);

    const { data, error } = await supabase
      .from('exercises')
      .select('name, equipment_required')
      .eq('exercise_phase', 'core_lift')
      .in('primary_muscle', muscles)   // uses ANY(match[])
      .filter('equipment_required', 'cs', `{${userEquip.join(',')}}`); // array contains

    if (error) {
      console.error('[buildCoreLiftPool] Query error:', error);
      throw error;
    }

    console.log(`[buildCoreLiftPool] Found ${data?.length || 0} exercises`);

    // Guarantee at least one result
    return data?.length ? data : [{ name: 'Push-up', equipment_required: ['bodyweight'] }];

  } catch (error) {
    console.error('[buildCoreLiftPool] Error:', error);
    return [{ name: 'Push-up', equipment_required: ['bodyweight'] }];
  }
} 