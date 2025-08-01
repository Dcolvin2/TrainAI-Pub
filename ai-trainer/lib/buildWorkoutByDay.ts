import { supabase } from './supabaseClient';

interface WeeklyWorkoutTemplate {
  day_of_week: string;
  workout_type: string;
  core_lift_name: string | null;
  focus_muscle_group: string;
}

interface UserEquipment {
  equipment_id: number;
  name: string;
}

interface Exercise {
  id: number;
  name: string;
  category: string;
  exercise_phase: string;
  equipment_required: string[];
  muscle_group: string;
  instructions?: string;
}

interface WorkoutPlan {
  warmupArr: Exercise[];
  coreLift: Exercise | null;
  accessories: Exercise[];
  cooldownArr: Exercise[];
  estimatedMinutes: number;
  workoutType: string;
  focusMuscleGroup: string;
}

// Get user's available equipment
async function getUserEquipment(userId: string): Promise<string[]> {
  try {
    const { data: equipment, error } = await supabase
      .from('user_equipment')
      .select(`
        equipment_id,
        equipment:equipment_id (
          name
        )
      `)
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching user equipment:', error);
      return ['bodyweight']; // Default to bodyweight if error
    }

    return equipment?.map((e: any) => e.equipment.name) || ['bodyweight'];
  } catch (error) {
    console.error('Error in getUserEquipment:', error);
    return ['bodyweight'];
  }
}

