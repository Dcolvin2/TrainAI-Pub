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
    
    console.log('Chat request received:', { message, userId });
    
    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    console.log('Auth result:', { user: user?.id, authError, requestUserId: userId });
    
    // Use authenticated user if available, otherwise use userId from request body
    let actualUserId;
    if (user) {
      actualUserId = user.id;
      console.log('Using authenticated user ID:', actualUserId);
    } else if (userId) {
      actualUserId = userId;
      console.log('Using request body user ID:', actualUserId);
    } else {
      console.log('No user ID available');
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
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
You are a knowledgeable fitness coach. The user said: "${message}"

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
8. CRITICAL: Provide a DETAILED and DYNAMIC explanation in the message field that includes:
   - What specific equipment was detected and how it enhances the workout
   - Why you chose each exercise and how it benefits the user
   - Specific instructions for using the equipment (e.g., "Wrap the superband around your back for push-ups")
   - Training tips and progression advice
   - Safety considerations and form cues
   - How to modify intensity or difficulty
   - Expected benefits and muscle groups targeted
   - Rest periods and workout structure explanation
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
  "message": "Concise but informative explanation with equipment usage and key training tips"
}

IMPORTANT: The message field must be concise but informative. Do NOT use generic phrases like "I've updated your workout based on your request." Keep explanations brief but specific to the equipment and workout type.

CRITICAL: Your response message must be specific and informative. DO NOT use generic phrases like:
- "I've updated your workout based on your request"
- "I've updated your workout"
- "based on your request"
- Any other generic response

Instead, provide specific information about the equipment and workout type.

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
    console.log('Claude response length:', responseText.length);
    console.log('Claude response preview:', responseText.substring(0, 200));
    console.log('Claude response full:', responseText);

    // Parse the JSON response
    let workoutData;
    try {
      // Try to parse the entire response first
      try {
        workoutData = JSON.parse(responseText);
      } catch {
        // If that fails, try to extract JSON from the response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          workoutData = JSON.parse(jsonMatch[0]);
        } else {
          // If no JSON found, create a basic workout structure
          console.log('No JSON found in response, creating basic workout');
          workoutData = {
            workout: {
              warmup: [],
              main: [],
              cooldown: []
            },
            message: "I've created a workout based on your request."
          };
        }
      }
    } catch (error) {
      console.error('Error parsing Claude response:', error);
      console.error('Raw response:', responseText);
      
      // Create a fallback workout if parsing fails
      workoutData = {
        workout: {
          warmup: [],
          main: [],
          cooldown: []
        },
        message: "I've created a workout based on your request."
      };
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
    console.log('Original message from AI:', workoutData.message);
    
    if (!workoutData.message || 
        workoutData.message === "Brief description of what was changed" || 
        workoutData.message.includes("updated your workout based on your request") ||
        workoutData.message.includes("I've updated your workout") ||
        workoutData.message.includes("based on your request")) {
      
      console.log('Triggering fallback due to generic message');
      const detectedEquipment = mentionedEquipment.length > 0 ? mentionedEquipment.join(', ') : 'your available equipment';
      const workoutType = message.toLowerCase().includes('strength') ? 'strength' : 
                         message.toLowerCase().includes('cardio') ? 'cardio' : 
                         message.toLowerCase().includes('hiit') ? 'HIIT' : 'general fitness';
      
      let detailedMessage = `I've created a ${workoutType} workout using ${detectedEquipment}. `;
      
      if (mentionedEquipment.includes('Superbands')) {
        detailedMessage += `Superbands add resistance to bodyweight exercises - wrap around your back for push-ups or use for assisted pull-ups.`;
      } else if (mentionedEquipment.includes('Kettlebells')) {
        detailedMessage += `Kettlebell exercises build explosive power and functional strength. Focus on proper form for swings and cleans.`;
      } else if (mentionedEquipment.includes('Barbells')) {
        detailedMessage += `Barbell exercises are excellent for building strength and muscle mass. Focus on compound movements.`;
      } else if (mentionedEquipment.includes('Dumbbells')) {
        detailedMessage += `Dumbbell exercises provide unilateral training and better range of motion.`;
      } else {
        detailedMessage += `The exercises are specifically chosen to match your equipment and fitness goals.`;
      }
      
      workoutData.message = detailedMessage;
      console.log('Replaced with:', workoutData.message);
    }
    
    // Additional check: if the message is still too generic, replace it
    if (workoutData.message && (
        workoutData.message.includes("updated your workout") ||
        workoutData.message.includes("based on your request") ||
        workoutData.message.length < 50
    )) {
      console.log('Triggering second fallback due to generic message');
      const detectedEquipment = mentionedEquipment.length > 0 ? mentionedEquipment.join(', ') : 'your available equipment';
      const workoutType = message.toLowerCase().includes('strength') ? 'strength' : 
                         message.toLowerCase().includes('cardio') ? 'cardio' : 
                         message.toLowerCase().includes('hiit') ? 'HIIT' : 'general fitness';
      
      let detailedMessage = `I've created a ${workoutType} workout using ${detectedEquipment}. `;
      
      if (mentionedEquipment.includes('Superbands')) {
        detailedMessage += `Superbands add resistance to bodyweight exercises - wrap around your back for push-ups or use for assisted pull-ups.`;
      } else if (mentionedEquipment.includes('Kettlebells')) {
        detailedMessage += `Kettlebell exercises build explosive power and functional strength. Focus on proper form for swings and cleans.`;
      } else if (mentionedEquipment.includes('Barbells')) {
        detailedMessage += `Barbell exercises are excellent for building strength and muscle mass. Focus on compound movements.`;
      } else if (mentionedEquipment.includes('Dumbbells')) {
        detailedMessage += `Dumbbell exercises provide unilateral training and better range of motion.`;
      } else {
        detailedMessage += `The exercises are specifically chosen to match your equipment and fitness goals.`;
      }
      
      workoutData.message = detailedMessage;
      console.log('Second replacement with:', workoutData.message);
    }
    
    // Final aggressive fallback: if user mentioned specific equipment, ensure we have a good response
    if (mentionedEquipment.length > 0 && (
        !workoutData.message ||
        workoutData.message.includes("updated your workout") ||
        workoutData.message.includes("based on your request") ||
        workoutData.message.length < 30
    )) {
      console.log('Triggering final aggressive fallback');
      const detectedEquipment = mentionedEquipment.join(', ');
      const workoutType = message.toLowerCase().includes('strength') ? 'strength' : 
                         message.toLowerCase().includes('cardio') ? 'cardio' : 
                         message.toLowerCase().includes('hiit') ? 'HIIT' : 'general fitness';
      
      let detailedMessage = `I've created a ${workoutType} workout using ${detectedEquipment}. `;
      
      if (mentionedEquipment.includes('Superbands')) {
        detailedMessage += `Superbands add resistance to bodyweight exercises - wrap around your back for push-ups or use for assisted pull-ups.`;
      } else if (mentionedEquipment.includes('Kettlebells')) {
        detailedMessage += `Kettlebell exercises build explosive power and functional strength. Focus on proper form for swings and cleans.`;
      } else if (mentionedEquipment.includes('Barbells')) {
        detailedMessage += `Barbell exercises are excellent for building strength and muscle mass. Focus on compound movements.`;
      } else if (mentionedEquipment.includes('Dumbbells')) {
        detailedMessage += `Dumbbell exercises provide unilateral training and better range of motion.`;
      } else {
        detailedMessage += `The exercises are specifically chosen to match your equipment and fitness goals.`;
      }
      
      workoutData.message = detailedMessage;
      console.log('Final replacement with:', workoutData.message);
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