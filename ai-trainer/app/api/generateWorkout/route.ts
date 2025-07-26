import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// Day of week workout logic
const getDayWorkoutType = (day: string) => {
  const dayLower = day.toLowerCase();
  if (["monday"].includes(dayLower)) return "legs";
  if (["tuesday"].includes(dayLower)) return "chest";
  if (["thursday"].includes(dayLower)) return "hiit";
  if (["saturday"].includes(dayLower)) return "back";
  if (["wednesday", "friday", "sunday"].includes(dayLower)) return "cardio";
  return null;
};

// Equipment-aware cardio workout
const getCardioEquipmentWorkout = (equipmentList: string[]) => {
  const options = ["treadmill", "rower", "bike", "airdyne", "elliptical"];
  const available = options.filter((eq) => equipmentList.includes(eq));
  return available.length > 0 ? available[0] : "bodyweight circuit";
};

// Get next Flaherty workout
const getNextFlahertyWorkout = async (userId: string) => {
  try {
    // Get the last completed workout index
    const { data: profile } = await supabase
      .from("profiles")
      .select("last_flaherty_workout")
      .eq("id", userId)
      .single();

    const nextWorkoutNumber = (profile?.last_flaherty_workout || 0) + 1;

    const { data: nextWorkoutRows, error } = await supabase
      .from("flaherty_workouts")
      .select("*")
      .eq("workout", nextWorkoutNumber);

    if (error) {
      console.error('Error fetching Flaherty workout:', error);
      return null;
    }

    return { nextWorkoutRows, nextWorkoutNumber };
  } catch (error) {
    console.error('Error in getNextFlahertyWorkout:', error);
    return null;
  }
};

export async function POST(req: Request) {
  try {
    const { userId, minutes, prompt, isFlaherty, workoutType, dayOfWeek } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Fetch user context
    const [{ data: profile }, { data: equipment }, { data: goals }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('equipment').select('name').eq('user_id', userId),
      supabase.from('user_goals').select('description').eq('user_id', userId)
    ]);

    let systemPrompt = '';
    let userPrompt = prompt;

    // Handle Flaherty workout logic
    if (isFlaherty) {
      const flahertyData = await getNextFlahertyWorkout(userId);
      
      if (flahertyData && flahertyData.nextWorkoutRows) {
        // Use Flaherty workout data
        const workoutData = flahertyData.nextWorkoutRows;
        systemPrompt = `You are TrainAI, an expert fitness coach. The user is following the Flaherty workout program. 
        
        User profile: ${profile?.first_name || 'Unknown'}.
        Goals: ${goals?.map(g => g.description).join(', ') || 'None'}.
        Equipment: ${equipment?.map(e => e.name).join(', ') || 'None'}.
        
        This is Flaherty workout #${flahertyData.nextWorkoutNumber}. Use the provided workout data to create a structured workout plan.`;
        
        userPrompt = `Create a workout plan based on the Flaherty program workout #${flahertyData.nextWorkoutNumber}. 
        Workout data: ${JSON.stringify(workoutData)}. 
        Format the response as a structured workout with warm-up, main workout, and cool-down sections.`;
      } else {
        // Fallback to regular AI generation for Flaherty
        systemPrompt = `You are TrainAI, an expert fitness coach. The user wants a Flaherty-style workout.
        
        User profile: ${profile?.first_name || 'Unknown'}.
        Goals: ${goals?.map(g => g.description).join(', ') || 'None'}.
        Equipment: ${equipment?.map(e => e.name).join(', ') || 'None'}.
        
        Create a Flaherty-style workout that focuses on compound movements, progressive overload, and functional fitness.`;
      }
    } else {
      // Regular workout generation with day-of-week logic
      const dayType = workoutType || getDayWorkoutType(dayOfWeek || '');
      const equipmentList = equipment?.map(e => e.name) || [];
      
      let daySpecificPrompt = '';
      if (dayType === 'cardio') {
        const cardioEquipment = getCardioEquipmentWorkout(equipmentList);
        daySpecificPrompt = `Today is ${dayOfWeek || 'today'} and it's a cardio day. Use ${cardioEquipment} for the main cardio session.`;
      } else if (dayType) {
        daySpecificPrompt = `Today is ${dayOfWeek || 'today'} and it's a ${dayType} day. Focus the workout on ${dayType} training.`;
      }

      systemPrompt = `You are TrainAI, an expert fitness coach.
      
      User profile: ${profile?.first_name || 'Unknown'}.
      Goals: ${goals?.map(g => g.description).join(', ') || 'None'}.
      Equipment: ${equipment?.map(e => e.name).join(', ') || 'None'}.
      ${daySpecificPrompt}
      
      Create a ${minutes}-minute workout that matches the user's request and available equipment.`;
    }

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      functions: [{
        name: 'generate_workout',
        description: 'Generate a structured workout plan',
        parameters: {
          type: 'object',
          properties: {
            warmup: {
              type: 'array',
              items: { type: 'string' },
              description: 'Warm-up exercises (5-10 minutes)'
            },
            workout: {
              type: 'array',
              items: { type: 'string' },
              description: 'Main workout exercises with sets, reps, weight, and rest periods'
            },
            cooldown: {
              type: 'array',
              items: { type: 'string' },
              description: 'Cool-down exercises (5-10 minutes)'
            }
          },
          required: ['warmup', 'workout', 'cooldown']
        }
      }],
      function_call: { name: 'generate_workout' }
    });

    const functionCall = completion.choices[0].message.function_call;
    if (!functionCall) {
      throw new Error('No function call returned from OpenAI');
    }

    const plan = JSON.parse(functionCall.arguments);

    // Save to generated_workouts table
    await supabase.from('generated_workouts').insert({
      user_id: userId,
      minutes: minutes,
      prompt: prompt,
      plan: plan,
      used_model: 'gpt-3.5-turbo',
      is_flaherty: isFlaherty || false,
      workout_type: workoutType || null,
      day_of_week: dayOfWeek || null
    });

    return NextResponse.json(plan);
  } catch (error) {
    console.error('Generate workout error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to generate workout'
    }, { status: 500 });
  }
} 