import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface AccessoryExercise {
  name: string;
  category: string;
  primary_muscle: string;
  rest_seconds_default: number;
  set_duration_seconds: number;
  instruction: string;
}

export async function getAccessoryExercises(
  muscleTargets: string[],
  equipment: string[],
  excludeExercises: string[] = []
): Promise<AccessoryExercise[]> {
  
  console.log("[DEBUG] getAccessoryExercises called with:");
  console.log("[DEBUG] - muscleTargets:", muscleTargets);
  console.log("[DEBUG] - equipment:", equipment);
  console.log("[DEBUG] - excludeExercises:", excludeExercises);
  
  // Build muscle filter - target the primary muscles and common synergists
  const muscleMap: Record<string, string[]> = {
    'quads': ['quads', 'glutes', 'hamstrings'],
    'glutes': ['glutes', 'quads', 'hamstrings'],
    'hamstrings': ['hamstrings', 'glutes', 'quads'],
    'chest': ['chest', 'triceps', 'shoulders'],
    'triceps': ['triceps', 'chest', 'shoulders'],
    'shoulders': ['shoulders', 'triceps', 'chest'],
    'back': ['back', 'biceps', 'rear delts'],
    'biceps': ['biceps', 'back', 'forearms'],
    'core': ['core', 'abs', 'obliques'],
    'calves': ['calves', 'ankles'],
    'grip': ['grip', 'forearms'],
    'full body': ['full body', 'core', 'quads', 'glutes', 'chest', 'back']
  };

  const targetMuscles = muscleTargets.flatMap(target => 
    muscleMap[target.toLowerCase()] || [target.toLowerCase()]
  );
  
  console.log("[DEBUG] - targetMuscles:", targetMuscles);

  // Query exercises that match our criteria - broader search for better options
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .in('exercise_phase', ['accessory', 'main'])
    .not('category', 'in', '("hiit", "mobility", "endurance")')
    .or(`primary_muscle.in.(${targetMuscles.map(m => `"${m}"`).join(',')})`);

  console.log("[DEBUG] Database query result:");
  console.log("[DEBUG] - error:", error);
  console.log("[DEBUG] - data count:", data?.length || 0);
  console.log("[DEBUG] - sample data:", data?.slice(0, 3).map(ex => ({ name: ex.name, muscle: ex.primary_muscle, category: ex.category })));

  if (error) {
    console.error('Error fetching accessory exercises:', error);
    return [];
  }

  if (!data) return [];

  // Filter by equipment availability
  const availableExercises = data.filter(exercise => {
    // Skip if exercise is in exclude list
    if (excludeExercises.some(excluded => 
      exercise.name.toLowerCase().includes(excluded.toLowerCase())
    )) {
      return false;
    }

    // If no equipment required, include it
    if (!exercise.equipment_required || exercise.equipment_required.length === 0) {
      return true;
    }

    // Check if user has required equipment
    const requiredEquipment = exercise.equipment_required;
    return requiredEquipment.every((req: string) => equipment.includes(req));
  });

  console.log("[DEBUG] After equipment filtering:", availableExercises.length);
  console.log("[DEBUG] - sample available:", availableExercises.slice(0, 3).map(ex => ({ name: ex.name, muscle: ex.primary_muscle, category: ex.category })));

  // Enhanced sorting for better variety and progression
  const sortedExercises = availableExercises.sort((a, b) => {
    // First priority: exercises that directly target the primary muscle
    const aIsPrimary = muscleTargets.some(target => 
      a.primary_muscle.toLowerCase().includes(target.toLowerCase())
    );
    const bIsPrimary = muscleTargets.some(target => 
      b.primary_muscle.toLowerCase().includes(target.toLowerCase())
    );

    if (aIsPrimary && !bIsPrimary) return -1;
    if (!aIsPrimary && bIsPrimary) return 1;

    // Second priority: category preference (strength > hypertrophy > endurance)
    const categoryOrder = { 'strength': 1, 'hypertrophy': 2, 'endurance': 3 };
    const aOrder = categoryOrder[a.category as keyof typeof categoryOrder] || 4;
    const bOrder = categoryOrder[b.category as keyof typeof categoryOrder] || 4;

    if (aOrder !== bOrder) return aOrder - bOrder;

    // Third priority: equipment complexity (bodyweight first, then simple equipment)
    const aEquipmentCount = a.equipment_required?.length || 0;
    const bEquipmentCount = b.equipment_required?.length || 0;
    
    if (aEquipmentCount !== bEquipmentCount) return aEquipmentCount - bEquipmentCount;

    // Finally: alphabetical for consistency
    return a.name.localeCompare(b.name);
  });

  // Return a good mix of exercises (not just top matches)
  const primaryMatches = sortedExercises.filter(ex => 
    muscleTargets.some(target => 
      ex.primary_muscle.toLowerCase().includes(target.toLowerCase())
    )
  ).slice(0, 8);

  const secondaryMatches = sortedExercises.filter(ex => 
    !muscleTargets.some(target => 
      ex.primary_muscle.toLowerCase().includes(target.toLowerCase())
    )
  ).slice(0, 12);

  const finalResult = [...primaryMatches, ...secondaryMatches];
  
  console.log("[DEBUG] Final result:");
  console.log("[DEBUG] - primary matches:", primaryMatches.length);
  console.log("[DEBUG] - secondary matches:", secondaryMatches.length);
  console.log("[DEBUG] - total exercises:", finalResult.length);
  console.log("[DEBUG] - exercise names:", finalResult.map(ex => ex.name));

  return finalResult;
} 