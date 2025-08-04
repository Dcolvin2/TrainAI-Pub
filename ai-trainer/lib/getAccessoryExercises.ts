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
  
  // Build equipment filter
  const equipmentFilter = equipment.length > 0 
    ? equipment.map(eq => `"${eq}"`).join(',')
    : '[]';

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

  // Query exercises that match our criteria
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .in('exercise_phase', ['accessory', 'main'])
    .not('category', 'in', '("hiit", "mobility", "endurance")')
    .or(`primary_muscle.in.(${targetMuscles.map(m => `"${m}"`).join(',')})`);

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

  // Sort by relevance (target muscles first, then by category)
  const sortedExercises = availableExercises.sort((a, b) => {
    // Prioritize exercises that directly target the primary muscle
    const aIsPrimary = muscleTargets.some(target => 
      a.primary_muscle.toLowerCase().includes(target.toLowerCase())
    );
    const bIsPrimary = muscleTargets.some(target => 
      b.primary_muscle.toLowerCase().includes(target.toLowerCase())
    );

    if (aIsPrimary && !bIsPrimary) return -1;
    if (!aIsPrimary && bIsPrimary) return 1;

    // Then sort by category preference (strength > hypertrophy > endurance)
    const categoryOrder = { 'strength': 1, 'hypertrophy': 2, 'endurance': 3 };
    const aOrder = categoryOrder[a.category as keyof typeof categoryOrder] || 4;
    const bOrder = categoryOrder[b.category as keyof typeof categoryOrder] || 4;

    return aOrder - bOrder;
  });

  return sortedExercises.slice(0, 20); // Return top 20 matches
} 