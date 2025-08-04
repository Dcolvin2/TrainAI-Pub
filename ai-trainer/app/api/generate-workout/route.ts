// Exercise database for different workout types
const exerciseDatabase = {
  push: {
    mainLifts: ['Barbell Bench Press', 'Dumbbell Bench Press', 'Push-Ups', 'Dips'],
    accessories: ['Dumbbell Flyes', 'Overhead Press', 'Lateral Raises', 'Tricep Dips', 'Push-Ups', 'Chest Press'],
    warmup: ['Arm Circles', 'Push-up to T', 'Shoulder Rotations', 'Light Push-Ups', 'Chest Stretch'],
    cooldown: ['Chest Stretch', 'Shoulder Stretch', 'Tricep Stretch', 'Foam Roll Chest']
  },
  pull: {
    mainLifts: ['Barbell Rows', 'Pull-Ups', 'Lat Pulldowns', 'Dumbbell Rows'],
    accessories: ['Face Pulls', 'Bicep Curls', 'Hammer Curls', 'Preacher Curls', 'Cable Rows', 'Reverse Flyes'],
    warmup: ['Arm Circles', 'Shoulder Rotations', 'Light Rows', 'Back Stretch', 'Lat Pulldown Warmup'],
    cooldown: ['Back Stretch', 'Bicep Stretch', 'Shoulder Stretch', 'Foam Roll Back']
  },
  legs: {
    mainLifts: ['Barbell Squats', 'Deadlifts', 'Leg Press', 'Lunges'],
    accessories: ['Leg Extensions', 'Leg Curls', 'Calf Raises', 'Romanian Deadlifts', 'Split Squats', 'Glute Bridges'],
    warmup: ['Bodyweight Squats', 'Leg Swings', 'Hip Circles', 'Light Lunges', 'Quad Stretch'],
    cooldown: ['Quad Stretch', 'Hamstring Stretch', 'Calf Stretch', 'Foam Roll Legs']
  },
  upper: {
    mainLifts: ['Barbell Bench Press', 'Pull-Ups', 'Overhead Press', 'Barbell Rows'],
    accessories: ['Dumbbell Flyes', 'Lateral Raises', 'Bicep Curls', 'Tricep Dips', 'Face Pulls', 'Push-Ups'],
    warmup: ['Arm Circles', 'Shoulder Rotations', 'Light Push-Ups', 'Light Rows', 'Chest Stretch'],
    cooldown: ['Chest Stretch', 'Back Stretch', 'Shoulder Stretch', 'Bicep Stretch', 'Tricep Stretch']
  },
  lower: {
    mainLifts: ['Barbell Squats', 'Deadlifts', 'Leg Press', 'Lunges'],
    accessories: ['Leg Extensions', 'Leg Curls', 'Calf Raises', 'Romanian Deadlifts', 'Split Squats', 'Glute Bridges'],
    warmup: ['Bodyweight Squats', 'Leg Swings', 'Hip Circles', 'Light Lunges', 'Quad Stretch'],
    cooldown: ['Quad Stretch', 'Hamstring Stretch', 'Calf Stretch', 'Foam Roll Legs']
  },
  full_body: {
    mainLifts: ['Barbell Squats', 'Deadlifts', 'Bench Press', 'Pull-Ups'],
    accessories: ['Overhead Press', 'Rows', 'Lunges', 'Push-Ups', 'Planks', 'Calf Raises'],
    warmup: ['Bodyweight Squats', 'Arm Circles', 'Light Push-Ups', 'Light Rows', 'Full Body Stretch'],
    cooldown: ['Full Body Stretch', 'Foam Roll', 'Static Stretches', 'Deep Breathing']
  },
  hiit: {
    mainLifts: ['Burpees', 'Mountain Climbers', 'Jump Squats', 'High Knees'],
    accessories: ['Push-Ups', 'Planks', 'Jumping Jacks', 'Lunges', 'Mountain Climbers', 'Burpees'],
    warmup: ['Light Jogging', 'Arm Circles', 'Leg Swings', 'High Knees', 'Dynamic Stretches'],
    cooldown: ['Light Walking', 'Static Stretches', 'Deep Breathing', 'Foam Rolling']
  }
};

// Helper functions
function getRandomExercises(exercises: string[], count: number): any[] {
  const shuffled = [...exercises].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count).map(name => ({ name }));
}

function getMainLiftForType(type: string): string {
  const lifts = exerciseDatabase[type as keyof typeof exerciseDatabase]?.mainLifts || ['Bench Press'];
  return lifts[Math.floor(Math.random() * lifts.length)];
}

