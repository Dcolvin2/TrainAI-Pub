import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(request: Request) {
  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const { messages, detailLevel = 'concise' } = await request.json();

    const userMessage = messages[messages.length - 1]?.content || 'Help me with my workout';

    // Define system prompts based on detail level
    const systemPrompts = {
      concise: `You are a concise fitness coach. Be direct and brief. Use bullet points. Limit responses to 120 words. Format as: brief answer, numbered steps (max 4), key tip. Avoid lengthy explanations unless specifically requested.`,
      standard: `You are a fitness coach. Provide clear, actionable advice. Use bullet points for lists. Keep responses under 250 words unless detailed explanation is needed.`,
      detailed: `You are a fitness coach. Provide comprehensive advice when requested. Use clear formatting with bullet points and numbered lists.`
    };

    const systemPrompt = systemPrompts[detailLevel as keyof typeof systemPrompts] || systemPrompts.concise;

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: detailLevel === 'concise' ? 400 : detailLevel === 'standard' ? 600 : 800,
      messages: [
        { role: 'user', content: `${systemPrompt}\n\nHelp with this workout question: ${userMessage}` }
      ]
    });

    const content = response.content[0];
    const text = content.type === 'text' ? content.text : 'No response';

    return NextResponse.json({ 
      assistantMessage: text,
      model: 'claude-3-5-sonnet-20241022',
      timestamp: new Date().toISOString(),
      detailLevel
    });
  } catch (error) {
    console.error('WorkoutChat API error:', error);
    return NextResponse.json(
      { error: 'Failed to process workout chat' },
      { status: 500 }
    );
  }
} 