import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! // Use service role key for server-side operations
);

export async function POST(request: Request) {
  try {
    const { message, currentWorkout, sessionId, userId } = await request.json();
    
    console.log('Chat request received:', { message, userId });
    
    // Use userId from request body since we're using service role key
    if (!userId) {
      console.log('No user ID provided');
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }
    
    const actualUserId = userId;
    console.log('Using user ID:', actualUserId);
    
    // CRITICAL: Get user's available equipment
    const { data: userEquipment } = await supabase
      .from('user_equipment')
      .select('equipment:equipment_id(name), custom_name')
      .eq('user_id', actualUserId);

    const availableEquipment = userEquipment?.map((eq: any) => 
      eq.equipment?.name || eq.custom_name
    ).filter(Boolean) || [];
    
    // Detect equipment mentioned in the message
    const messageLower = message.toLowerCase();
    const mentionedEquipment: string[] = [];
    
    // Common equipment keywords
    const equipmentKeywords: Record<string, string[]> = {
      'Superbands': ['superband', 'resistance band', 'band', 'resistance bands', 'superbands'],
      'Kettlebells': ['kettlebell', 'kb', 'kettlebells'],
      'Dumbbells': ['dumbbell', 'db', 'dumbbells'],
      'Barbells': ['barbell', 'bb', 'barbells', 'barbell strength', 'barbell workout'],
      'Bench': ['bench'],
      'Pull Up Bar': ['pull-up bar', 'pullup bar', 'bar', 'pull up bar'],
      'Cables': ['cable', 'cable machine', 'cables'],
      'Machine': ['machine'],
      'Bodyweight': ['bodyweight', 'no equipment', 'no weights']
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
2. ONLY use exercises from the AVAILABLE EXERCISES list above - DO NOT invent new exercises
3. If the user mentions specific equipment (like "kettlebells"), ONLY use exercises that are tagged with that equipment
4. If no exercises are available for the mentioned equipment, use bodyweight alternatives
5. Return exercises as a clean array without workout instructions. Each exercise should be:
   {
     "name": "Exercise Name",  // Just the name, no numbers or instructions
     "sets": "3",
     "reps": "15"
   }
6. Do NOT include items like 'Perform 3 rounds of:' in the exercise list
7. IMPORTANT: Only use exercise names that EXACTLY match the AVAILABLE EXERCISES list
8. Provide a detailed explanation in the message field about:
   - What equipment was detected and how it's being used
   - Why specific exercises were chosen
   - How to modify exercises with the mentioned equipment
   - Training tips for the workout type
   - Specific instructions for using the equipment effectively
   - Progression tips and safety considerations
9. Return the COMPLETE modified workout in this exact JSON format:

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
  "message": "Detailed explanation of the workout, equipment usage, and training tips"
}

Return ONLY valid JSON, no other text.`;

    // If message contains "debug", return database info instead
    if (message.toLowerCase().includes('debug')) {
      return NextResponse.json({
        success: true,
        debug: {
          userEquipment: availableEquipment,
          mentionedEquipment: mentionedEquipment,
          allAvailableEquipment: allAvailableEquipment,
          totalExercises: exercises?.length || 0,
          availableExercisesCount: availableExercises.length,
          sampleExercises: exercises?.slice(0, 5).map((e: any) => ({
            name: e.name,
            equipment: e.equipment_required,
            category: e.category
          })),
          sampleAvailableExercises: availableExercises.slice(0, 5).map((e: any) => e.name)
        }
      });
    }

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    });

    const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
    console.log('Claude response:', responseText);

    // Parse the JSON response
    let workoutData;
    try {
      // Extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        workoutData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (error) {
      console.error('Error parsing Claude response:', error);
      return NextResponse.json({ 
        error: 'Failed to parse workout response',
        rawResponse: responseText 
      }, { status: 500 });
    }

    // Validate that all exercises in the response are from the available list
    const availableExerciseNames = availableExercises.map((e: any) => e.name);
    const allExercisesInResponse = [
      ...(workoutData.workout?.warmup || []),
      ...(workoutData.workout?.main || []),
      ...(workoutData.workout?.cooldown || [])
    ].map((e: any) => e.name);

    const invalidExercises = allExercisesInResponse.filter((name: string) => 
      !availableExerciseNames.includes(name)
    );

    if (invalidExercises.length > 0) {
      console.log('Invalid exercises found:', invalidExercises);
      console.log('Available exercises:', availableExerciseNames);
      
      // Filter out invalid exercises and replace with available ones
      const filterExercises = (exerciseList: any[]) => {
        return exerciseList.filter((exercise: any) => 
          availableExerciseNames.includes(exercise.name)
        );
      };

      if (workoutData.workout) {
        workoutData.workout.warmup = filterExercises(workoutData.workout.warmup || []);
        workoutData.workout.main = filterExercises(workoutData.workout.main || []);
        workoutData.workout.cooldown = filterExercises(workoutData.workout.cooldown || []);
      }
    }

    // Ensure we have a proper message
    if (!workoutData.message || workoutData.message === "Brief description of what was changed") {
      const detectedEquipment = mentionedEquipment.length > 0 ? mentionedEquipment.join(', ') : 'your available equipment';
      workoutData.message = `I've created a workout using ${detectedEquipment}. The exercises are specifically chosen to match your equipment and fitness goals. Focus on proper form and gradually increase intensity as you progress.`;
    }

    // UPDATE the workout session in database
    if (sessionId) {
      await supabase
        .from('workout_sessions')
        .update({
          planned_exercises: workoutData.workout,
          modifications: { 
            timestamp: new Date().toISOString(),
            reason: message,
            changes: workoutData.changes
          }
        })
        .eq('id', sessionId);
    }

    return NextResponse.json({
      success: true,
      workout: workoutData.workout,
      message: workoutData.changes
    });

  } catch (error) {
    console.error('Chat workout error:', error);
    return NextResponse.json({ error: 'Failed to modify workout' }, { status: 500 });
  }
} 