import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    // Initialize Supabase inside the function, not at module level
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase environment variables');
      return NextResponse.json({ error: 'Database configuration error' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Get current workout session
    const { data: session, error: sessionError } = await supabase
      .from('workout_sessions')
      .select('*')
      .eq('user_id', userId)
      .is('completed_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (sessionError && sessionError.code !== 'PGRST116') {
      console.error('Session error:', sessionError);
      return NextResponse.json({ error: 'Failed to fetch current workout' }, { status: 500 });
    }

    // Get workout sets for the session
    let sets = [];
    if (session) {
      const { data: setsData, error: setsError } = await supabase
        .from('workout_sets')
        .select('*')
        .eq('session_id', session.id)
        .order('set_number', { ascending: true });

      if (setsError) {
        console.error('Sets error:', setsError);
        return NextResponse.json({ error: 'Failed to fetch workout sets' }, { status: 500 });
      }

      sets = setsData || [];
    }

    return NextResponse.json({ 
      session: session || null, 
      sets: sets 
    });
  } catch (error) {
    console.error('Current workout error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
} 