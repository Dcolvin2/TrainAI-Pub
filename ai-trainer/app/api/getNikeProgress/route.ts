import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Get user's last completed Nike workout
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('last_nike_workout')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: 'Failed to get Nike progress' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      lastWorkout: profile?.last_nike_workout || 0,
      nextWorkout: (profile?.last_nike_workout || 0) + 1
    });
  } catch (error) {
    console.error('Get Nike progress error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to get Nike progress'
    }, { status: 500 });
  }
} 