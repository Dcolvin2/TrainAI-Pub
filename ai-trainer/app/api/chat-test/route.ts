import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { message } = await request.json();
    
    // First, just echo back to confirm the endpoint works
    return NextResponse.json({
      response: `Echo: You said "${message}"`
    });
    
  } catch (error) {
    console.error('Chat test error:', error);
    return NextResponse.json(
      { error: 'Failed to process message' },
      { status: 500 }
    );
  }
} 