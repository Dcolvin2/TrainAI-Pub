import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(request: Request) {
  try {
    const { message } = await request.json();
    
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({
        response: 'Error: Claude API key is not configured'
      });
    }
    
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    
    const completion = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      system: 'You are a helpful fitness coach AI assistant. Be friendly, knowledgeable, and concise about workouts and fitness.',
      messages: [{
        role: 'user',
        content: message
      }]
    });
    
    const content = completion.content[0];
    const responseText = content.type === 'text' ? content.text : 'Sorry, I received an unexpected response format.';
    
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