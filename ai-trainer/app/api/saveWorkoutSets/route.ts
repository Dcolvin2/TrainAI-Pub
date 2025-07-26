import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { userId, sessionId, sets } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    if (!sets || !Array.isArray(sets)) {
      return NextResponse.json({ error: 'Sets array is required' }, { status: 400 });
    }

    // Prepare sets data for insertion
    const setsData = sets.map(set => ({
      user_id: userId,
      session_id: sessionId,
      exercise_name: set.exerciseName,
      set_number: set.setNumber,
      previous_weight: set.previousWeight,
      previous_reps: set.previousReps,
      prescribed_weight: set.prescribedWeight,
      prescribed_reps: set.prescribedReps,
      actual_weight: set.actualWeight,
      actual_reps: set.actualReps,
      completed: set.completed,
      rest_seconds: set.restSeconds,
      section: set.section,
      created_at: new Date().toISOString()
    }));

    const { data, error } = await supabase
      .from('workout_sets')
      .insert(setsData)
      .select();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: 'Failed to save workout sets' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Save workout sets error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to save workout sets'
    }, { status: 500 });
  }
} 