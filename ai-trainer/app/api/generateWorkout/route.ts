import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';

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

interface Exercise {
  name: string;
  category: string;
  equipment_required?: string[];
}

// Get available exercises based on user equipment and category
const getAvailableExercises = async (supabase: any, equipmentList: string[], category?: string): Promise<Exercise[]> => {
  let query = supabase
    .from('exercises_final')
    .select('*');
  
  if (category) {
    query = query.eq('category', category);
  }
  
  // Filter by equipment - exercises that can be done with available equipment
  const { data: exercises } = await query;
  
  if (!exercises) return [];
  
  // Filter exercises based on available equipment
  return exercises.filter((exercise: Exercise) => {
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
const getUserProfile = async (supabase: any, userId: string) => {
  const { data: profile } = await supabase
    .from('profiles')
    .select('equipment, experience_level, first_name')
    .eq('id', userId)
    .single();
  
  return profile;
};

export async function POST(req: Request) {
  try {
    const supabase = getSupabase();
    const { userId, minutes, prompt } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Fetch user context with new dynamic exercise system
    const [profile, { data: goals }] = await Promise.all([
      getUserProfile(supabase, userId),
      supabase.from('user_goals').select('description').eq('user_id', userId)
    ]);

    const equipmentList = profile?.equipment || [];

    let systemPrompt = '';
    let userPrompt = prompt;
    let isNike = false;

    // Check for Nike keyword
    if (prompt.toLowerCase().includes('nike')) {
      isNike = true;
      
      // Get user's last completed Nike workout
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('last_nike_workout')
        .eq('id', userId)
        .single();

      const lastWorkout = userProfile?.last_nike_workout || 0;
      const nextWorkoutNumber = lastWorkout + 1;

      // Get available exercises for Nike workout
      const availableExercises = await getAvailableExercises(supabase, equipmentList);
      const exerciseOptions = availableExercises.map((ex: Exercise) => `${ex.name} (${ex.category})`).join('\n');
      
      systemPrompt = `You are TrainAI, an expert fitness coach. The user is following the Nike workout program.
      
      User profile: ${profile?.first_name || 'Unknown'}.
      Goals: ${goals?.map((g: any) => g.description).join(', ') || 'None'}.
      Equipment: ${equipmentList.join(', ') || 'None'}.
      
      Available exercises for this user:
      ${exerciseOptions}
      
      The user last completed Nike workout #${lastWorkout}. This is workout #${nextWorkoutNumber}.`;
      
      userPrompt = `Create a workout plan based on the Nike program workout #${nextWorkoutNumber}. 
      Format the response as a structured workout with warm-up, main workout, and cool-down sections.
      Total workout time should be ${minutes} minutes.
      
      IMPORTANT: Use the exact exercise names from the data. Do NOT add "(bodyweight)" to any exercise names unless it's explicitly part of the exercise name in the data.`;
    } else {
      // Check for day of week in prompt
      const dayKeywords = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      const detectedDay = dayKeywords.find(day => prompt.toLowerCase().includes(day));
      
      let daySpecificPrompt = '';
      
      if (detectedDay) {
        const dayType = getDayWorkoutType(detectedDay);
        
        if (dayType && dayType.includes('Cardio')) {
          // Get cardio exercises from database
          const cardioExercises = await getAvailableExercises(supabase, equipmentList, 'endurance');
          const cardioOptions = cardioExercises.map((ex: Exercise) => ex.name).join(', ');
          daySpecificPrompt = `Today is ${detectedDay.charAt(0).toUpperCase() + detectedDay.slice(1)} and it's a cardio day. Available cardio exercises: ${cardioOptions}.`;
        } else if (dayType) {
          daySpecificPrompt = `Today is ${detectedDay.charAt(0).toUpperCase() + detectedDay.slice(1)} and it's a ${dayType} day. Focus the workout on ${dayType} training.`;
        }
      }

      // Get available exercises for the user
      const availableExercises = await getAvailableExercises(supabase, equipmentList);
      const exerciseOptions = availableExercises.map((ex: Exercise) => `${ex.name} (${ex.category})`).join('\n');
      
      systemPrompt = `You are TrainAI, an expert fitness coach.
      
      User profile: ${profile?.first_name || 'Unknown'}.
      Goals: ${goals?.map((g: any) => g.description).join(', ') || 'None'}.
      Equipment: ${equipmentList.join(', ') || 'None'}.
      ${daySpecificPrompt}
      
      Available exercises for this user:
      ${exerciseOptions}
      
      Create a ${minutes}-minute workout that matches the user's request and available equipment.
      
      IMPORTANT: Use exact exercise names from the available exercises list. Do NOT add "(bodyweight)" to exercise names unless it's explicitly part of the exercise name.`;
    }

    // For now, return a placeholder plan since we removed the OpenAI integration
    const plan = {
      warmup: ['Dynamic stretching', 'Light cardio'],
      workout: ['Main exercise: 3x8', 'Accessory: 3x12'],
      cooldown: ['Static stretching', 'Deep breathing']
    };

    // Save to generated_workouts table
    await supabase.from('generated_workouts').insert({
      user_id: userId,
      minutes: minutes,
      prompt: prompt,
      plan: plan,
      used_model: 'claude-3-5-sonnet',
      is_nike: isNike,
      workout_type: isNike ? 'nike' : null,
      day_of_week: null
    });

    return NextResponse.json(plan);
  } catch (error: any) {
    console.error('Generate workout error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 