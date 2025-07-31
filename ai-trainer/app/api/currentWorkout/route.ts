import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';

export async function POST(req: Request) {
  try {
    const supabase = getSupabase();
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
  } catch (error: any) {
    console.error('Current workout error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 