import Anthropic from '@anthropic-ai/sdk';

export async function POST(request) {
  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const { message, detailLevel = 'concise' } = await request.json();

    // Define system prompts based on detail level
    const systemPrompts = {
      concise: `You are a fitness expert. Be direct and concise. Use bullet points and numbered lists. Limit responses to 150 words unless detailed explanation is specifically requested. Format workout plans as: brief summary, numbered exercises (max 8), key notes.`,
      standard: `You are a fitness expert. Provide clear, actionable advice. Use bullet points for lists. Keep responses under 300 words unless detailed explanation is needed.`,
      detailed: `You are a fitness expert. Provide comprehensive advice when requested. Use clear formatting with bullet points and numbered lists.`
    };

    const systemPrompt = systemPrompts[detailLevel] || systemPrompts.concise;

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: detailLevel === 'concise' ? 500 : detailLevel === 'standard' ? 800 : 1000,
      messages: [
        { role: 'user', content: `${systemPrompt}\n\n${message}` }
      ]
    });

    return Response.json({ 
      content: response.content[0].text,
      model: 'claude-3-5-sonnet-20241022',
      timestamp: new Date().toISOString(),
      detailLevel
    });
  } catch (error) {
    console.error('Claude API error:', error);
    return Response.json({ error: 'Claude error' }, { status: 500 });
  }
} 