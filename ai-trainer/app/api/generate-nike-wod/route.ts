import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { claude } from '@/lib/claudeClient';

export async function POST(request: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { workoutNumber } = await request.json();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Get user data
  const [profileResult, equipmentResult] = await Promise.all([
    supabase.from('profiles').select('*').eq('user_id', user.id).single(),
    supabase.from('user_equipment')
      .select('equipment:equipment_id(name)')
      .eq('user_id', user.id)
      .eq('is_available', true)
  ]);

  const profile = profileResult.data;
  const equipment = equipmentResult.data?.map((eq: any) => eq.equipment.name) || [];

  // Get Nike workout
  const { data: nikeExercises } = await supabase
    .from('nike_workouts')
    .select('*')
    .eq('workout', workoutNumber)
    .order('exercise_phase');

  if (!nikeExercises?.length) {
    return NextResponse.json({ error: 'Workout not found' }, { status: 404 });
  }

  // Group by phase
  const phases = {
    warmup: nikeExercises.filter(e => e.exercise_phase === 'warmup'),
    main: nikeExercises.filter(e => e.exercise_phase === 'main'),
    accessory: nikeExercises.filter(e => e.exercise_phase === 'accessory'),
    cooldown: nikeExercises.filter(e => e.exercise_phase === 'cooldown')
  };

  // Build prompt for Claude to adapt the workout
  const prompt = `Adapt this Nike workout for the user's available equipment.

User Profile:
- Weight: ${profile.current_weight} lbs → ${profile.goal_weight} lbs
- Equipment: ${equipment.join(', ')}

Nike Workout #${workoutNumber}: ${nikeExercises[0].workout_type}

Original Exercises:
${JSON.stringify(phases, null, 2)}

Rules:
1. Keep the same structure and exercise count
2. If equipment is missing, substitute with similar exercises
3. Adjust for weight loss goal (moderate weight, higher reps)
4. Make instructions clear and concise

Return JSON:
{
  "workoutName": "${nikeExercises[0].workout_type}",
  "workoutNumber": ${workoutNumber},
  "exercises": [
    {
      "name": "Exercise Name",
      "phase": "warmup|main|accessory|cooldown",
      "sets": 3,
      "reps": "12",
      "restSeconds": 60,
      "instruction": "Clear instruction",
      "originalExercise": "Name if substituted"
    }
  ]
}`;

  const response = await claude.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }]
  });

  const content = response.content[0];
  const adaptedWorkout = JSON.parse(content.type === 'text' ? content.text : '{}');

  // Create workout session
  const { data: session } = await supabase
    .from('workout_sessions')
    .insert({
      user_id: user.id,
      workout_source: 'nike',
      nike_workout_number: workoutNumber,
      workout_name: adaptedWorkout.workoutName,
      planned_exercises: adaptedWorkout
    })
    .select()
    .single();

  // Update last Nike workout
  await supabase
    .from('profiles')
    .update({ last_nike_workout: workoutNumber })
    .eq('user_id', user.id);

  return NextResponse.json({
    sessionId: session.id,
    ...adaptedWorkout
  });
} 