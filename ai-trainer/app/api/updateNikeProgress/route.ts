import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';

interface UpdateNikeProgressRequest {
  userId: string;
  workoutNumber: number;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
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

  } catch (error: any) {
    console.error('Update Nike progress error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 