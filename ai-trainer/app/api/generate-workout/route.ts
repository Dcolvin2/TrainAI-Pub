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
import { buildCoreLiftPool } from '@/lib/buildCoreLiftPool';
import { getUserEquipment } from '@/lib/getUserEquipment';

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
    const userEquip = await getUserEquipment(userId);
    console.log('User equipment:', userEquip);

    // Build core lift pool
    const corePool = await buildCoreLiftPool(type, userEquip);
    console.log('Core lift pool:', corePool);

    // pick strongest candidate (later: weight progression logic)
    const coreLift = corePool[0];

    // Fail-loud guardrail
    if (coreLift.name === 'Push-up') {
      console.warn('⚠️  Fallback core-lift used – user lacks equipment for focus:', type);
    }

    console.log(`[generate-workout] Selected core lift: ${coreLift.name}`);

    // Time-based exercise counts
    const exerciseCounts = {
      15: { warmup: 2, mainSets: 3, accessories: 1, cooldown: 1 },
      30: { warmup: 2, mainSets: 4, accessories: 3, cooldown: 2 },
      45: { warmup: 3, mainSets: 4, accessories: 4, cooldown: 2 },
      60: { warmup: 3, mainSets: 5, accessories: 6, cooldown: 3 }
    };
    
    const counts = exerciseCounts[timeMinutes as keyof typeof exerciseCounts] || exerciseCounts[45];
    
    // Generate the workout
    const workout = {
      warmup: generateWarmupExercises(type, counts.warmup),
      mainLift: { 
        name: coreLift.name, 
        sets: counts.mainSets, 
        reps: "8-10", 
        rest: "2-3 min" 
      },
      accessories: generateAccessoryExercises(type, counts.accessories),
      cooldown: generateCooldownExercises(type, counts.cooldown)
    };

    console.table({ 
      focus: type, 
      minutes: timeMinutes, 
      equipment: userEquip, 
      coreLiftCandidates: corePool.map(lift => lift.name), 
      accessoriesPool: workout.accessories.map(acc => acc.name) 
    });

    // Add debugging console.log
    console.log('API returning:', {
      warmup: workout.warmup,
      main: workout.mainLift,
      accessories: workout.accessories,
      cooldown: workout.cooldown
    });

    return Response.json({
      name: `${type.toUpperCase()} Workout`,
      warmup: workout.warmup || [],
      main: [workout.mainLift] || [],
      accessories: workout.accessories || [],
      cooldown: workout.cooldown || []
    });
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