import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// PROPER MAIN LIFTS - These are true compound movements
const MAIN_LIFTS = {
  push: [
    'Barbell Bench Press',
    'Dumbbell Bench Press', 
    'Incline Barbell Press',
    'Incline Dumbbell Press',
    'Decline Barbell Press',
    'Decline Dumbbell Press'
  ],
  legs: [
    'Barbell Back Squat',
    'Barbell Front Squat',
    'Barbell Deadlift',
    'Trap Bar Deadlift',
    'Romanian Deadlift',
    'Sumo Deadlift'
  ],
  pull: [
    'Barbell Deadlift',
    'Barbell Bent-Over Row',
    'Pendlay Row',
    'T-Bar Row',
    'Weighted Pull-Up',
    'Rack Pulls'
  ],
  shoulders: [
    'Barbell Overhead Press',
    'Dumbbell Shoulder Press',
    'Military Press',
    'Push Press',
    'Arnold Press'
  ]
};

export async function POST(request: Request) {
  try {
    const { workoutType, timeAvailable } = await request.json();
    const supabase = createRouteHandlerClient({ cookies });
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Get user profile and equipment
    const [profileResult, equipmentResult, exercisesResult] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', user.id).single(),
      supabase.from('user_equipment')
        .select('equipment:equipment_id(name)')
        .eq('user_id', user.id)
        .eq('is_available', true),
      supabase.from('exercises').select('*')
    ]);

    const profile = profileResult.data;
    const userEquipment = equipmentResult.data?.map(eq => eq.equipment.name) || [];
    const exerciseDatabase = exercisesResult.data || [];

    // Build Claude prompt that uses DB as reference but applies logic
    const prompt = `
You are an elite strength coach creating a ${workoutType} workout.

CRITICAL RULES:
1. Main lifts MUST be compound barbell/dumbbell movements. NEVER use push-ups, dips, or bodyweight exercises as main lifts.
2. Valid main lifts are ONLY: Barbell/Dumbbell Bench Press (flat/incline/decline), Barbell/Front/Back Squat, Deadlift variations, Overhead/Shoulder Press, Bent-Over Row.

User Context:
- Available Equipment: ${userEquipment.join(', ')}
- Current Weight: ${profile?.current_weight || 185} lbs
- Goal Weight: ${profile?.goal_weight || 170} lbs
- Training Goal: ${profile?.training_goal || 'weight_loss with strength maintenance'}
- Time Available: ${timeAvailable} minutes

Exercise Database Reference (use as guide, not strict limitation):
${exerciseDatabase.filter(e => e.is_compound).map(e => `- ${e.name}: ${e.category}`).slice(0, 20).join('\n')}

Create a ${workoutType.toUpperCase()} workout following this structure:

For PUSH workout:
- Main Lift: MUST be a bench press or incline press variation (barbell or dumbbell)
- Accessories: Flyes, lateral raises, tricep work, etc.

For LEGS workout:
- Main Lift: MUST be squat or deadlift variation (barbell preferred)
- Accessories: Lunges, leg curls, calf raises, etc.

For PULL workout:
- Main Lift: MUST be deadlift or barbell row variation
- Accessories: Pull-ups, cable rows, bicep work, etc.

For UPPER BODY:
- Main Lifts (2): One pressing movement (bench/overhead) AND one pulling (row/deadlift)
- Accessories: Arms, shoulders, etc.

For FULL BODY:
- Main Lifts (2-3): Include squat/deadlift AND press variation
- Accessories: Compound movements for other muscle groups

For HIIT:
- Use explosive compound movements but shorter rest periods
- Can include: Thrusters, Clean & Press, Kettlebell Swings (these are acceptable for HIIT)

EQUIPMENT LOGIC:
- If user lacks barbell: Use dumbbell variations of main lifts
- If user lacks both: Suggest getting proper equipment, but provide dumbbell-based compound movements
- NEVER default to push-ups as a main lift

Return a JSON workout plan:
{
  "mainLift": "Exact exercise name with equipment",
  "secondaryLift": "If applicable (for upper/full body)",
  "accessories": ["exercise1", "exercise2", "exercise3", "exercise4"],
  "warmup": ["movement1", "movement2", "movement3"],
  "cooldown": ["stretch1", "stretch2", "stretch3"],
  "sets": {
    "mainLift": "4x6-8",
    "accessories": "3x10-12"
  },
  "restPeriods": {
    "mainLift": "3-4 minutes",
    "accessories": "60-90 seconds"
  },
  "notes": "Specific coaching cues for this workout"
}

IMPORTANT: Use your knowledge to select the BEST exercises for the user's goals, not just what's in the database. The database is reference only.`;

    // Call Claude for intelligent workout generation
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1500,
      temperature: 0.7,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    });

    const workoutPlan = JSON.parse(response.content[0].text);

    // Validate that main lift is actually a compound movement
    const validMainLifts = Object.values(MAIN_LIFTS).flat();
    if (!validMainLifts.some(lift => workoutPlan.mainLift?.includes(lift.split(' ')[1]))) {
      console.warn('⚠️ Claude selected invalid main lift:', workoutPlan.mainLift);
      // Force correction
      workoutPlan.mainLift = selectProperMainLift(workoutType, userEquipment);
    }

    // Store the workout session
    const { data: session } = await supabase
      .from('workout_sessions')
      .insert({
        user_id: user.id,
        date: new Date().toISOString().split('T')[0],
        workout_source: 'ai_generated',
        workout_name: `${workoutType} Workout`,
        workout_type: workoutType,
        planned_exercises: workoutPlan
      })
      .select()
      .single();

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      workout: workoutPlan
    });

  } catch (error) {
    console.error('Workout generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate workout' },
      { status: 500 }
    );
  }
}

// Fallback function to ensure proper main lift selection
function selectProperMainLift(workoutType: string, equipment: string[]): string {
  const hasBarbell = equipment.includes('Barbell');
  const hasDumbbells = equipment.includes('Dumbbells');
  const hasBench = equipment.includes('Bench');
  const hasSquatRack = equipment.includes('Squat Rack');

  switch(workoutType.toLowerCase()) {
    case 'push':
      if (hasBarbell && hasBench) return 'Barbell Bench Press';
      if (hasDumbbells && hasBench) return 'Dumbbell Bench Press';
      if (hasDumbbells) return 'Dumbbell Floor Press';
      return 'Get a barbell and bench for proper training';
    
    case 'legs':
      if (hasBarbell && hasSquatRack) return 'Barbell Back Squat';
      if (hasBarbell) return 'Barbell Deadlift';
      if (hasDumbbells) return 'Dumbbell Goblet Squat';
      return 'Get a barbell for proper leg training';
    
    case 'pull':
      if (hasBarbell) return 'Barbell Bent-Over Row';
      if (hasDumbbells) return 'Dumbbell Row';
      return 'Get weights for proper back training';
    
    case 'upper':
      if (hasBarbell && hasBench) return 'Barbell Bench Press';
      if (hasDumbbells) return 'Dumbbell Shoulder Press';
      return 'Get weights for proper upper body training';
    
    default:
      if (hasBarbell) return 'Barbell Deadlift';
      if (hasDumbbells) return 'Dumbbell Goblet Squat';
      return 'Get proper equipment for strength training';
  }
} 