import { NextRequest, NextResponse } from 'next/server';

interface UpdateNikeProgressRequest {
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

    const { userId, workoutNumber }: UpdateNikeProgressRequest = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    if (!workoutNumber) {
      return NextResponse.json({ error: 'Workout number is required' }, { status: 400 });
    }

    // Update Nike workout progress
    const { error } = await supabase
      .from('profiles')
      .update({ last_nike_workout: workoutNumber })
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating Nike progress:', error);
      return NextResponse.json({ 
        error: 'Failed to update workout progress' 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Nike Workout progress updated to ${workoutNumber}`,
      newProgress: workoutNumber
    });

  } catch (error) {
    console.error('Update Nike progress error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
} 