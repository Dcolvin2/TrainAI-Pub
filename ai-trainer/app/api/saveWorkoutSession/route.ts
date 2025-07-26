import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { userId, logs, workoutData, completedAt } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Save workout session to Supabase
    const { data, error } = await supabase
      .from('workout_sessions')
      .insert({
        user_id: userId,
        logs: logs,
        workout_data: workoutData,
        completed_at: completedAt,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: 'Failed to save workout session' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Save workout session error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to save workout session'
    }, { status: 500 });
  }
} 