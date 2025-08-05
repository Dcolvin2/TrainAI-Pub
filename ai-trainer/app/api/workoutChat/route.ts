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
    const { messages } = await request.json();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user context
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    const { data: equipment } = await supabase
      .from('user_equipment')
      .select('equipment:equipment_id(name)')
      .eq('user_id', user.id)
      .eq('is_available', true);

    const availableEquipment = equipment?.map((eq: any) => eq.equipment.name) || [];

    // Build conversation with context
    const systemPrompt = `You are a knowledgeable fitness coach assistant. 
User Profile: ${profile.current_weight}lbs, goal: ${profile.goal_weight}lbs
Available equipment: ${availableEquipment.join(', ')}
Be helpful, concise, and friendly. If asked to create a workout, provide specific exercises with sets/reps.`;

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      temperature: 0.7,
      system: systemPrompt,
      messages: messages
    });

    const content = response.content[0];
    return NextResponse.json({
      response: content.type === 'text' ? content.text : 'I can help you with your workout!'
    });

  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat' },
      { status: 500 }
    );
  }
} 