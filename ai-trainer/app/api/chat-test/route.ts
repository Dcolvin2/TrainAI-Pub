import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(request: Request) {
  try {
    const { message } = await request.json();
    
    // Check if API key exists
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('Missing ANTHROPIC_API_KEY');
      return NextResponse.json({
        response: 'Error: Claude API key is not configured. Please add ANTHROPIC_API_KEY to your .env.local file'
      });
    }
    
    console.log('Attempting to call Claude with message:', message);
    
    // Initialize Claude
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    
    // Simple Claude call
    try {
      const completion = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: message
        }]
      });
      
      console.log('Claude response received');
      
      const content = completion.content[0];
      const responseText = content.type === 'text' ? content.text : 'No text response received';
      
      return NextResponse.json({
        response: responseText
      });
    } catch (claudeError: any) {
      console.error('Claude API error:', claudeError);
      return NextResponse.json({
        response: `Claude error: ${claudeError.message || 'Unknown Claude error'}`
      });
    }
    
  } catch (error: any) {
    console.error('General error:', error);
    return NextResponse.json({
      response: `General error: ${error.message || 'Unknown error'}`
    });
  }
} 