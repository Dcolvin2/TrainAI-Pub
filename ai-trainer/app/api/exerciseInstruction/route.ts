import { NextRequest, NextResponse } from 'next/server';

interface ExerciseInstructionRequest {
  exerciseName: string;
  userId: string;
}

export async function POST(req: NextRequest) {
  try {
    // Initialize Anthropic inside the function, not at module level
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      return NextResponse.json({ error: 'AI service not configured' }, { status: 500 });
    }

    const { exerciseName, userId }: ExerciseInstructionRequest = await req.json();

    if (!exerciseName) {
      return NextResponse.json({ error: 'Exercise name is required' }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Generate exercise instruction using Claude
    const systemPrompt = `You are a knowledgeable fitness coach. Provide clear, safe, and concise exercise form instructions. Keep responses under 100 words and focus on key form points.`;
    const userPrompt = `Provide proper form instructions for the exercise: ${exerciseName}. Include key safety tips and common mistakes to avoid.`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 200,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`Claude API error: ${response.status}`);
      }

      const data = await response.json();
      const instruction = data.content[0].text;

      return NextResponse.json({ 
        success: true, 
        instruction,
        exerciseName
      });
    } catch (claudeError) {
      console.error('Claude API error:', claudeError);
      // Fallback instruction
      const instruction = `For ${exerciseName}: Focus on proper form, controlled movement, and full range of motion. If you're unsure about technique, consider consulting a fitness professional.`;
      
      return NextResponse.json({ 
        success: true, 
        instruction,
        exerciseName
      });
    }
  } catch (error) {
    console.error('Exercise instruction error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
} 