import { NextResponse } from 'next/server';
import { chatOpenAI } from '@/lib/openaiClient';

export async function POST(request: Request) {
  try {
    // OpenAI client is imported from openaiClient.ts

    const { userId, messages, detailLevel = 'concise' } = await request.json();

    const userMessage = messages[messages.length - 1]?.content || 'Help me with my workout';

    // Define system prompts based on detail level
    const systemPrompts = {
      concise: `You are a concise fitness coach. Be direct and brief. Use bullet points. Limit responses to 120 words. Format as: brief answer, numbered steps (max 4), key tip. Avoid lengthy explanations unless specifically requested.`,
      standard: `You are a fitness coach. Provide clear, actionable advice. Use bullet points for lists. Keep responses under 250 words unless detailed explanation is needed.`,
      detailed: `You are a fitness coach. Provide comprehensive advice when requested. Use clear formatting with bullet points and numbered lists.`
    };

    const systemPrompt = systemPrompts[detailLevel as keyof typeof systemPrompts] || systemPrompts.concise;

    const text = await chatOpenAI(`${systemPrompt}\n\nHelp with this workout question: ${userMessage}`, {
      model: 'gpt-4o',
      max_tokens: detailLevel === 'concise' ? 400 : detailLevel === 'standard' ? 600 : 800,
      temperature: 0.7
    });

    return NextResponse.json({ 
      assistantMessage: text,
      model: 'gpt-4o',
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