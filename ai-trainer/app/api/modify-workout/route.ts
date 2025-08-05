import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { claude } from '@/lib/claudeClient';

export async function POST(request: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { modification, sessionId } = await request.json();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Get current workout
  const { data: currentWorkout } = await supabase
    .from('workout_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (!currentWorkout) {
    return NextResponse.json({ error: 'Workout session not found' }, { status: 404 });
  }

  // Build modification prompt
  const prompt = `
Current workout: ${JSON.stringify(currentWorkout)}
User request: ${modification}

Modify the workout according to the user's request. 
If they ask to "add accessory exercises", add 2-3 appropriate accessories.
Return the complete modified workout in the same format.
`;

  try {
    const response = await claude.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }]
    });

    const content = response.content[0];
    const modifiedWorkout = JSON.parse(content.type === 'text' ? content.text : '{}');

    // Update the workout session
    await supabase
      .from('workout_sessions')
      .update({ 
        planned_exercises: modifiedWorkout,
        updated_at: new Date().toISOString() 
      })
      .eq('id', sessionId);

    // Log the chat interaction
    await supabase
      .from('workout_chat_log')
      .insert({
        workout_session_id: sessionId,
        user_message: modification,
        ai_response: JSON.stringify(modifiedWorkout)
      });

    return NextResponse.json(modifiedWorkout);
  } catch (error) {
    console.error('Error modifying workout:', error);
    return NextResponse.json(
      { error: 'Failed to modify workout' },
      { status: 500 }
    );
  }
} 