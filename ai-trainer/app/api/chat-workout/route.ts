import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    const { message, conversationHistory = [] } = await request.json();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [profileResult, equipmentResult, exercisesResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single(),
      supabase
        .from('user_equipment')
        .select('equipment:equipment_id(name)')
        .eq('user_id', user.id)
        .eq('is_available', true),
      supabase
        .from('exercises')
        .select('*')
    ]);

    const profile = profileResult.data as any;
    const equipment = (equipmentResult.data || []).map((e: any) => e.equipment?.name).filter(Boolean) as string[];
    const exercises = (exercisesResult.data as any[]) || [];

    const allowedExercises = exercises.filter((ex: any) => {
      const required: string[] = ex.equipment_required || [];
      if (required.length === 0) return true;
      return required.every((item: string) => equipment.includes(item));
    });

    const prompt = `You are an elite fitness coach having a conversation about workout planning.

USER PROFILE:
- Current: ${profile?.current_weight || 185} lbs, Goal: ${profile?.goal_weight || 170} lbs
- Training goal: ${profile?.training_goal || 'strength'}
- Time available: ${profile?.preferred_workout_duration || 45} minutes

AVAILABLE EQUIPMENT:
${equipment.join(', ') || 'Bodyweight only'}

USER MESSAGE: "${message}"

${conversationHistory.length > 0 ? `PREVIOUS CONTEXT: User previously said: "${conversationHistory[conversationHistory.length - 1]}"` : ''}

INSTRUCTIONS:
1. Respond conversationally to their request
2. If they ask for a workout, provide a complete structured plan
3. Use ONLY equipment from their available list
4. If they provide feedback (like "you didn't use barbell"), acknowledge and adjust
5. Format workouts with clear time blocks, exercises, sets, reps, and weights

Provide your response in this format:
- First, a conversational response
- Then, if generating a workout, include the structured plan with specific exercises, sets, reps, and rest periods`;

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    const ai = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 3000,
      temperature: 0.7,
      messages: [{ role: 'user', content: prompt }]
    });

    const content = ai.content?.[0];
    const aiResponse = content && content.type === 'text' ? content.text : '';

    const hasWorkout = /\bsets?\b|\b0:00\b|\bBlock\b/i.test(aiResponse);

    let sessionId: string | null = null;
    if (hasWorkout) {
      const { data: session } = await supabase
        .from('workout_sessions')
        .insert({
          user_id: user.id,
          workout_source: 'chat',
          workout_name: 'Chat Generated Workout',
          chat_context: { message, conversationHistory, allowedExercisesCount: allowedExercises.length }
        })
        .select()
        .single();
      sessionId = (session as any)?.id ?? null;
    }

    return NextResponse.json({
      success: true,
      response: aiResponse,
      hasWorkout,
      sessionId,
      conversationHistory: [...conversationHistory, message]
    });
  } catch (error) {
    console.error('chat-workout error:', error);
    return NextResponse.json({ error: 'Failed to generate workout' }, { status: 500 });
  }
}


