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
      equipment.includes('barbell') ? 'Barbell Bench Press' : null,
      equipment.includes('dumbbells') ? 'Dumbbell Bench Press' : null,
      equipment.includes('cables') ? 'Cable Chest Press' : null,
      equipment.includes('barbell') ? 'Barbell Overhead Press' : null,
      equipment.includes('dumbbells') ? 'Dumbbell Shoulder Press' : null,
      equipment.includes('barbell') ? 'Barbell Incline Press' : null,
      equipment.includes('dumbbells') ? 'Dumbbell Incline Press' : null,
    ],
    
    pull: [
      equipment.includes('pull up bar') ? 'Pull-Up' : null,
      equipment.includes('barbell') ? 'Barbell Bent-Over Row' : null,
      equipment.includes('dumbbells') ? 'Dumbbell Row' : null,
      equipment.includes('cables') ? 'Cable Row' : null,
      equipment.includes('barbell') ? 'Barbell Deadlift' : null,
      equipment.includes('barbell') ? 'Barbell Upright Row' : null,
    ],
    
    legs: [
      equipment.includes('barbell') && equipment.includes('squat rack') ? 'Barbell Back Squat' : null,
      equipment.includes('barbell') ? 'Barbell Deadlift' : null,
      equipment.includes('barbell') ? 'Barbell Front Squat' : null,
      equipment.includes('dumbbells') ? 'Dumbbell Goblet Squat' : null,
      equipment.includes('dumbbells') ? 'Dumbbell Split Squat' : null,
      equipment.includes('kettlebells') ? 'Kettlebell Goblet Squat' : null,
      equipment.includes('barbell') ? 'Romanian Deadlift' : null,
    ],
    
    upper: [
      equipment.includes('barbell') ? 'Barbell Overhead Press' : null,
      equipment.includes('dumbbells') ? 'Dumbbell Shoulder Press' : null,
      equipment.includes('barbell') ? 'Barbell Bench Press' : null,
      equipment.includes('dumbbells') ? 'Dumbbell Bench Press' : null,
      equipment.includes('pull up bar') ? 'Pull-Up' : null,
      equipment.includes('barbell') ? 'Barbell Bent-Over Row' : null,
    ],
    
    full: [
      equipment.includes('barbell') ? 'Barbell Deadlift' : null,
      equipment.includes('barbell') ? 'Barbell Clean and Press' : null,
      equipment.includes('dumbbells') ? 'Dumbbell Thrusters' : null,
      equipment.includes('kettlebells') ? 'Kettlebell Swing' : null,
      equipment.includes('barbell') ? 'Barbell Squat' : null,
    ],
    
    hiit: [
      equipment.includes('kettlebells') ? 'Kettlebell Swing' : null,
      equipment.includes('plyo box') ? 'Box Jump' : null,
      equipment.includes('battle rope') ? 'Battle Rope Waves' : null,
      equipment.includes('medicine ball') ? 'Medicine Ball Slam' : null,
      'Burpee',
    ],
  };

  const lifts = (coreLiftMap[workoutType.toLowerCase()] || []).filter((lift): lift is string => lift !== null);
  
  // Better fallbacks based on workout type
  const fallbackLifts: Record<string, string> = {
    push: 'Dumbbell Bench Press',
    pull: 'Dumbbell Row', 
    legs: 'Dumbbell Goblet Squat',
    upper: 'Dumbbell Shoulder Press',
    full: 'Dumbbell Thrusters',
    hiit: 'Burpee'
  };
  
  return lifts[0] || fallbackLifts[workoutType.toLowerCase()] || 'Dumbbell Bench Press';
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

    // Better fallbacks that are actually main lifts
    const fallbackLifts: Record<string, CoreLift> = {
      push: { name: 'Dumbbell Bench Press', equipment_required: ['dumbbells'] },
      pull: { name: 'Dumbbell Row', equipment_required: ['dumbbells'] },
      legs: { name: 'Dumbbell Goblet Squat', equipment_required: ['dumbbells'] },
      upper: { name: 'Dumbbell Shoulder Press', equipment_required: ['dumbbells'] },
      full: { name: 'Dumbbell Thrusters', equipment_required: ['dumbbells'] },
      hiit: { name: 'Burpee', equipment_required: ['bodyweight'] }
    };

    return data?.length ? data : [fallbackLifts[focus] || fallbackLifts.push];

  } catch (error) {
    console.error('[buildCoreLiftPool] Error:', error);
    const fallbackLifts: Record<string, CoreLift> = {
      push: { name: 'Dumbbell Bench Press', equipment_required: ['dumbbells'] },
      pull: { name: 'Dumbbell Row', equipment_required: ['dumbbells'] },
      legs: { name: 'Dumbbell Goblet Squat', equipment_required: ['dumbbells'] },
      upper: { name: 'Dumbbell Shoulder Press', equipment_required: ['dumbbells'] },
      full: { name: 'Dumbbell Thrusters', equipment_required: ['dumbbells'] },
      hiit: { name: 'Burpee', equipment_required: ['bodyweight'] }
    };
    return [fallbackLifts[focus] || fallbackLifts.push];
  }
} 