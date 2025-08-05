import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(request: Request) {
  try {
    const { message } = await request.json();
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    // Get user context if available
    let userContext = '';
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();
          
        if (profile) {
          userContext = `\nUser info: ${profile.current_weight}lbs, goal: ${profile.goal_weight}lbs`;
        }
      }
    } catch (e) {
      // User not logged in, that's ok
    }
    
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });
    
    const systemPrompt = `You are a helpful fitness coach AI assistant. Be friendly, knowledgeable, and concise.${userContext}`;
    
    const completion = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: message
      }]
    });
    
    const content = completion.content[0];
    const responseText = content.type === 'text' ? content.text : 'No text response received';
    
    return NextResponse.json({
      response: responseText
    });
    
  } catch (error: any) {
    console.error('Chat error:', error);
    return NextResponse.json({
      response: `Error: ${error.message || 'Failed to process message'}`
    });
  }
} 