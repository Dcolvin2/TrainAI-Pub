import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    // Initialize Supabase inside the function using dynamic import
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase environment variables');
      return NextResponse.json({ error: 'Database configuration error' }, { status: 500 });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { userId, sessionId, workoutData, completedAt, totalSets, completedSets } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Save workout session to Supabase
    const { data, error } = await supabase
      .from('workout_sessions')
      .insert({
        id: sessionId,
        user_id: userId,
        workout_data: workoutData,
        completed_at: completedAt,
        total_sets: totalSets || 0,
        completed_sets: completedSets || 0,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ 
        error: 'Failed to save workout session', 
        details: error.message,
        code: error.code 
      }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Save workout session error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
} 