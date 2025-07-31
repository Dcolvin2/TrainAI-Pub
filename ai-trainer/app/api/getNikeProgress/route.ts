import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';

interface GetNikeProgressRequest {
  userId: string;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { userId }: GetNikeProgressRequest = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Get current Nike workout progress
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('last_nike_workout')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching Nike progress:', error);
      return NextResponse.json({ 
        error: 'Failed to fetch workout progress' 
      }, { status: 500 });
    }

    const currentProgress = profile?.last_nike_workout ?? 0;

    return NextResponse.json({ 
      success: true, 
      currentProgress,
      nextWorkout: currentProgress + 1
    });

  } catch (error: any) {
    console.error('Get Nike progress error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 