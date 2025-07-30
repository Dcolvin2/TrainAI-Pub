import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    console.log('[TEST-CLAUDE] Test route called');
    
    const { message } = await req.json();
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 100,
        messages: [
          {
            role: "user",
            content: `You are a fitness coach. Reply to: ${message}`
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    
    return NextResponse.json({
      content: data.content[0].text,
      model: 'claude-3-5-sonnet',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[TEST-CLAUDE] Error:', error);
    return NextResponse.json(
      { error: 'Test Claude API error' },
      { status: 500 }
    );
  }
} 