import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(request: Request) {
  try {
    const { message } = await request.json();
    
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });
    
    // Check if user is asking for a workout
    const isWorkoutRequest = message.toLowerCase().includes('workout') || 
                           message.toLowerCase().includes('exercise') ||
                           message.toLowerCase().includes('routine');
    
    let systemPrompt = 'You are a helpful fitness coach AI assistant. Be friendly and concise.';
    
    if (isWorkoutRequest) {
      systemPrompt += `\n\nWhen creating workouts, structure your response like this:
**WORKOUT NAME**

**Warm-up:**
- Exercise 1
- Exercise 2
- Exercise 3

**Main Workout:**
1. Exercise Name - Sets x Reps (weight/notes)
2. Exercise Name - Sets x Reps (weight/notes)
[Continue...]

**Cool-down:**
- Stretch 1
- Stretch 2
- Stretch 3

**Notes:** Any additional tips

Keep responses concise but complete. Format for easy reading.`;
    }
    
    const completion = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 800,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: message
      }]
    });
    
    const responseText = completion.content[0].type === 'text' ? completion.content[0].text : 'No text response received';
    
    // If it's a workout, also return structured data
    let workoutData = null;
    if (isWorkoutRequest) {
      workoutData = parseWorkoutFromText(responseText);
    }
    
    return NextResponse.json({
      response: responseText,
      workout: workoutData
    });
    
  } catch (error: any) {
    console.error('Chat error:', error);
    return NextResponse.json({
      response: `Error: ${error.message || 'Failed to process message'}`
    });
  }
}

function parseWorkoutFromText(text: string) {
  // Basic parser to extract workout structure
  const lines = text.split('\n');
  const workout: {
    name: string;
    warmup: string[];
    main: string[];
    cooldown: string[];
    [key: string]: string | string[];
  } = {
    name: '',
    warmup: [],
    main: [],
    cooldown: []
  };
  
  let currentSection = '';
  
  for (const line of lines) {
    if (line.includes('**') && line.includes('**')) {
      const title = line.replace(/\*\*/g, '').trim();
      if (title.includes('Warm-up')) currentSection = 'warmup';
      else if (title.includes('Main')) currentSection = 'main';
      else if (title.includes('Cool-down')) currentSection = 'cooldown';
      else if (!workout.name && title.length > 0) workout.name = title;
    } else if (line.trim() && currentSection) {
      (workout[currentSection] as string[]).push(line.trim());
    }
  }
  
  return workout;
} 