// Get weekly workout template for a specific day
async function getWeeklyWorkoutTemplate(dayOfWeek: string): Promise<WeeklyWorkoutTemplate | null> {
  try {
    const { data, error } = await supabase
      .from('weekly_workout_template')
      .select('*')
      .eq('day_of_week', dayOfWeek)
      .single();

    if (error) {
      console.error('Error fetching weekly workout template:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getWeeklyWorkoutTemplate:', error);
    return null;
  }
}

// Filter exercises by available equipment
async function getFilteredExercises(
  category: string,
  exercisePhase: string,
  availableEquipment: string[]
): Promise<Exercise[]> {
  try {
    console.log(`[FILTER] Getting ${category} exercises for ${exercisePhase} phase`);
    console.log(`[FILTER] Available equipment:`, availableEquipment);
    
    const { data: exercises, error } = await supabase
      .from('exercises')
      .select('*')
      .eq('category', category)
      .eq('exercise_phase', exercisePhase);

    if (error) {
      console.error('[FILTER] Error fetching exercises:', error);
      return [];
    }

    console.log(`[FILTER] Found ${exercises?.length || 0} total exercises`);

    // Filter exercises by available equipment
    const filteredExercises = exercises?.filter(exercise => {
      // Always include bodyweight exercises (no equipment required)
      if (!exercise.equipment_required || exercise.equipment_required.length === 0) {
        console.log(`[FILTER] Including bodyweight exercise: ${exercise.name}`);
        return true;
      }
      
      // Check if user has any of the required equipment
      const hasEquipment = exercise.equipment_required.some((equipment: string) => 
        availableEquipment.includes(equipment)
      );
      
      if (hasEquipment) {
        console.log(`[FILTER] Including equipment exercise: ${exercise.name} (requires: ${exercise.equipment_required.join(', ')})`);
      } else {
        console.log(`[FILTER] Excluding exercise: ${exercise.name} (requires: ${exercise.equipment_required.join(', ')})`);
      }
      
      return hasEquipment;
    }) || [];

    console.log(`[FILTER] Filtered to ${filteredExercises.length} exercises`);
    return filteredExercises;
  } catch (error) {
    console.error('[FILTER] Error in getFilteredExercises:', error);
    return [];
  }
}

// Generate HIIT workout with multiple exercises
async function generateHIITWorkout(availableEquipment: string[], timeAvailable: number): Promise<Exercise[]> {
  console.log('[HIIT] Generating HIIT workout with equipment:', availableEquipment);
  
  // Get bodyweight exercises for HIIT
  const bodyweightExercises = await getFilteredExercises('cardio', 'main', availableEquipment);
  console.log('[HIIT] Bodyweight exercises found:', bodyweightExercises.length);
  
  // Get equipment-based exercises
  const equipmentExercises = await getFilteredExercises('strength', 'main', availableEquipment);
  console.log('[HIIT] Equipment exercises found:', equipmentExercises.length);
  
  // Combine and select 4-6 exercises
  const allExercises = [...bodyweightExercises, ...equipmentExercises];
  console.log('[HIIT] Total exercises available:', allExercises.length);
  
  // Select exercises based on time available
  const numExercises = timeAvailable >= 45 ? 6 : 4;
  let selectedExercises = allExercises.slice(0, numExercises);
  
  console.log('[HIIT] Selected exercises:', selectedExercises.map(e => e.name));
  
  // If we don't have enough exercises, add some defaults
  if (selectedExercises.length < numExercises) {
    console.log(`[HIIT] Need ${numExercises - selectedExercises.length} more exercises, adding defaults`);
    const defaultHIIT = [
      { id: 9991, name: 'Burpees', category: 'cardio', exercise_phase: 'main', equipment_required: ['bodyweight'], muscle_group: 'full_body' },
      { id: 9992, name: 'Mountain Climbers', category: 'cardio', exercise_phase: 'main', equipment_required: ['bodyweight'], muscle_group: 'core' },
      { id: 9993, name: 'Jump Squats', category: 'cardio', exercise_phase: 'main', equipment_required: ['bodyweight'], muscle_group: 'legs' },
      { id: 9994, name: 'Push-ups', category: 'strength', exercise_phase: 'main', equipment_required: ['bodyweight'], muscle_group: 'chest' },
      { id: 9995, name: 'High Knees', category: 'cardio', exercise_phase: 'main', equipment_required: ['bodyweight'], muscle_group: 'cardiovascular' },
      { id: 9996, name: 'Plank', category: 'strength', exercise_phase: 'main', equipment_required: ['bodyweight'], muscle_group: 'core' }
    ];
    
    const needed = numExercises - selectedExercises.length;
    const defaultsToAdd = defaultHIIT.slice(0, needed);
    selectedExercises.push(...defaultsToAdd);
    console.log('[HIIT] Added default exercises:', defaultsToAdd.map(e => e.name));
  }
  
  console.log('[HIIT] Final HIIT workout:', selectedExercises.map(e => e.name));
  return selectedExercises;
}

// Generate cardio workout
async function generateCardioWorkout(availableEquipment: string[]): Promise<Exercise[]> {
  const cardioExercises = await getFilteredExercises('cardio', 'main', availableEquipment);
  
  if (cardioExercises.length === 0) {
    return [
      { id: 9995, name: 'Running', category: 'cardio', exercise_phase: 'main', equipment_required: ['bodyweight'], muscle_group: 'cardiovascular' },
      { id: 9996, name: 'Jump Rope', category: 'cardio', exercise_phase: 'main', equipment_required: ['bodyweight'], muscle_group: 'cardiovascular' }
    ];
  }
  
  return cardioExercises.slice(0, 3); // Return 3 cardio exercises
}

// Find core lift exercise based on equipment availability
async function findCoreLift(coreLiftName: string, availableEquipment: string[]): Promise<Exercise | null> {
  try {
    const { data: exercises, error } = await supabase
      .from('exercises')
      .select('*')
      .ilike('name', `%${coreLiftName}%`)
      .eq('exercise_phase', 'core_lift');

    if (error || !exercises || exercises.length === 0) {
      return null;
    }

    // Find the best match based on available equipment
    for (const exercise of exercises) {
      if (!exercise.equipment_required || exercise.equipment_required.length === 0) {
        return exercise;
      }
      
      if (exercise.equipment_required.some((equipment: string) => availableEquipment.includes(equipment))) {
        return exercise;
      }
    }

    // If no exact match, find alternative
    const alternatives = await getFilteredExercises('strength', 'core_lift', availableEquipment);
    return alternatives.length > 0 ? alternatives[0] : null;
  } catch (error) {
    console.error('Error in findCoreLift:', error);
    return null;
  }
}

export async function buildWorkoutByDay(userId: string, dayOfWeek: string, timeAvailable: number): Promise<WorkoutPlan> {
  try {
    console.log(`[WORKOUT] Building workout for ${dayOfWeek}, user: ${userId}, time: ${timeAvailable}min`);
    
    // Get user's available equipment
    const availableEquipment = await getUserEquipment(userId);
    console.log('[WORKOUT] Available equipment:', availableEquipment);

    // Get weekly workout template
    const template = await getWeeklyWorkoutTemplate(dayOfWeek);
    console.log('[WORKOUT] Weekly template for', dayOfWeek, ':', template);

    if (!template) {
      console.error(`[WORKOUT] No template found for ${dayOfWeek}`);
      throw new Error(`No template found for ${dayOfWeek}`);
    }

    const workoutType = template.workout_type;
    const focusMuscleGroup = template.focus_muscle_group;
    
    console.log(`[WORKOUT] Workout type: ${workoutType}, Focus: ${focusMuscleGroup}`);

    let warmupArr: Exercise[] = [];
    let coreLift: Exercise | null = null;
    let accessories: Exercise[] = [];
    let cooldownArr: Exercise[] = [];

    // Handle different workout types
    switch (workoutType) {
      case 'strength':
        console.log('[WORKOUT] Generating strength workout');
        // Get warmup exercises
        warmupArr = await getFilteredExercises('cardio', 'warmup', availableEquipment);
        console.log('[WORKOUT] Warmup exercises:', warmupArr.map(e => e.name));
        
        // Get core lift if specified
        if (template.core_lift_name) {
          console.log('[WORKOUT] Looking for core lift:', template.core_lift_name);
          coreLift = await findCoreLift(template.core_lift_name, availableEquipment);
          console.log('[WORKOUT] Core lift found:', coreLift?.name || 'none');
        }
        
        // Get accessory exercises
        accessories = await getFilteredExercises('strength', 'accessory', availableEquipment);
        console.log('[WORKOUT] Accessory exercises:', accessories.map(e => e.name));
        
        // Get cooldown exercises
        cooldownArr = await getFilteredExercises('cardio', 'cooldown', availableEquipment);
        console.log('[WORKOUT] Cooldown exercises:', cooldownArr.map(e => e.name));
        break;

      case 'hiit':
        console.log('[WORKOUT] Generating HIIT workout');
        // HIIT workouts have different structure
        warmupArr = await getFilteredExercises('cardio', 'warmup', availableEquipment);
        accessories = await generateHIITWorkout(availableEquipment, timeAvailable);
        cooldownArr = await getFilteredExercises('cardio', 'cooldown', availableEquipment);
        console.log('[WORKOUT] HIIT exercises:', accessories.map(e => e.name));
        break;

      case 'cardio':
        console.log('[WORKOUT] Generating cardio workout');
        // Cardio workouts
        warmupArr = await getFilteredExercises('cardio', 'warmup', availableEquipment);
        accessories = await generateCardioWorkout(availableEquipment);
        cooldownArr = await getFilteredExercises('cardio', 'cooldown', availableEquipment);
        console.log('[WORKOUT] Cardio exercises:', accessories.map(e => e.name));
        break;

      case 'rest':
        console.log('[WORKOUT] Rest day - minimal exercises');
        // Rest day - minimal exercises
        warmupArr = await getFilteredExercises('cardio', 'warmup', availableEquipment);
        cooldownArr = await getFilteredExercises('cardio', 'cooldown', availableEquipment);
        break;

      default:
        console.error(`[WORKOUT] Unknown workout type: ${workoutType}`);
        throw new Error(`Unknown workout type: ${workoutType}`);
    }

    // Calculate estimated minutes
    const estimatedMinutes = calculateEstimatedMinutes(warmupArr, coreLift, accessories, cooldownArr, workoutType);
    console.log(`[WORKOUT] Estimated minutes: ${estimatedMinutes}`);

    const result = {
      warmupArr: warmupArr.slice(0, 3), // Limit to 3 warmup exercises
      coreLift,
      accessories: accessories.slice(0, 4), // Limit to 4 accessory exercises
      cooldownArr: cooldownArr.slice(0, 2), // Limit to 2 cooldown exercises
      estimatedMinutes,
      workoutType,
      focusMuscleGroup
    };
    
    console.log('[WORKOUT] Final workout plan:', {
      warmup: result.warmupArr.map(e => e.name),
      coreLift: result.coreLift?.name,
      accessories: result.accessories.map(e => e.name),
      cooldown: result.cooldownArr.map(e => e.name),
      type: result.workoutType,
      focus: result.focusMuscleGroup
    });

    return result;

  } catch (error) {
    console.error('[WORKOUT] Error in buildWorkoutByDay:', error);
    
    // Return fallback workout
    return {
      warmupArr: [
        { id: 9997, name: 'Light Jogging', category: 'cardio', exercise_phase: 'warmup', equipment_required: ['bodyweight'], muscle_group: 'cardiovascular' }
      ],
      coreLift: null,
      accessories: [
        { id: 9998, name: 'Push-ups', category: 'strength', exercise_phase: 'accessory', equipment_required: ['bodyweight'], muscle_group: 'chest' },
        { id: 9999, name: 'Squats', category: 'strength', exercise_phase: 'accessory', equipment_required: ['bodyweight'], muscle_group: 'legs' }
      ],
      cooldownArr: [
        { id: 10000, name: 'Stretching', category: 'cardio', exercise_phase: 'cooldown', equipment_required: ['bodyweight'], muscle_group: 'flexibility' }
      ],
      estimatedMinutes: 30,
      workoutType: 'strength',
      focusMuscleGroup: 'full_body'
    };
  }
}

function calculateEstimatedMinutes(
  warmup: Exercise[],
  coreLift: Exercise | null,
  accessories: Exercise[],
  cooldown: Exercise[],
  workoutType: string
): number {
  let totalMinutes = 0;
  
  // Warmup: 2 minutes per exercise
  totalMinutes += warmup.length * 2;
  
  // Core lift: 8-10 minutes
  if (coreLift) {
    totalMinutes += workoutType === 'strength' ? 10 : 5;
  }
  
  // Accessories: 3-5 minutes per exercise
  accessories.forEach(exercise => {
    if (workoutType === 'hiit') {
      totalMinutes += 2; // HIIT exercises are shorter
    } else {
      totalMinutes += 4;
    }
  });
  
  // Cooldown: 2 minutes per exercise
  totalMinutes += cooldown.length * 2;
  
  return Math.max(totalMinutes, 20); // Minimum 20 minutes
}

// ---------- DEV HELPER ----------
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  // @ts-ignore – expose helper only in dev
  (window as any).__showPlan = async (day: string = 'Monday') => {
    const plan = await buildWorkoutByDay('test-user', day, 45);
    console.table([
      ['Target min',        plan.estimatedMinutes?.toFixed(1) || 'N/A'],
      ['Warm-up drills',    plan.warmupArr.length],
      ['Accessories',       plan.accessories.length],
      ['Cooldown drills',   plan.cooldownArr.length],
    ]);
    return plan;  // so I can expand it in DevTools
  };
  console.info('👋  Dev helper ready – type  __showPlan("Monday")  in the console');
}
// -------------------------------- 