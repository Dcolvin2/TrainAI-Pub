import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';

export async function POST(req: Request) {
  try {
    const supabase = getSupabase();
    const { sessionId, sets } = await req.json();

    if (!sessionId || !sets || !Array.isArray(sets)) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }

    // Save workout sets to Supabase
    const { data, error } = await supabase
      .from('workout_sets')
      .insert(sets.map(set => ({
        session_id: sessionId,
        exercise_name: set.exerciseName,
        set_number: set.setNumber,
        weight: set.weight,
        reps: set.reps,
        rpe: set.rpe || 7,
        rest_seconds: set.restSeconds || 90,
        created_at: new Date().toISOString()
      })))
      .select();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ 
        error: 'Failed to save workout sets', 
        details: error.message 
      }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Save workout sets error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 