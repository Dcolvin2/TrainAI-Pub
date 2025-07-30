import { NextRequest, NextResponse } from 'next/server';

interface GetNikeProgressRequest {
  userId: string;
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

  } catch (error) {
    console.error('Get Nike progress error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
} 