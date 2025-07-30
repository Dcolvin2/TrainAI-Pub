import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(req: Request) {
  try {
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
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to save workout session'
    }, { status: 500 });
  }
} 