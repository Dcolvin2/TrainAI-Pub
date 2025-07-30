import { NextRequest, NextResponse } from 'next/server';

interface FinishNikeWorkoutRequest {
  userId: string;
  workoutNumber: number;
}

export async function POST(req: NextRequest) {
  try {
    // Initialize Supabase inside the function using dynamic import
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { userId, workoutNumber }: FinishNikeWorkoutRequest = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    if (!workoutNumber) {
      return NextResponse.json({ error: 'Workout number is required' }, { status: 400 });
    }

    // Get current progress
    const { data: profile } = await supabase
      .from('profiles')
      .select('last_nike_workout')
      .eq('user_id', userId)
      .single();

    const currentProgress = profile?.last_nike_workout ?? 0;

    // Only update if this workout number >= current progress
    if (workoutNumber >= currentProgress) {
      const { error } = await supabase
        .from('profiles')
        .update({ last_nike_workout: workoutNumber })
        .eq('user_id', userId);

      if (error) {
        console.error('Error updating Nike workout progress:', error);
        return NextResponse.json({ 
          error: 'Failed to update workout progress' 
        }, { status: 500 });
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Nike Workout ${workoutNumber} completed!`,
      newProgress: workoutNumber >= currentProgress ? workoutNumber : currentProgress
    });

  } catch (error) {
    console.error('Finish Nike workout error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
} 