function generateWarmupExercises(type: string, count: number): any[] {
  const warmups = exerciseDatabase[type as keyof typeof exerciseDatabase]?.warmup || ['Arm Circles'];
  const exercises = getRandomExercises(warmups, count);
  return exercises.map(ex => ({
    name: ex.name,
    reps: Math.random() > 0.5 ? '10 each side' : '30 seconds'
  }));
}

function generateAccessoryExercises(type: string, count: number): any[] {
  const accessories = exerciseDatabase[type as keyof typeof exerciseDatabase]?.accessories || ['Push-Ups'];
  const exercises = getRandomExercises(accessories, count);
  return exercises.map(ex => ({
    name: ex.name,
    sets: 3,
    reps: Math.random() > 0.5 ? '12-15' : '10-12'
  }));
}

function generateCooldownExercises(type: string, count: number): any[] {
  const cooldowns = exerciseDatabase[type as keyof typeof exerciseDatabase]?.cooldown || ['Stretching'];
  const exercises = getRandomExercises(cooldowns, count);
  return exercises.map(ex => ({
    name: ex.name,
    duration: '30 seconds each side'
  }));
}

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('Received workout request:', body); // See what's being sent
    
    const { type, category, timeMinutes, userId } = body;
    
    if (!type || !timeMinutes) {
      return Response.json(
        { error: 'Missing required fields: type and timeMinutes' },
        { status: 400 }
      );
    }

    // Get user's available equipment
    let availableEquipment: string[] = [];
    let userEquipment: any = null;
    
    if (userId) {
      try {
        // Log equipment query
        console.log('Fetching equipment for user:', userId);
        const { data: equipmentData, error } = await supabase
          .from('user_equipment')
          .select('equipment_id, custom_name, equipment!inner(name)')
          .eq('user_id', userId);
          
        console.log('User equipment:', equipmentData);
        console.log('Equipment error:', error);
        
        userEquipment = equipmentData;
        availableEquipment = userEquipment?.map((eq: any) => 
          eq.custom_name || eq.equipment?.name || eq.equipment_id
        ).filter(Boolean) || [];
      } catch (error) {
        console.error('Error fetching user equipment:', error);
        // Continue without equipment filtering if there's an error
      }
    }

    // Time-based exercise counts
    const exerciseCounts = {
      15: { warmup: 2, mainSets: 3, accessories: 1, cooldown: 1 },
      30: { warmup: 2, mainSets: 4, accessories: 3, cooldown: 2 },
      45: { warmup: 3, mainSets: 4, accessories: 4, cooldown: 2 },
      60: { warmup: 3, mainSets: 5, accessories: 6, cooldown: 3 }
    };
    
    const counts = exerciseCounts[timeMinutes as keyof typeof exerciseCounts] || exerciseCounts[45];
    
    // When generating exercises, log what's happening
    console.log('Generating exercises for type:', type, 'category:', category);
    console.log('Available equipment:', availableEquipment);

    // Function to get exercises that match user's equipment
    async function getExercisesForType(targetMuscles: string[], count: number, phase: string) {
      // First try: get exercises user CAN do with their equipment
      let query = supabase
        .from('exercises')
        .select('*')
        .eq('exercise_phase', phase);
        
      // Add muscle targeting
      if (targetMuscles.length > 0) {
        query = query.or(
          `primary_muscle.in.(${targetMuscles.join(',')}),` +
          `target_muscles.cs.{${targetMuscles.join(',')}}`
        );
      }
      
      const { data: allExercises } = await query;
      
      // Filter by equipment
      const validExercises = allExercises?.filter((exercise: any) => {
        // Bodyweight exercises (no equipment) are always valid
        if (!exercise.equipment_required || exercise.equipment_required.length === 0) {
          return true;
        }
        // Check if user has required equipment
        return exercise.equipment_required.every((req: string) => 
          availableEquipment.some((avail: string) => 
            avail.toLowerCase().includes(req.toLowerCase()) ||
            req.toLowerCase().includes(avail.toLowerCase())
          )
        );
      }) || [];
      
      console.log(`Found ${validExercises.length} valid exercises for ${phase}`);
      
      // Randomly select requested count
      return validExercises
        .sort(() => Math.random() - 0.5)
        .slice(0, count);
    }

    // Helper function for muscle targeting
    function getTargetMuscles(type: string): string[] {
      const muscleMap: Record<string, string[]> = {
        // Split routines
        'push': ['chest', 'shoulders', 'triceps'],
        'pull': ['back', 'biceps', 'lats'],
        'legs': ['quads', 'hamstrings', 'glutes', 'calves'],
        'upper': ['chest', 'back', 'shoulders', 'biceps', 'triceps'],
        'lower': ['quads', 'hamstrings', 'glutes', 'calves'],
        'full_body': ['chest', 'back', 'legs', 'shoulders'],
        
        // Direct muscle groups
        'chest': ['chest', 'pectorals'],
        'back': ['back', 'lats', 'rhomboids'],
        'shoulders': ['shoulders', 'deltoids'],
        'arms': ['biceps', 'triceps'],
        'core': ['abs', 'obliques'],
        'biceps': ['biceps'],
        'triceps': ['triceps'],
        'glutes': ['glutes'],
        'calves': ['calves']
      };
      
      return muscleMap[type] || [type];
    }

    // Determine target muscles based on type
    const targetMuscles = getTargetMuscles(type);

    // Generate real workout

    const workout = {
      warmup: await getExercisesForType(['any'], counts.warmup, 'warmup'),
      mainLift: (await getExercisesForType(targetMuscles, 1, 'main'))[0] || 
        { name: `Bodyweight ${type} Exercise`, sets: counts.mainSets, reps: '8-12' },
      accessories: await getExercisesForType(targetMuscles, counts.accessories, 'accessory'),
      cooldown: await getExercisesForType(['any'], counts.cooldown, 'cooldown')
    };

    // Format the workout
    const formattedWorkout = {
      warmup: workout.warmup.map((ex: any) => ({
        name: ex.name,
        reps: ex.set_duration_seconds ? `${ex.set_duration_seconds}s` : '10-15'
      })),
      mainLift: {
        name: workout.mainLift.name,
        sets: counts.mainSets,
        reps: workout.mainLift.reps || '8-10',
        rest: '2-3 min'
      },
      accessories: workout.accessories.map((ex: any) => ({
        name: ex.name,
        sets: 3,
        reps: '10-15'
      })),
      cooldown: workout.cooldown.map((ex: any) => ({
        name: ex.name,
        duration: ex.set_duration_seconds ? `${ex.set_duration_seconds}s` : '30s'
      }))
    };

    return Response.json(formattedWorkout);
  } catch (error) {
    console.error('Error generating workout:', error);
    return Response.json(
      { error: 'Failed to generate workout' },
      { status: 500 }
    );
  }
}

