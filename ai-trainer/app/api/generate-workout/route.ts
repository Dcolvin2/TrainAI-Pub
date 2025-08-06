import { createClient } from '@supabase/supabase-js';
import { buildCoreLiftPool } from '@/lib/buildCoreLiftPool';
import { getUserEquipment } from '@/lib/getUserEquipment';
import { generateDynamicWarmup } from '@/lib/warmupGenerator';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Exercise database for different workout types
const exerciseDatabase = {
  push: {
    mainLifts: ['Barbell Bench Press', 'Dumbbell Bench Press', 'Barbell Overhead Press', 'Dumbbell Shoulder Press', 'Barbell Incline Press', 'Dumbbell Incline Press'],
    accessories: ['Dumbbell Flyes', 'Lateral Raises', 'Tricep Dips', 'Push-Ups', 'Chest Press', 'Overhead Tricep Extension'],
    warmup: ['Arm Circles', 'Push-up to T', 'Shoulder Rotations', 'Light Push-Ups', 'Chest Stretch'],
    cooldown: ['Chest Stretch', 'Shoulder Stretch', 'Tricep Stretch', 'Foam Roll Chest']
  },
  pull: {
    mainLifts: ['Barbell Bent-Over Row', 'Pull-Ups', 'Dumbbell Row', 'Cable Row', 'Barbell Deadlift', 'Barbell Upright Row'],
    accessories: ['Face Pulls', 'Bicep Curls', 'Hammer Curls', 'Preacher Curls', 'Reverse Flyes', 'Lat Pulldowns'],
    warmup: ['Arm Circles', 'Shoulder Rotations', 'Light Rows', 'Back Stretch', 'Lat Pulldown Warmup'],
    cooldown: ['Back Stretch', 'Bicep Stretch', 'Shoulder Stretch', 'Foam Roll Back']
  },
  legs: {
    mainLifts: ['Barbell Back Squat', 'Barbell Deadlift', 'Barbell Front Squat', 'Dumbbell Goblet Squat', 'Dumbbell Split Squat', 'Romanian Deadlift'],
    accessories: ['Leg Extensions', 'Leg Curls', 'Calf Raises', 'Split Squats', 'Glute Bridges', 'Lunges'],
    warmup: ['Bodyweight Squats', 'Leg Swings', 'Hip Circles', 'Light Lunges', 'Quad Stretch'],
    cooldown: ['Quad Stretch', 'Hamstring Stretch', 'Calf Stretch', 'Foam Roll Legs']
  },
  upper: {
    mainLifts: ['Barbell Overhead Press', 'Dumbbell Shoulder Press', 'Barbell Bench Press', 'Dumbbell Bench Press', 'Pull-Ups', 'Barbell Bent-Over Row'],
    accessories: ['Dumbbell Flyes', 'Lateral Raises', 'Bicep Curls', 'Tricep Dips', 'Face Pulls', 'Push-Ups'],
    warmup: ['Arm Circles', 'Shoulder Rotations', 'Light Push-Ups', 'Light Rows', 'Chest Stretch'],
    cooldown: ['Chest Stretch', 'Back Stretch', 'Shoulder Stretch', 'Bicep Stretch', 'Tricep Stretch']
  },
  full_body: {
    mainLifts: ['Barbell Deadlift', 'Barbell Clean and Press', 'Dumbbell Thrusters', 'Barbell Squat', 'Kettlebell Swing'],
    accessories: ['Overhead Press', 'Rows', 'Lunges', 'Push-Ups', 'Planks', 'Calf Raises'],
    warmup: ['Bodyweight Squats', 'Arm Circles', 'Light Push-Ups', 'Light Rows', 'Full Body Stretch'],
    cooldown: ['Full Body Stretch', 'Foam Roll', 'Static Stretches', 'Deep Breathing']
  },
  hiit: {
    mainLifts: ['Kettlebell Swing', 'Box Jump', 'Battle Rope Waves', 'Medicine Ball Slam', 'Burpee'],
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
  const lifts = exerciseDatabase[type as keyof typeof exerciseDatabase]?.mainLifts || ['Dumbbell Bench Press'];
  return lifts[Math.floor(Math.random() * lifts.length)];
}

async function generateExercisesWithClaude(workoutType: string, equipment: string[], exerciseType: 'mainLifts' | 'accessories' | 'warmup' | 'cooldown', count: number): Promise<any[]> {
  try {
    const prompt = `Generate ${count} ${exerciseType} exercises for a ${workoutType} workout. 
    
Available equipment: ${equipment.join(', ')}
Exercise type: ${exerciseType}

Requirements:
- ${exerciseType === 'mainLifts' ? 'These should be compound movements that can be the primary focus of the workout (e.g., Bench Press, Squats, Deadlifts, Pull-ups)' : ''}
- ${exerciseType === 'accessories' ? 'These should be isolation or secondary movements to complement the main lifts' : ''}
- ${exerciseType === 'warmup' ? 'These should be light movements to prepare the body for the workout' : ''}
- ${exerciseType === 'cooldown' ? 'These should be stretching or recovery movements' : ''}
- Use only equipment that is available
- Return as a JSON array of exercise names

Example response: ["Exercise 1", "Exercise 2", "Exercise 3"]`;

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 500,
      temperature: 0.7,
      messages: [{ role: "user", content: prompt }]
    });

    const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
    const exercises = JSON.parse(responseText);
    
    return exercises.map((name: string) => ({ name }));
  } catch (error) {
    console.error('Claude exercise generation error:', error);
    // Fallback to database exercises
    const exercises = exerciseDatabase[workoutType as keyof typeof exerciseDatabase]?.[exerciseType] || [];
    return getRandomExercises(exercises, count);
  }
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('Received workout request:', body);
    
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

    // Ensure we never use push-ups as a main lift
    if (coreLift.name.toLowerCase().includes('push-up') || coreLift.name.toLowerCase().includes('pushup')) {
      console.warn('⚠️  Push-up detected as main lift, replacing with proper compound movement');
      const fallbackLifts = {
        push: 'Dumbbell Bench Press',
        pull: 'Dumbbell Row',
        legs: 'Dumbbell Goblet Squat',
        upper: 'Dumbbell Shoulder Press',
        full: 'Dumbbell Thrusters',
        hiit: 'Burpee'
      };
      coreLift.name = fallbackLifts[type as keyof typeof fallbackLifts] || 'Dumbbell Bench Press';
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
    
    // Generate the workout with Claude for better exercise selection
    const warmup = generateDynamicWarmup(type, []);
    const accessories = await generateExercisesWithClaude(type, userEquip, 'accessories', counts.accessories);
    const cooldown = await generateExercisesWithClaude(type, userEquip, 'cooldown', counts.cooldown);
    
    const workout = {
      warmup,
      mainLift: { 
        name: coreLift.name, 
        sets: counts.mainSets, 
        reps: "8-10", 
        rest: "2-3 min" 
      },
      accessories,
      cooldown
    };

    console.table({ 
      focus: type, 
      minutes: timeMinutes, 
      equipment: userEquip, 
      coreLiftCandidates: corePool.map(lift => lift.name), 
      accessoriesPool: workout.accessories.map(acc => acc.name) 
    });

    return Response.json(workout);
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