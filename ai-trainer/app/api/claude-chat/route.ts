import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    console.log('[CLAUDE-API] New chat request received');
    
    const { message, workoutData } = await req.json();
    
    // Direct fetch to Anthropic API (no SDK needed)
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: `You are a fitness coach. User message: ${message}. Workout context: ${JSON.stringify(workoutData)}`
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('[CLAUDE-API] Claude response received');
    
    return NextResponse.json({
      content: data.content[0].text,
      model: 'claude-3-5-sonnet',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[CLAUDE-API] Error:', error);
    return NextResponse.json(
      { error: 'Claude API error' },
      { status: 500 }
    );
  }
} 