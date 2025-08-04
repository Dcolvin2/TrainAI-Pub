import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface CoreLift {
  name: string;
  equipment_required: string[];
}

export async function buildCoreLiftPool(focus: string, userEquipment: string[]): Promise<CoreLift[]> {
  try {
    console.log(`[buildCoreLiftPool] Building pool for focus: ${focus}, user equipment:`, userEquipment);

    // 1. Build the initial query based on focus
    let query = supabase
      .from('exercises')
      .select('name, equipment_required')
      .eq('exercise_phase', 'core_lift')
      .eq('category', 'strength');

    // Determine target muscles based on focus
    let targetMuscles: string[] = [];
    
    if (focus.toLowerCase() === 'push' || focus.toLowerCase() === 'chest') {
      targetMuscles = ['chest', 'shoulders', 'triceps'];
    } else if (focus.toLowerCase() === 'pull' || focus.toLowerCase() === 'back') {
      targetMuscles = ['back', 'biceps'];
    } else if (focus.toLowerCase() === 'legs' || focus.toLowerCase() === 'lower') {
      targetMuscles = ['quads', 'hamstrings', 'glutes', 'calves'];
    } else if (focus.toLowerCase() === 'upper') {
      targetMuscles = ['chest', 'back', 'shoulders', 'biceps', 'triceps'];
    } else if (focus.toLowerCase() === 'full_body' || focus.toLowerCase() === 'full') {
      targetMuscles = ['all'];
    } else {
      // Specific muscle group focus
      targetMuscles = [focus.toLowerCase()];
    }

    // Add muscle group filter
    if (targetMuscles.length > 0 && !targetMuscles.includes('all')) {
      query = query.or(targetMuscles.map(muscle => `muscle_group.ilike.%${muscle}%`).join(','));
    }

    console.log(`[buildCoreLiftPool] Target muscles:`, targetMuscles);

    // 2. Execute the query
    const { data: exercises, error } = await query;

    if (error) {
      console.error('[buildCoreLiftPool] Query error:', error);
      return [];
    }

    console.log(`[buildCoreLiftPool] Found ${exercises?.length || 0} exercises before equipment filtering`);

    // 3. Filter by equipment
    const filteredExercises = exercises?.filter(exercise => {
      if (!exercise.equipment_required || exercise.equipment_required.length === 0) {
        return true; // No equipment required
      }

      // Check if user has all required equipment
      const hasAllEquipment = exercise.equipment_required.every((required: string) => 
        userEquipment.some(userEq => 
          userEq.toLowerCase().includes(required.toLowerCase()) ||
          required.toLowerCase().includes(userEq.toLowerCase())
        )
      );

      return hasAllEquipment;
    }) || [];

    console.log(`[buildCoreLiftPool] After equipment filtering: ${filteredExercises.length} exercises`);

    // 4. Fallback: if no core lifts found, try main phase exercises
    if (filteredExercises.length === 0) {
      console.log('[buildCoreLiftPool] No core lifts found, trying main phase exercises');
      
      let fallbackQuery = supabase
        .from('exercises')
        .select('name, equipment_required')
        .eq('exercise_phase', 'main')
        .eq('category', 'strength');

      if (targetMuscles.length > 0 && !targetMuscles.includes('all')) {
        fallbackQuery = fallbackQuery.or(targetMuscles.map(muscle => `muscle_group.ilike.%${muscle}%`).join(','));
      }

      const { data: fallbackExercises, error: fallbackError } = await fallbackQuery;

      if (fallbackError) {
        console.error('[buildCoreLiftPool] Fallback query error:', fallbackError);
        return [];
      }

      const filteredFallback = fallbackExercises?.filter(exercise => {
        if (!exercise.equipment_required || exercise.equipment_required.length === 0) {
          return true;
        }

        return exercise.equipment_required.every((required: string) => 
          userEquipment.some(userEq => 
            userEq.toLowerCase().includes(required.toLowerCase()) ||
            required.toLowerCase().includes(userEq.toLowerCase())
          )
        );
      }) || [];

      console.log(`[buildCoreLiftPool] Fallback exercises found: ${filteredFallback.length}`);
      return filteredFallback;
    }

    return filteredExercises;

  } catch (error) {
    console.error('[buildCoreLiftPool] Error:', error);
    return [];
  }
} 