import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function POST(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { message, context, sessionId } = await request.json();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // Get user equipment
    const { data: userEquipment } = await supabase
      .from('user_equipment')
      .select('equipment:equipment_id(name)')
      .eq('user_id', user.id)
      .eq('is_available', true);

    const equipment = userEquipment?.map((eq: any) => eq.equipment.name) || [];

    // Check for Nike workout request
    if (message.toLowerCase().includes('nike')) {
      const nextNum = ((profile?.last_nike_workout || 0) % 24) + 1;
      
      const { data: workouts } = await supabase
        .from('nike_workouts')
        .select('workout, workout_type')
        .gte('workout', nextNum)
        .lte('workout', Math.min(nextNum + 4, 24))
        .order('workout');

      const uniqueWorkouts = Array.from(
        new Map(workouts?.map((w: any) => [w.workout, w])).values()
      );

      return NextResponse.json({
        type: 'nike_list',
        message: `Here are your upcoming Nike workouts (currently on #${nextNum}):`,
        workouts: uniqueWorkouts.map((w: any) => ({
          number: w.workout,
          name: w.workout_type,
          isCurrent: w.workout === nextNum
        }))
      });
    }

    // For ALL other messages, call Claude
    const prompt = `
You are a helpful fitness assistant. The user said: "${message}"

Context:
- User has access to: ${equipment.join(', ')}
- Current weight: ${profile?.current_weight || 'unknown'} lbs
- Goal weight: ${profile?.goal_weight || 'unknown'} lbs
- Training goal: ${profile?.training_goal || 'general fitness'}

${sessionId ? `They have an active workout session.` : ''}

If they're asking about workouts, provide helpful suggestions.
If they're asking general questions, answer them naturally.
If they want to modify a workout, suggest specific changes.

Keep responses concise and helpful.`;

    // Call Claude
    const claudeResponse = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1000,
      temperature: 0.7,
      messages: [
        { 
          role: "user", 
          content: prompt 
        }
      ]
    });

    const responseText = claudeResponse.content[0].type === 'text' 
      ? claudeResponse.content[0].text 
      : 'I can help you with your workout!';

    // Log the chat
    if (sessionId) {
      await supabase
        .from('workout_chat_log')
        .insert({
          workout_session_id: sessionId,
          user_message: message,
          ai_response: responseText
        });
    }

    return NextResponse.json({
      type: 'assistant',
      message: responseText
    });

  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json({
      type: 'error',
      message: 'I had trouble processing that. Could you try rephrasing?'
    });
  }
} 