// Exercise database for different workout types
const exerciseDatabase = {
  push: {
    mainLifts: ['Barbell Bench Press', 'Dumbbell Bench Press', 'Incline Barbell Press', 'Incline Dumbbell Press'],
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
  const accessories = exerciseDatabase[type as keyof typeof exerciseDatabase]?.accessories || ['Dumbbell Flyes'];
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
    console.log('🎯 Received workout request:', body);
    
    const { type, category, timeMinutes, userId } = body;
    
    if (!type || !timeMinutes) {
      return Response.json(
        { error: 'Missing required fields: type and timeMinutes' },
        { status: 400 }
      );
    }

    // Get user's available equipment
    const userEquip = await getUserEquipment(userId);
    console.log('📦 User equipment:', userEquip);

    // Build core lift pool
    const corePool = await buildCoreLiftPool(type, userEquip);
    console.log('💪 Core lift pool:', corePool);

    // pick strongest candidate (later: weight progression logic)
    const coreLift = corePool[0];

    console.log(`🎯 Selected core lift: ${coreLift.name}`);

    // Time-based exercise counts
    const exerciseCounts = {
      15: { warmup: 2, mainSets: 3, accessories: 1, cooldown: 1 },
      30: { warmup: 2, mainSets: 4, accessories: 3, cooldown: 2 },
      45: { warmup: 3, mainSets: 4, accessories: 4, cooldown: 2 },
      60: { warmup: 3, mainSets: 5, accessories: 6, cooldown: 3 }
    };
    
    const counts = exerciseCounts[timeMinutes as keyof typeof exerciseCounts] || exerciseCounts[45];

    // Get user profile for Claude prompt
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    // Build specific Claude prompt based on workout type
    const prompt = `
Generate a ${type} workout for a user with these constraints:

User Profile:
- Weight: ${profile?.current_weight || 185} lbs
- Goal: Weight loss (${profile?.goal_weight || 170} lbs target)
- Available equipment: ${userEquip.join(', ')}
- Time available: ${timeMinutes} minutes

CRITICAL RULES FOR ${type.toUpperCase()} WORKOUT:

${type === 'full' || type === 'full_body' ? `
FULL BODY WORKOUT REQUIREMENTS:
- Include 2-3 main compound lifts that hit different muscle groups
- MUST include: 
  1. A lower body compound (Squat or Deadlift variation)
  2. An upper body push (Bench Press or Overhead Press)
  3. An upper body pull (Row or Pull-up)
- Add 3-4 accessories that fill gaps
- Total: 6-8 exercises for full body coverage
` : ''}

${type === 'hiit' ? `
HIIT WORKOUT REQUIREMENTS:
- Include 4-6 explosive/dynamic exercises
- Mix upper body, lower body, and full body movements
- Exercises should be:
  1. Kettlebell Swings (if available)
  2. Thrusters or Clean & Press
  3. Box Jumps or Jump Squats
  4. Battle Ropes or Medicine Ball Slams
  5. Burpees or Mountain Climbers
- Short rest periods (30-45 seconds)
- Higher rep ranges (12-20) or time-based (30-45 seconds)
` : ''}

${type === 'legs' ? `
LEGS WORKOUT:
- Main lift MUST be Barbell Back Squat, Front Squat, or Deadlift
- Include 4-5 accessory exercises for quads, hamstrings, glutes, calves
` : ''}

${type === 'upper' ? `
UPPER BODY WORKOUT:
- Include 2 main lifts: 1 push (Bench/OHP) AND 1 pull (Row/Pull-up)
- Add accessories for chest, back, shoulders, arms
` : ''}

${type === 'push' ? `
PUSH WORKOUT:
- Main lift MUST be Barbell/Dumbbell Bench Press or Incline Press
- Include shoulder and tricep accessories
` : ''}

${type === 'pull' ? `
PULL WORKOUT:
- Main lift MUST be Deadlift or Barbell Row
- Include back and bicep accessories
` : ''}

Return JSON with this structure:
{
  "name": "${type} Workout",
  "type": "${type}",
  "mainExercises": [
    {
      "name": "Exercise Name",
      "sets": 4,
      "reps": "6-8",
      "rest": "3 min",
      "notes": "Primary compound movement"
    }
    // For Full Body: Include 2-3 main exercises
    // For HIIT: Include 4-6 exercises
  ],
  "accessories": [
    {
      "name": "Exercise Name",
      "sets": 3,
      "reps": "10-12",
      "rest": "90 sec"
    }
    // 3-5 accessory exercises
  ],
  "warmup": [
    {"name": "Dynamic movement", "sets": 2, "reps": "10"}
  ],
  "cooldown": [
    {"name": "Stretch", "duration": "30 sec"}
  ]
}

IMPORTANT: 
- Full Body needs multiple main exercises from different movement patterns
- HIIT needs explosive, varied exercises with shorter rest
- Never use Push-Ups as a main exercise
- If equipment is lacking, suggest equipment-appropriate alternatives`;

    // Call Claude for intelligent workout generation
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 2000,
        temperature: 0.7,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error('Failed to call Claude API');
    }

    const claudeResponse = await response.json();
    const workoutText = claudeResponse.content[0].type === 'text' ? claudeResponse.content[0].text : '';
    
    // Parse Claude's response
    let workout;
    try {
      // Extract JSON from response if Claude included it
      const jsonMatch = workoutText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        workout = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in Claude response');
      }
    } catch (e) {
      console.error('Failed to parse Claude response:', e);
      // Fallback to basic workout structure
      workout = {
        name: `${type} Workout`,
        type: type,
        mainExercises: [{ name: coreLift.name, sets: counts.mainSets, reps: "6-8", rest: "3 min" }],
        accessories: generateAccessoryExercises(type, counts.accessories),
        warmup: generateWarmupExercises(type, counts.warmup),
        cooldown: generateCooldownExercises(type, counts.cooldown)
      };
    }

    // Special handling for Full Body - ensure multiple main lifts
    if (type.toLowerCase() === 'full' || type.toLowerCase() === 'full_body') {
      if (!workout.mainExercises || workout.mainExercises.length < 2) {
        console.log('⚠️ Full Body workout needs multiple main lifts, adding...');
        workout.mainExercises = [
          { name: "Barbell Back Squat", sets: 4, reps: "6-8", rest: "3 min", notes: "Lower body compound" },
          { name: "Barbell Bench Press", sets: 4, reps: "6-8", rest: "3 min", notes: "Upper push compound" },
          { name: "Barbell Bent-Over Row", sets: 4, reps: "8-10", rest: "2-3 min", notes: "Upper pull compound" }
        ];
      }
    }
    
    // Special handling for HIIT - ensure variety
    if (type.toLowerCase() === 'hiit') {
      if (!workout.mainExercises || workout.mainExercises.length < 4) {
        console.log('⚠️ HIIT workout needs more variety, updating...');
        workout.mainExercises = [
          { name: "Kettlebell Swing", sets: 4, reps: "20", rest: "45 sec", notes: "Explosive hip hinge" },
          { name: "Dumbbell Thrusters", sets: 4, reps: "15", rest: "45 sec", notes: "Full body power" },
          { name: "Box Jump", sets: 4, reps: "10", rest: "45 sec", notes: "Explosive lower body" },
          { name: "Battle Rope Waves", sets: 4, reps: "30 sec", rest: "30 sec", notes: "Upper body endurance" }
        ];
        
        // Filter based on available equipment
        workout.mainExercises = workout.mainExercises.filter((ex: any) => {
          if (ex.name.includes('Kettlebell') && !userEquip.includes('Kettlebells')) return false;
          if (ex.name.includes('Box Jump') && !userEquip.includes('Plyo Box')) return false;
          if (ex.name.includes('Battle Rope') && !userEquip.includes('Battle Rope')) return false;
          return true;
        });
      }
    }

    // Fail-loud guardrail for bodyweight exercises
    if (workout.mainExercises) {
      workout.mainExercises = workout.mainExercises.map((ex: any) => {
        if (ex.name.toLowerCase().includes('push-up') || ex.name.toLowerCase().includes('dip')) {
          console.warn('⚠️ Bodyweight exercise detected in main lifts, replacing...');
          // Replace with appropriate compound movement based on type
          const replacements: Record<string, any> = {
            push: { name: "Barbell Bench Press", sets: 4, reps: "6-8", rest: "3 min" },
            pull: { name: "Barbell Bent-Over Row", sets: 4, reps: "8-10", rest: "2-3 min" },
            legs: { name: "Barbell Back Squat", sets: 4, reps: "6-8", rest: "3-4 min" },
            upper: { name: "Barbell Bench Press", sets: 4, reps: "6-8", rest: "3 min" },
            full_body: { name: "Barbell Deadlift", sets: 4, reps: "5-6", rest: "3-4 min" }
          };
          return replacements[type.toLowerCase()] || replacements.full_body;
        }
        return ex;
      });
    }

    console.table({ 
      focus: type, 
      minutes: timeMinutes, 
      equipment: userEquip, 
      mainExercises: workout.mainExercises?.map((ex: any) => ex.name) || [],
      accessoriesCount: workout.accessories?.length || 0
    });

    // Save workout session to database
    const { data: session } = await supabase
      .from('workout_sessions')
      .insert({
        user_id: userId,
        date: new Date().toISOString().split('T')[0],
        workout_source: 'ai_generated',
        workout_name: workout.name || `${type} Workout`,
        workout_type: type,
        planned_exercises: workout
      })
      .select()
      .single();

    console.log('✅ Workout session saved:', session?.id);

    // Return the workout with session ID
    return Response.json({
      ...workout,
      sessionId: session?.id
    });
  } catch (error) {
    console.error('❌ Error generating workout:', error);
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