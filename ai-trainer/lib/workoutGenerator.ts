import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface WorkoutType {
  id: string;
  name: string;
  category: string;
  target_muscles: string[];
  movement_patterns: string[];
}

interface Exercise {
  id: string;
  name: string;
  category: string;
  primary_muscle: string;
  equipment_required: string[];
  instruction: string;
  exercise_phase: string;
  rest_seconds_default: number;
  set_duration_seconds: number;
}

interface GeneratedWorkout {
  type: WorkoutType;
  warmup: any[];
  mainExercises: any[];
  accessories: any[];
  cooldown: any[];
  duration: number;
  focus: string;
}

interface WorkoutOptions {
  timeLimit?: number;
  exerciseCount?: number;
}

export async function generateWorkout(workoutType: WorkoutType, timeMinutes: number, userId: string): Promise<GeneratedWorkout> {
  const generator = new DynamicWorkoutGenerator();
  
  // Adjust exercise count based on time
  const exerciseCount = Math.floor(timeMinutes / 8); // ~8 min per exercise
  
  const workout = await generator.generateWorkoutForType(
    workoutType,
    userId,
    {
      timeLimit: timeMinutes,
      exerciseCount: exerciseCount
    }
  );
  
  return workout;
}

export async function generateWorkoutForType(workoutType: WorkoutType, userId: string, options?: WorkoutOptions): Promise<GeneratedWorkout> {
  // Get user equipment
  const equipment = await getUserEquipment(userId);
  
  // Get exercises matching this workout type
  const exercises = await getExercisesForWorkoutType(workoutType, equipment);
  
  // Build workout structure
  return {
    type: workoutType,
    warmup: selectWarmupExercises(workoutType),
    mainExercises: selectMainExercises(exercises, workoutType, options),
    accessories: selectAccessories(exercises, workoutType, options),
    cooldown: selectCooldown(workoutType),
    duration: options?.timeLimit || 45,
    focus: workoutType.target_muscles[0] || 'strength'
  };
}

async function getUserEquipment(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('user_equipment')
    .select('equipment!inner(name)')
    .eq('user_id', userId);
  
  if (error) {
    console.error('Error fetching user equipment:', error);
    return [];
  }
  
  return (data || []).map((r: any) => r.equipment.name);
}

async function getExercisesForWorkoutType(workoutType: WorkoutType, availableEquipment: string[]): Promise<Exercise[]> {
  // Get exercises that target the workout type's muscle groups
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .overlaps('primary_muscle', workoutType.target_muscles)
    .order('category', { ascending: false }); // Prioritize strength exercises

  if (error) {
    console.error('Error fetching exercises:', error);
    return [];
  }

  // Filter by available equipment
  const filteredExercises = (data || []).filter((exercise: Exercise) => {
    const exerciseEquipment = exercise.equipment_required || [];
    
    // If exercise requires no equipment, it's always available
    if (exerciseEquipment.length === 0) return true;
    
    // Check if user has any of the required equipment
    return exerciseEquipment.some(equipment => 
      availableEquipment.includes(equipment)
    );
  });

  return filteredExercises;
}

function selectWarmupExercises(workoutType: WorkoutType): any[] {
  const warmupExercises = [
    { name: "Light Cardio", duration: "2 min" },
    { name: "Dynamic Stretches", duration: "2 min" },
    { name: "Movement Prep", duration: "1 min" }
  ];

  // Add specific warmup for the workout type
  if (workoutType.name === 'legs') {
    warmupExercises.splice(1, 0, { name: "Bodyweight Squats", duration: "1 min" });
  } else if (workoutType.name === 'push') {
    warmupExercises.splice(1, 0, { name: "Push-Up Prep", duration: "1 min" });
  } else if (workoutType.name === 'pull') {
    warmupExercises.splice(1, 0, { name: "Band Rows", duration: "1 min" });
  }

  return warmupExercises;
}

