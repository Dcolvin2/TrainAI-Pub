import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { userId, messages } = await request.json();

    // For now, return a simplified response
    // Later we can integrate with real Claude API
    const response = {
      content: `I'm here to help with your workout! This is a placeholder response. Real Claude integration coming soon.`
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('WorkoutChat API error:', error);
    return NextResponse.json(
      { error: 'Failed to process workout chat' },
      { status: 500 }
    );
  }
} 