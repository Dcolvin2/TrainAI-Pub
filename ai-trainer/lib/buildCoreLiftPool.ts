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

export function getCoreLiftForWorkoutType(workoutType: string, equipment: string[]) {
  // Define proper core lifts for each workout type
  const coreLiftMap: Record<string, (string | null)[]> = {
    push: [
      equipment.includes('Barbell') ? 'Barbell Bench Press' : null,
      equipment.includes('Dumbbells') ? 'Dumbbell Bench Press' : null,
      equipment.includes('Cables') ? 'Cable Chest Press' : null,
      'Push-Up' // Last resort only
    ],
    
    pull: [
      equipment.includes('Pull Up Bar') ? 'Pull-Up' : null,
      equipment.includes('Barbell') ? 'Barbell Bent-Over Row' : null,
      equipment.includes('Dumbbells') ? 'Dumbbell Row' : null,
      equipment.includes('Cables') ? 'Cable Row' : null,
    ],
    
    legs: [
      equipment.includes('Barbell') && equipment.includes('Squat Rack') ? 'Barbell Back Squat' : null,
      equipment.includes('Barbell') ? 'Barbell Deadlift' : null,
      equipment.includes('Dumbbells') ? 'Dumbbell Goblet Squat' : null,
      equipment.includes('Kettlebells') ? 'Kettlebell Goblet Squat' : null,
      'Bodyweight Squat' // Last resort
    ],
    
    upper: [
      equipment.includes('Barbell') ? 'Barbell Overhead Press' : null,
      equipment.includes('Dumbbells') ? 'Dumbbell Shoulder Press' : null,
      equipment.includes('Barbell') ? 'Barbell Bench Press' : null,
      equipment.includes('Pull Up Bar') ? 'Pull-Up' : null,
    ],
    
    full: [
      equipment.includes('Barbell') ? 'Barbell Deadlift' : null,
      equipment.includes('Barbell') ? 'Barbell Clean and Press' : null,
      equipment.includes('Dumbbells') ? 'Dumbbell Thrusters' : null,
      equipment.includes('Kettlebells') ? 'Kettlebell Swing' : null,
      'Burpee' // Last resort
    ],
    
    hiit: [
      equipment.includes('Kettlebells') ? 'Kettlebell Swing' : null,
      equipment.includes('Plyo Box') ? 'Box Jump' : null,
      equipment.includes('Battle Rope') ? 'Battle Rope Waves' : null,
      equipment.includes('Medicine Ball') ? 'Medicine Ball Slam' : null,
      'Burpee'
    ],
  };

  const lifts = (coreLiftMap[workoutType.toLowerCase()] || []).filter((lift): lift is string => lift !== null);
  return lifts[0] || 'Bodyweight Squat'; // Return first available, never push-up as default
}

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