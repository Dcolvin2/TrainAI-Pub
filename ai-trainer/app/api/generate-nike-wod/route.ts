import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { claude } from '@/lib/claudeClient';

export async function POST(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { workoutNumber } = await request.json();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // Get user equipment
    const { data: userEquipment } = await supabase
      .from('user_equipment')
      .select('equipment:equipment_id(name)')
      .eq('user_id', user.id)
      .eq('is_available', true);

    const equipment = userEquipment?.map((eq: any) => eq.equipment.name) || [];

    // GET NIKE WORKOUT FROM YOUR nike_workouts TABLE
    const { data: nikeExercises, error } = await supabase
      .from('nike_workouts')
      .select('*')
      .eq('workout', workoutNumber);

    if (error) {
      console.error('Error fetching Nike workout:', error);
      return NextResponse.json({ error: 'Failed to fetch workout' }, { status: 500 });
    }

    if (!nikeExercises || nikeExercises.length === 0) {
      return NextResponse.json({ error: `Nike workout #${workoutNumber} not found` }, { status: 404 });
    }

    // Group exercises by phase
    const phases = {
      warmup: nikeExercises.filter(e => e.exercise_phase === 'warmup'),
      main: nikeExercises.filter(e => e.exercise_phase === 'main'),
      accessory: nikeExercises.filter(e => e.exercise_phase === 'accessory'),
      cooldown: nikeExercises.filter(e => e.exercise_phase === 'cooldown')
    };

    // Get the workout name (they all have the same workout_type for a given workout number)
    const workoutName = nikeExercises[0].workout_type;

    // Build prompt for Claude to adapt based on available equipment
    const prompt = `
You are adapting Nike Workout #${workoutNumber}: ${workoutName}

User Profile:
- Current weight: ${profile.current_weight} lbs
- Goal weight: ${profile.goal_weight} lbs
- Training goal: ${profile.training_goal || 'weight_loss'}
- Available equipment: ${equipment.join(', ')}

Original Nike Workout from database:
Warmup: ${phases.warmup.map(e => `${e.exercise} (${e.sets}x${e.reps})`).join(', ')}
Main: ${phases.main.map(e => `${e.exercise} (${e.sets}x${e.reps})`).join(', ')}
Accessory: ${phases.accessory.map(e => `${e.exercise} (${e.sets}x${e.reps})`).join(', ')}
Cooldown: ${phases.cooldown.map(e => `${e.exercise} (${e.sets}x${e.reps})`).join(', ')}

Instructions from database:
${nikeExercises.map(e => e.instructions ? `${e.exercise}: ${e.instructions}` : '').filter(Boolean).join('\n')}

IMPORTANT:
1. Use ONLY the user's available equipment
2. If an exercise requires equipment they don't have, substitute with a similar exercise
3. Keep the same workout structure and volume
4. Make instructions clear and concise

Return JSON:
{
  "workoutName": "${workoutName}",
  "workoutNumber": ${workoutNumber},
  "phases": {
    "warmup": [
      {"name": "Exercise", "sets": "2", "reps": "10", "instruction": "Brief instruction"}
    ],
    "main": [
      {"name": "Exercise", "sets": "3", "reps": "8", "instruction": "Brief instruction", "rest": "90s"}
    ],
    "accessory": [
      {"name": "Exercise", "sets": "3", "reps": "12", "instruction": "Brief instruction", "rest": "60s"}
    ],
    "cooldown": [
      {"name": "Exercise", "sets": "1", "duration": "30s", "instruction": "Brief instruction"}
    ]
  }
}`;

    // Call Claude to adapt the workout
    const response = await claude.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 2000,
      temperature: 0.7,
      messages: [{ role: "user", content: prompt }]
    });

    const content = response.content[0];
    const adaptedWorkout = JSON.parse(content.type === 'text' ? content.text : '{}');

    // Create workout session
    const { data: session } = await supabase
      .from('workout_sessions')
      .insert({
        user_id: user.id,
        date: new Date().toISOString().split('T')[0],
        workout_source: 'nike',
        nike_workout_number: workoutNumber,
        workout_name: workoutName,
        workout_type: workoutName,
        planned_exercises: adaptedWorkout
      })
      .select()
      .single();

    // Update last Nike workout in profile
    await supabase
      .from('profiles')
      .update({ last_nike_workout: workoutNumber })
      .eq('user_id', user.id);

    // Check for workout streak
    await supabase.rpc('update_workout_streak', { p_user_id: user.id });

    return NextResponse.json({
      sessionId: session.id,
      workoutNumber,
      workoutName,
      ...adaptedWorkout
    });

  } catch (error) {
    console.error('Nike WOD generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate Nike workout' },
      { status: 500 }
    );
  }
} 