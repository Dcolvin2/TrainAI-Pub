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

    // Get user's last completed Flaherty workout
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('last_flaherty_workout')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: 'Failed to get Flaherty progress' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      lastWorkout: profile?.last_flaherty_workout || 0,
      nextWorkout: (profile?.last_flaherty_workout || 0) + 1
    });
  } catch (error) {
    console.error('Get Flaherty progress error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to get Flaherty progress'
    }, { status: 500 });
  }
} 