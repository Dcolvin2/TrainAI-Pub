import { chatOpenAI } from '@/lib/openaiClient';

export async function POST(request) {
  try {
    // OpenAI client is imported from openaiClient.ts

    const { message, detailLevel = 'concise' } = await request.json();

    // Define system prompts based on detail level
    const systemPrompts = {
      concise: `You are a fitness expert. Be direct and concise. Use bullet points and numbered lists. Limit responses to 150 words unless detailed explanation is specifically requested. Format workout plans as: brief summary, numbered exercises (max 8), key notes.`,
      standard: `You are a fitness expert. Provide clear, actionable advice. Use bullet points for lists. Keep responses under 300 words unless detailed explanation is needed.`,
      detailed: `You are a fitness expert. Provide comprehensive advice when requested. Use clear formatting with bullet points and numbered lists.`
    };

    const systemPrompt = systemPrompts[detailLevel] || systemPrompts.concise;

    const response = await chatOpenAI(message, {
      model: 'gpt-4o',
      max_tokens: detailLevel === 'concise' ? 500 : detailLevel === 'standard' ? 800 : 1000,
      temperature: 0.7,
      system: systemPrompt
    });

    return Response.json({ 
      content: response,
      model: 'gpt-4o',
      timestamp: new Date().toISOString(),
      detailLevel
    });
  } catch (error) {
    console.error('OpenAI API error:', error);
    return Response.json({ error: 'OpenAI error' }, { status: 500 });
  }
} 