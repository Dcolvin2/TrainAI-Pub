import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    // Use the same pattern as supabaseClient.ts
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
    const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY) as string;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
    
    // For now, we'll start with workout 1 (you can add user tracking later)
    const nextWorkout = 1;
    
    console.log('Fetching Nike workout #', nextWorkout);
    
    // First, let's check if the nike_workouts table exists
    const { data: tableCheck, error: tableError } = await supabase
      .from('nike_workouts')
      .select('count')
      .limit(1);
    
    if (tableError) {
      console.error('Table access error:', tableError);
      return NextResponse.json({ 
        error: 'Database table not accessible',
        details: tableError.message,
        suggestion: 'Check if nike_workouts table exists and RLS policies are set up'
      }, { status: 500 });
    }
    
    // Get Nike workout from database
    const { data: exercises, error } = await supabase
      .from('nike_workouts')
      .select('*')
      .eq('workout', nextWorkout)
      .order('exercise_phase');
    
    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ 
        error: 'Failed to fetch Nike workout',
        details: error.message 
      }, { status: 500 });
    }
    
    if (!exercises || exercises.length === 0) {
      return NextResponse.json({ 
        error: 'No Nike workout found',
        workout: nextWorkout,
        suggestion: 'Check if Nike workout data exists in the database'
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