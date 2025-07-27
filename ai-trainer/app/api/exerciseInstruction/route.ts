import { NextRequest, NextResponse } from 'next/server';
import { chatWithFunctions } from '@/lib/chatService';

interface ExerciseInstructionRequest {
  exerciseName: string;
  userId: string;
}

interface ChatMessage {
  role: string;
  content: string;
  name?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { exerciseName, userId }: ExerciseInstructionRequest = await req.json();

    if (!exerciseName) {
      return NextResponse.json({ error: 'Exercise name is required' }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Generate exercise instruction using GPT
    const systemPrompt = `You are a knowledgeable fitness coach. Provide clear, safe, and concise exercise form instructions. Keep responses under 100 words and focus on key form points.`;
    const userPrompt = `Provide proper form instructions for the exercise: ${exerciseName}. Include key safety tips and common mistakes to avoid.`;

    const history: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    const instruction = await chatWithFunctions(history) || 
      `For ${exerciseName}: Focus on proper form, controlled movement, and full range of motion. If you're unsure about technique, consider consulting a fitness professional.`;

    return NextResponse.json({ 
      success: true, 
      instruction,
      exerciseName
    });
  } catch (error) {
    console.error('Exercise instruction error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to get exercise instruction'
    }, { status: 500 });
  }
} 