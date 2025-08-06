// /app/api/generate-workout/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { claude } from '@/lib/claudeClient';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { workoutType, timeAvailable = 45 } = body;
    
    console.log('Received request:', { workoutType, timeAvailable });
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    // Get user from auth header or session
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // For now, we'll skip user authentication and just generate the workout
    // In production, you'd validate the JWT token here

    // Get user profile - only fields that exist
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('current_weight, goal_weight')
      .limit(1)
      .single();

    if (profileError) {
      console.error('Profile error:', profileError);
    }

    // Get user's equipment
    const { data: userEquipment, error: equipError } = await supabase
      .from('user_equipment')
      .select('equipment:equipment_id(name)')
      .eq('is_available', true);

    if (equipError) {
      console.error('Equipment error:', equipError);
    }

    const equipment = userEquipment?.map((eq: any) => eq.equipment.name) || [];

    // Get ALL exercises
    const { data: exercises, error: exerciseError } = await supabase
      .from('exercises')
      .select('name, category, primary_muscle, equipment_required, instruction, exercise_phase, rest_seconds_default, is_compound');

    if (exerciseError) {
      console.error('Exercise error:', exerciseError);
      return NextResponse.json({ error: 'Failed to fetch exercises' }, { status: 500 });
    }

    // Create dynamic prompt for Claude
    const prompt = `You are creating a ${timeAvailable}-minute ${workoutType} workout.

User's goal: ${profile?.current_weight || 185}lbs → ${profile?.goal_weight || 170}lbs (weight loss while maintaining muscle)
Available equipment: ${equipment.join(', ')}

Exercise database (${exercises.length} exercises available):
${JSON.stringify(exercises.slice(0, 50))} 
[... and ${exercises.length - 50} more exercises]

Create a dynamic ${workoutType} workout that:
1. Uses ONLY exercises from the database
2. Matches the user's available equipment
3. Optimizes for fat loss while maintaining muscle
4. Fits in ${timeAvailable} minutes

Return ONLY a JSON object with this structure:
{
  "warmup": ["Exercise Name 1", "Exercise Name 2", "Exercise Name 3"],
  "main": ["Exercise Name 1", "Exercise Name 2", "Exercise Name 3", "Exercise Name 4"],
  "accessories": ["Exercise Name 1", "Exercise Name 2"],
  "cooldown": ["Exercise Name 1", "Exercise Name 2", "Exercise Name 3"]
}

Be creative and vary the exercises. Use exact exercise names from the database.`;

    // Call Claude
    const response = await claude.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }]
    });

    // Parse response
    let workoutPlan;
    try {
      const content = response.content[0];
      const text = content.type === 'text' ? content.text : '';
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      workoutPlan = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    } catch (parseError) {
      console.error('Failed to parse Claude response:', response.content[0]);
      // Emergency fallback - just pick some exercises
      workoutPlan = {
        warmup: exercises.filter((e: any) => e.exercise_phase === 'warmup').slice(0, 3).map((e: any) => e.name),
        main: exercises.filter((e: any) => e.category === 'strength').slice(0, 4).map((e: any) => e.name),
        accessories: exercises.filter((e: any) => e.category === 'hypertrophy').slice(0, 2).map((e: any) => e.name),
        cooldown: exercises.filter((e: any) => e.exercise_phase === 'cooldown').slice(0, 3).map((e: any) => e.name)
      };
    }

    // Create workout session
    const { data: session, error: sessionError } = await supabase
      .from('workout_sessions')
      .insert({
        user_id: 'temp-user-id', // In production, get from auth
        workout_source: 'ai_generated',
        workout_type: workoutType,
        planned_exercises: workoutPlan,
        date: new Date().toISOString()
      })
      .select()
      .single();

    if (sessionError) {
      console.error('Session creation error:', sessionError);
      return NextResponse.json({ error: 'Failed to create workout session' }, { status: 500 });
    }

    return NextResponse.json({
      sessionId: session.id,
      ...workoutPlan
    });

  } catch (error: any) {
    console.error('Generate workout error:', error);
    return NextResponse.json(
      { error: 'Failed to generate workout', details: error.message },
      { status: 500 }
    );
  }
} 