function selectMainExercises(exercises: Exercise[], workoutType: WorkoutType, options?: WorkoutOptions): any[] {
  const mainExercises: any[] = [];
  
  // Select 1-2 main compound movements
  const compoundExercises = exercises.filter(ex => 
    ex.exercise_phase === 'core_lift' || 
    ex.category === 'strength'
  );

  // Prioritize exercises that match the workout type's movement patterns
  const prioritizedExercises = compoundExercises.sort((a, b) => {
    const aMatches = workoutType.movement_patterns.some(pattern => 
      a.name.toLowerCase().includes(pattern.replace('_', ' '))
    );
    const bMatches = workoutType.movement_patterns.some(pattern => 
      b.name.toLowerCase().includes(pattern.replace('_', ' '))
    );
    
    if (aMatches && !bMatches) return -1;
    if (!aMatches && bMatches) return 1;
    return 0;
  });

  // Select exercises based on time limit
  const maxExercises = options?.exerciseCount ? Math.min(2, options.exerciseCount) : 2;
  const selectedExercises = prioritizedExercises.slice(0, maxExercises);
  
  selectedExercises.forEach(exercise => {
    mainExercises.push({
      name: exercise.name,
      sets: 4,
      reps: "6-8",
      rest: exercise.rest_seconds_default || 180,
      instruction: exercise.instruction
    });
  });

  return mainExercises;
}

function selectAccessories(exercises: Exercise[], workoutType: WorkoutType, options?: WorkoutOptions): any[] {
  const accessories: any[] = [];
  
  // Select 2-4 accessory exercises
  const accessoryExercises = exercises.filter(ex => 
    ex.exercise_phase === 'accessory' || 
    ex.category === 'hypertrophy'
  );

  // Prioritize exercises that target the workout type's muscles
  const prioritizedAccessories = accessoryExercises.sort((a, b) => {
    const aTargets = workoutType.target_muscles.some(muscle => 
      a.primary_muscle === muscle
    );
    const bTargets = workoutType.target_muscles.some(muscle => 
      b.primary_muscle === muscle
    );
    
    if (aTargets && !bTargets) return -1;
    if (!aTargets && bTargets) return 1;
    return 0;
  });

  // Select accessories based on time limit
  const maxAccessories = options?.exerciseCount ? Math.max(2, options.exerciseCount - 2) : 4;
  const selectedAccessories = prioritizedAccessories.slice(0, maxAccessories);
  
  selectedAccessories.forEach(exercise => {
    accessories.push({
      name: exercise.name,
      sets: 3,
      reps: "10-12",
      rest: exercise.rest_seconds_default || 150,
      instruction: exercise.instruction
    });
  });

  return accessories;
}

function selectCooldown(workoutType: WorkoutType): any[] {
  const cooldownExercises = [
    { name: "Light Stretching", duration: "2 min" },
    { name: "Deep Breathing", duration: "1 min" },
    { name: "Cool Down Walk", duration: "1 min" }
  ];

  // Add specific cooldown for the workout type
  if (workoutType.name === 'legs') {
    cooldownExercises.splice(1, 0, { name: "Quad Stretch", duration: "1 min" });
  } else if (workoutType.name === 'push') {
    cooldownExercises.splice(1, 0, { name: "Chest Stretch", duration: "1 min" });
  } else if (workoutType.name === 'pull') {
    cooldownExercises.splice(1, 0, { name: "Back Stretch", duration: "1 min" });
  }

  return cooldownExercises;
}

export async function saveWorkout(userId: string, workoutData: any, workoutTypeId: string) {
  const { data, error } = await supabase
    .from('workouts')
    .insert({
      user_id: userId,
      workout_data: workoutData,
      workout_type_id: workoutTypeId,
      created_at: new Date().toISOString()
    });

  if (error) {
    console.error('Error saving workout:', error);
    throw error;
  }

  return data;
}

export async function getWorkoutSuggestions(userId: string) {
  try {
    const response = await fetch('/api/workoutSuggestions', {
      headers: {
        'x-user-id': userId
      }
    });
    
    const data = await response.json();
    return data.suggestion;
  } catch (error) {
    console.error('Error getting workout suggestions:', error);
    return null;
  }
}

// DynamicWorkoutGenerator class (simplified for this implementation)
class DynamicWorkoutGenerator {
  async generateWorkoutForType(workoutType: WorkoutType, userId: string, options?: WorkoutOptions): Promise<GeneratedWorkout> {
    return generateWorkoutForType(workoutType, userId, options);
  }
} 