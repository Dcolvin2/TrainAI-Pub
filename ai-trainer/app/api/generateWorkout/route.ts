import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// Day of week workout schedule
const workoutSchedule = {
  Monday: 'Legs (e.g., back squat + accessories)',
  Tuesday: 'Chest (e.g., bench, cable flys, triceps)',
  Thursday: 'HIIT (WOD style, no Olympic lifts)',
  Saturday: 'Back + accessories (deadlift, shoulders, rows, biceps)',
  Wednesday: 'Cardio',
  Friday: 'Cardio',
  Sunday: 'Cardio'
};

// Get workout type from day of week
const getDayWorkoutType = (day: string) => {
  const dayKey = day.charAt(0).toUpperCase() + day.slice(1).toLowerCase();
  return workoutSchedule[dayKey as keyof typeof workoutSchedule] || null;
};

// Get available exercises based on user equipment and category
const getAvailableExercises = async (equipmentList: string[], category?: string) => {
  let query = supabase
    .from('exercise')
    .select('*');
  
  if (category) {
    query = query.eq('category', category);
  }
  
  // Filter by equipment - exercises that can be done with available equipment
  const { data: exercises } = await query;
  
  if (!exercises) return [];
  
  // Filter exercises based on available equipment
  return exercises.filter(exercise => {
    if (!exercise.equipment_required || exercise.equipment_required.length === 0) {
      return true; // Bodyweight exercises
    }
    
    // Check if user has any of the required equipment
    return exercise.equipment_required.some((required: string) =>
      equipmentList.some(available => 
        available.toLowerCase().includes(required.toLowerCase()) ||
        required.toLowerCase().includes(available.toLowerCase())
      )
    );
  });
};

// Get user profile with equipment
const getUserProfile = async (userId: string) => {
  const { data: profile } = await supabase
    .from('profiles')
    .select('equipment, experience_level, first_name')
    .eq('id', userId)
    .single();
  
  return profile;
};



export async function POST(req: Request) {
  try {
    const { userId, minutes, prompt } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Fetch user context with new dynamic exercise system
    const [profile, { data: goals }] = await Promise.all([
      getUserProfile(userId),
      supabase.from('user_goals').select('description').eq('user_id', userId)
    ]);

    const equipmentList = profile?.equipment || [];

    let systemPrompt = '';
    let userPrompt = prompt;
    let isFlaherty = false;

    // Check for Flaherty keyword
    if (prompt.toLowerCase().includes('flaherty')) {
      isFlaherty = true;
      
      // Get user's last completed Flaherty workout
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('last_flaherty_workout')
        .eq('id', userId)
        .single();

      const lastWorkout = userProfile?.last_flaherty_workout || 0;
      const nextWorkoutNumber = lastWorkout + 1;

      // Get the next Flaherty workout with correct column names
      const { data: flahertyRows } = await supabase
        .from('flaherty_workouts')
        .select('workout, exercise_name, sets, reps, weight, rest_seconds, section')
        .eq('workout', nextWorkoutNumber);

      if (flahertyRows && flahertyRows.length > 0) {


        // Get available exercises for Flaherty workout
        const availableExercises = await getAvailableExercises(equipmentList);
        const exerciseOptions = availableExercises.map(ex => `${ex.name} (${ex.category})`).join('\n');
        
        systemPrompt = `You are TrainAI, an expert fitness coach. The user is following the Flaherty workout program.
        
        User profile: ${profile?.first_name || 'Unknown'}.
        Goals: ${goals?.map(g => g.description).join(', ') || 'None'}.
        Equipment: ${equipmentList.join(', ') || 'None'}.
        
        Available exercises for this user:
        ${exerciseOptions}
        
        The user last completed Flaherty workout #${lastWorkout}. This is workout #${nextWorkoutNumber}.`;
        
        userPrompt = `Create a workout plan based on the Flaherty program workout #${nextWorkoutNumber}. 
        Workout data: ${JSON.stringify(flahertyRows)}. 
        Format the response as a structured workout with warm-up, main workout, and cool-down sections.
        Total workout time should be ${minutes} minutes.
        
        IMPORTANT: Use the exact exercise names from the data. Do NOT add "(bodyweight)" to any exercise names unless it's explicitly part of the exercise name in the data.`;
      } else {
        // Fallback to regular AI generation for Flaherty
        systemPrompt = `You are TrainAI, an expert fitness coach. The user wants a Flaherty-style workout.
        
        User profile: ${profile?.first_name || 'Unknown'}.
        Goals: ${goals?.map(g => g.description).join(', ') || 'None'}.
        Equipment: ${equipmentList.join(', ') || 'None'}.
        
        Create a Flaherty-style workout that focuses on compound movements, progressive overload, and functional fitness.
        Total workout time should be ${minutes} minutes.
        
        IMPORTANT: Use exact exercise names. Do NOT add "(bodyweight)" to exercise names unless it's explicitly part of the exercise name.`;
      }
    } else {
      // Check for day of week in prompt
      const dayKeywords = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      const detectedDay = dayKeywords.find(day => prompt.toLowerCase().includes(day));
      
      let daySpecificPrompt = '';
      
      if (detectedDay) {
        const dayType = getDayWorkoutType(detectedDay);
        
        if (dayType && dayType.includes('Cardio')) {
          // Get cardio exercises from database
          const cardioExercises = await getAvailableExercises(equipmentList, 'endurance');
          const cardioOptions = cardioExercises.map(ex => ex.name).join(', ');
          daySpecificPrompt = `Today is ${detectedDay.charAt(0).toUpperCase() + detectedDay.slice(1)} and it's a cardio day. Available cardio exercises: ${cardioOptions}.`;
        } else if (dayType) {
          daySpecificPrompt = `Today is ${detectedDay.charAt(0).toUpperCase() + detectedDay.slice(1)} and it's a ${dayType} day. Focus the workout on ${dayType} training.`;
        }
      }

      // Get available exercises for the user
      const availableExercises = await getAvailableExercises(equipmentList);
      const exerciseOptions = availableExercises.map(ex => `${ex.name} (${ex.category})`).join('\n');
      
      systemPrompt = `You are TrainAI, an expert fitness coach.
      
      User profile: ${profile?.first_name || 'Unknown'}.
      Goals: ${goals?.map(g => g.description).join(', ') || 'None'}.
      Equipment: ${equipmentList.join(', ') || 'None'}.
      ${daySpecificPrompt}
      
      Available exercises for this user:
      ${exerciseOptions}
      
      Create a ${minutes}-minute workout that matches the user's request and available equipment.
      
      IMPORTANT: Use exact exercise names from the available exercises list. Do NOT add "(bodyweight)" to exercise names unless it's explicitly part of the exercise name.`;
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
      is_flaherty: isFlaherty,
      workout_type: isFlaherty ? 'flaherty' : null,
      day_of_week: null
    });

    return NextResponse.json(plan);
  } catch (error) {
    console.error('Generate workout error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to generate workout'
    }, { status: 500 });
  }
} 