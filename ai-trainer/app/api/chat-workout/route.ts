import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const { message, currentWorkout, sessionId, userId } = await request.json();
    
    // Use userId from request body instead of auth context
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    // CRITICAL: Get user's available equipment
    const { data: userEquipment } = await supabase
      .from('user_equipment')
      .select('equipment:equipment_id(name), custom_name')
      .eq('user_id', userId);

    const availableEquipment = userEquipment?.map((eq: any) => 
      eq.equipment?.name || eq.custom_name
    ).filter(Boolean) || [];
    
    // Detect equipment mentioned in the message
    const messageLower = message.toLowerCase();
    const mentionedEquipment: string[] = [];
    
    // Common equipment keywords
    const equipmentKeywords: Record<string, string[]> = {
      'superband': ['superband', 'resistance band', 'band'],
      'kettlebell': ['kettlebell', 'kb'],
      'dumbbell': ['dumbbell', 'db'],
      'barbell': ['barbell', 'bb'],
      'bench': ['bench'],
      'pull-up bar': ['pull-up bar', 'pullup bar', 'bar'],
      'cable': ['cable'],
      'machine': ['machine'],
      'bodyweight': ['bodyweight', 'no equipment', 'no weights']
    };
    
    // Check for mentioned equipment
    Object.entries(equipmentKeywords).forEach(([equipment, keywords]) => {
      if (keywords.some(keyword => messageLower.includes(keyword))) {
        mentionedEquipment.push(equipment);
      }
    });
    
    // Combine user's equipment with mentioned equipment
    const allAvailableEquipment = [...new Set([...availableEquipment, ...mentionedEquipment])];
    
    console.log('User equipment:', availableEquipment);
    console.log('Mentioned equipment:', mentionedEquipment);
    console.log('All available equipment:', allAvailableEquipment);

    // CRITICAL: Get exercises that match available equipment
    const { data: exercises } = await supabase
      .from('exercises')
      .select('*');

    console.log('Total exercises in database:', exercises?.length || 0);
    console.log('Sample exercises with equipment:', exercises?.slice(0, 5).map((e: any) => ({
      name: e.name,
      equipment: e.equipment_required
    })));

    // Filter exercises by available equipment (including mentioned equipment)
    const availableExercises = exercises?.filter((exercise: any) => {
      if (!exercise.equipment_required || exercise.equipment_required.length === 0) {
        return true; // Bodyweight exercises
      }
      return exercise.equipment_required.every((req: string) => 
        allAvailableEquipment.includes(req)
      );
    }) || [];

    console.log('Available exercises after filtering:', availableExercises.length);
    console.log('Sample available exercises:', availableExercises.slice(0, 5).map((e: any) => e.name));

    // Build prompt that MODIFIES the workout
    const prompt = `
You are a fitness coach. The user said: "${message}"

CURRENT WORKOUT:
${JSON.stringify(currentWorkout, null, 2)}

USER'S AVAILABLE EQUIPMENT:
${allAvailableEquipment.join(', ')}

AVAILABLE EXERCISES (filtered by equipment):
${availableExercises.map((e: any) => `- ${e.name} (${e.category}, ${e.primary_muscle})`).join('\n')}

CRITICAL INSTRUCTIONS:
1. You MUST return a MODIFIED workout, not suggestions
2. Replace exercises the user can't do with ones from AVAILABLE EXERCISES list
3. ONLY use exercises from the AVAILABLE EXERCISES list
4. If the user mentions specific equipment (like "superbands"), prioritize exercises using that equipment
5. Return exercises as a clean array without workout instructions. Each exercise should be:
   {
     "name": "Exercise Name",  // Just the name, no numbers or instructions
     "sets": "3",
     "reps": "15"
   }
6. Do NOT include items like 'Perform 3 rounds of:' in the exercise list
7. Return the COMPLETE modified workout in this exact JSON format:

{
  "workout": {
    "warmup": [
      {"name": "Exercise Name", "sets": 1, "reps": "10", "duration": "30s"}
    ],
    "main": [
      {"name": "Exercise Name", "sets": 3, "reps": "8-10", "rest": "60s", "weight": "moderate"}
    ],
    "cooldown": [
      {"name": "Exercise Name", "duration": "30s"}
    ]
  },
  "changes": "Brief description of what was changed"
}

Return ONLY valid JSON, no other text.`;

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 2000,
      temperature: 0.7,
      messages: [{ role: "user", content: prompt }]
    });

    const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
    const modifiedWorkout = JSON.parse(responseText);

    // UPDATE the workout session in database
    if (sessionId) {
      await supabase
        .from('workout_sessions')
        .update({
          planned_exercises: modifiedWorkout.workout,
          modifications: { 
            timestamp: new Date().toISOString(),
            reason: message,
            changes: modifiedWorkout.changes
          }
        })
        .eq('id', sessionId);
    }

    return NextResponse.json({
      success: true,
      workout: modifiedWorkout.workout,
      message: modifiedWorkout.changes
    });

  } catch (error) {
    console.error('Chat workout error:', error);
    return NextResponse.json({ error: 'Failed to modify workout' }, { status: 500 });
  }
} 