// Equipment-aware helper functions
async function getExercisesForTypeWithEquipment(exerciseType: string, count: number, availableEquipment: string[]): Promise<any[]> {
  try {
    const { data: exercises } = await supabase
      .from('exercises')
      .select('*')
      .contains('target_muscles', [exerciseType])
      .or(`equipment_required.is.null,equipment_required.ov.{${availableEquipment.join(',')}}`);
    
    if (!exercises) return [];
    
    // Filter out exercises requiring equipment user doesn't have
    const validExercises = exercises.filter((ex: any) => {
      if (!ex.equipment_required || ex.equipment_required.length === 0) return true;
      return ex.equipment_required.every((req: string) => availableEquipment.includes(req));
    });
    
    // Shuffle and return requested count
    const shuffled = validExercises.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  } catch (error) {
    console.error('Error fetching exercises:', error);
    // Fallback to database exercises
    return getRandomExercises(exerciseDatabase[exerciseType as keyof typeof exerciseDatabase]?.mainLifts || ['Bench Press'], count);
  }
}

async function getMainLiftForTypeWithEquipment(type: string, availableEquipment: string[]): Promise<string> {
  const exercises = await getExercisesForTypeWithEquipment(type, 1, availableEquipment);
  return exercises.length > 0 ? (exercises[0] as any).name : getMainLiftForType(type);
}

async function generateWarmupExercisesWithEquipment(type: string, count: number, availableEquipment: string[]): Promise<any[]> {
  const exercises = await getExercisesForTypeWithEquipment(type, count, availableEquipment);
  return exercises.map(ex => ({
    name: ex.name,
    reps: Math.random() > 0.5 ? '10 each side' : '30 seconds'
  }));
}

async function generateAccessoryExercisesWithEquipment(type: string, count: number, availableEquipment: string[]): Promise<any[]> {
  const exercises = await getExercisesForTypeWithEquipment(type, count, availableEquipment);
  return exercises.map(ex => ({
    name: ex.name,
    sets: 3,
    reps: Math.random() > 0.5 ? '12-15' : '10-12'
  }));
}

async function generateCooldownExercisesWithEquipment(type: string, count: number, availableEquipment: string[]): Promise<any[]> {
  const exercises = await getExercisesForTypeWithEquipment(type, count, availableEquipment);
  return exercises.map(ex => ({
    name: ex.name,
    duration: '30 seconds each side'
  }));
} 