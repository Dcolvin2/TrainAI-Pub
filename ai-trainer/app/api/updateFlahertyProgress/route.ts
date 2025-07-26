import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Get current Flaherty progress
    const { data: profile } = await supabase
      .from('profiles')
      .select('last_flaherty_workout')
      .eq('id', userId)
      .single();

    const currentWorkout = profile?.last_flaherty_workout || 0;
    const nextWorkout = currentWorkout + 1;

    // Update the user's Flaherty progress
    const { data, error } = await supabase
      .from('profiles')
      .update({ last_flaherty_workout: nextWorkout })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: 'Failed to update Flaherty progress' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      data,
      previousWorkout: currentWorkout,
      nextWorkout: nextWorkout
    });
  } catch (error) {
    console.error('Update Flaherty progress error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to update Flaherty progress'
    }, { status: 500 });
  }
} 