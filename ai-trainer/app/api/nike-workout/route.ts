import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Get user from request headers or session
    // For now, we'll assume the user is authenticated
    // You may need to adjust this based on your auth setup
    
    // Get user's last Nike workout number (for now, start with workout 1)
    const nextWorkout = 1;
    
    console.log('Fetching Nike workout #', nextWorkout);
    
    // Get Nike workout from database
    const { data: exercises, error } = await supabase
      .from('nike_workouts')
      .select('*')
      .eq('workout', nextWorkout)
      .order('exercise_phase');
    
    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    if (!exercises || exercises.length === 0) {
      return NextResponse.json({ 
        error: 'No exercises found',
        workout: nextWorkout 
      }, { status: 404 });
    }
    
    // Group by phase
    const grouped = {
      warmup: exercises.filter((e: any) => e.exercise_phase === 'warmup'),
      main: exercises.filter((e: any) => e.exercise_phase === 'main'),
      accessory: exercises.filter((e: any) => e.exercise_phase === 'accessory'),
      cooldown: exercises.filter((e: any) => e.exercise_phase === 'cooldown')
    };
    
    return NextResponse.json({
      workout_number: nextWorkout,
      workout_name: exercises[0].workout_type,
      total_exercises: exercises.length,
      exercises: grouped
    });
    
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown'
    }, { status: 500 });
  }
}

// GET method for testing
export async function GET() {
  return NextResponse.json({ 
    message: 'Nike workout endpoint is working. Use POST to get a workout.' 
  });
} 