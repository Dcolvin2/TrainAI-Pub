import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(request: Request) {
  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const { userId, messages } = await request.json();

    const userMessage = messages[messages.length - 1]?.content || 'Help me with my workout';

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      messages: [
        { role: 'user', content: `You are an expert fitness coach. Help with this workout question: ${userMessage}` }
      ]
    });

    const content = response.content[0];
    const text = content.type === 'text' ? content.text : 'No response';

    return NextResponse.json({ 
      content: text,
      model: 'claude-3-5-sonnet-20241022',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('WorkoutChat API error:', error);
    return NextResponse.json(
      { error: 'Failed to process workout chat' },
      { status: 500 }
    );
  }
} 