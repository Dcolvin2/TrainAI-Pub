import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'
import { callClaude } from '@/lib/claude-server'

interface WorkoutChatRequest {
  userId: string;
  messages: Array<{
    role: string;
    content: string;
    name?: string;
  }>;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { userId, messages }: WorkoutChatRequest = await req.json();

    if (!userId || !messages || messages.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const lastMessage = messages[messages.length - 1];
    const userInput = lastMessage.content.toLowerCase().trim();

    // Helper function for instruction lookup (defined inside POST)
    async function getInstruction(name: string) {
      const { data } = await supabase
        .from("exercises_final")
        .select("instruction")
        .ilike("name", `%${name}%`)
        .maybeSingle();
      return data?.instruction ?? null;
    }

    // Check for instruction requests first
    if (userInput.includes('how') || userInput.includes('instruction') || userInput.includes('do')) {
      const instruction = await getInstruction(userInput);
      if (instruction) {
        return NextResponse.json({
          assistantMessage: `**Exercise Instructions**\n\n${instruction}`,
          plan: null
        });
      }
    }

    // Check for day-of-week workout requests
    const dayMatch = userInput.match(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
    if (dayMatch) {
      const day = dayMatch[1];
      return NextResponse.json({
        assistantMessage: `I'll create a ${day} workout plan for you! Let me generate that now...`,
        plan: null
      });
    }

    // Claude API integration (defined inside POST)
    async function chatWithClaude(messages: any[], userId: string) {
      // Fetch user context from Supabase
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('name, goals, current_weight, equipment')
        .eq('user_id', userId)
        .single();

      const { data: recentWorkouts } = await supabase
        .from('workout_sessions')
        .select('created_at, workout_type')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);

      // Build context for Claude
      const userContext = {
        name: userProfile?.name || 'User',
        goals: userProfile?.goals || [],
        currentWeight: userProfile?.current_weight || 'Unknown',
        equipment: userProfile?.equipment || [],
        recentWorkouts: recentWorkouts?.map((w: any) => w.workout_type) || []
      };

      // System prompt for Claude
      const systemPrompt = `You are TrainAI, an expert fitness trainer and workout coach. You help users create personalized workout plans and provide fitness guidance.
      User Context:
      - Name: ${userContext.name}
      - Goals: ${userContext.goals.join(', ')}
      - Current Weight: ${userContext.currentWeight}
      - Available Equipment: ${userContext.equipment.join(', ')}
      - Recent Workouts: ${userContext.recentWorkouts.join(', ')}
      Guidelines:
      1. Create personalized workout plans based on user goals and equipment
      2. Provide clear, actionable fitness advice
      3. Be encouraging and motivational
      4. Ask clarifying questions when needed
      5. Suggest progressive overload strategies
      6. Consider user's fitness level and experience
      Respond in a helpful, encouraging tone.`;
      
      try {
        return await callClaude(messages, systemPrompt);
      } catch (error: any) {
        console.error('Claude chat error:', error);
        throw error;
      }
    }

    // Use Claude for all other chat interactions
    const claudeResponse = await chatWithClaude(messages, userId);

    return NextResponse.json({
      assistantMessage: claudeResponse,
      plan: null
    });

  } catch (error) {
    console.error('API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
} 