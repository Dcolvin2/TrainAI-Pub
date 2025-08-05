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
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile and equipment
    const [profileResult, equipmentResult] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', user.id).single(),
      supabase.from('user_equipment')
        .select('equipment:equipment_id(name)')
        .eq('user_id', user.id)
        .eq('is_available', true)
    ]);

    const profile = profileResult.data;
    const equipment = equipmentResult.data?.map((eq: any) => eq.equipment.name) || [];

    // Determine workout number
    const targetWorkout = workoutNumber || ((profile?.last_nike_workout || 0) % 24) + 1;

    // Get Nike workout from database
    const { data: nikeExercises } = await supabase
      .from('nike_workouts')
      .select('*')
      .eq('workout', targetWorkout)
      .order('exercise_phase', { ascending: true });

    if (!nikeExercises?.length) {
      return NextResponse.json({ error: 'Nike workout not found' }, { status: 404 });
    }

    // Group exercises by phase
    const phases = {
      warmup: nikeExercises.filter(e => e.exercise_phase === 'warmup'),
      main: nikeExercises.filter(e => e.exercise_phase === 'main'),
      accessory: nikeExercises.filter(e => e.exercise_phase === 'accessory'),
      cooldown: nikeExercises.filter(e => e.exercise_phase === 'cooldown')
    };

    // Build Claude prompt to adapt workout
    const prompt = `You are an expert fitness coach adapting a Nike workout for a user.

User Profile:
- Current weight: ${profile.current_weight} lbs
- Goal weight: ${profile.goal_weight} lbs
- Goal: Weight loss while maintaining strength
- Available equipment: ${equipment.join(', ')}

Nike Workout #${targetWorkout}: ${nikeExercises[0].workout_type}

Original exercises by phase:
${JSON.stringify(phases, null, 2)}

Instructions:
1. Adapt each exercise to use ONLY the available equipment
2. If equipment is unavailable, substitute with similar exercises targeting the same muscles
3. Adjust sets/reps for weight loss (moderate weight, 12-15 reps for accessories)
4. Keep the same phase structure and exercise count
5. Make instructions clear and concise

Return a JSON object with this EXACT structure:
{
  "workoutName": "${nikeExercises[0].workout_type}",
  "workoutNumber": ${targetWorkout},
  "phases": {
    "warmup": [
      {
        "name": "Exercise Name",
        "sets": "2",
        "reps": "10",
        "duration": "30 seconds",
        "rest": 30,
        "instruction": "Clear instruction",
        "originalExercise": "Original name if substituted"
      }
    ],
    "main": [...],
    "accessory": [...],
    "cooldown": [...]
  }
}

ONLY return valid JSON, no markdown or explanations.`;

    // Call Claude
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
        nike_workout_number: targetWorkout,
        workout_name: adaptedWorkout.workoutName,
        planned_exercises: adaptedWorkout
      })
      .select()
      .single();

    // Update last Nike workout
    await supabase
      .from('profiles')
      .update({ last_nike_workout: targetWorkout })
      .eq('user_id', user.id);

    return NextResponse.json({
      sessionId: session.id,
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