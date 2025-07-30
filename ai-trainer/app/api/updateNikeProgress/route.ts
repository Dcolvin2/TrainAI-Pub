import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Get user's current Nike workout progress
    const { data: profile, error: getError } = await supabase
      .from('profiles')
      .select('last_nike_workout')
      .eq('id', userId)
      .single();

    if (getError) {
      console.error('Supabase error getting profile:', getError);
      return NextResponse.json({ error: 'Failed to get Nike progress' }, { status: 500 });
    }

    const currentWorkout = profile?.last_nike_workout || 0;
    const nextWorkout = currentWorkout + 1;

    // Update user's Nike workout progress
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ last_nike_workout: nextWorkout })
      .eq('id', userId);

    if (updateError) {
      console.error('Supabase error updating profile:', updateError);
      return NextResponse.json({ error: 'Failed to update Nike progress' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      previousWorkout: currentWorkout,
      newWorkout: nextWorkout
    });
  } catch (error) {
    console.error('Update Nike progress error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to update Nike progress'
    }, { status: 500 });
  }
} 