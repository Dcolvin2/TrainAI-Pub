import Anthropic from '@anthropic-ai/sdk';

export async function POST(request) {
  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const { message } = await request.json();

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      messages: [{ role: 'user', content: message }]
    });

    return Response.json({ content: response.content[0].text });
  } catch (error) {
    return Response.json({ error: 'Claude error' }, { status: 500 });
  }
} 