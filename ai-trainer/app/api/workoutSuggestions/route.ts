import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  try {
    // Get workout suggestions based on recent training
    const { data: recentWorkouts, error: workoutsError } = await supabase
      .from('workouts')
      .select(`
        workout_type_id,
        created_at,
        workout_types!inner(name, target_muscles)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (workoutsError) {
      console.error('Error fetching recent workouts:', workoutsError);
      return NextResponse.json({ error: 'Failed to fetch workout history' }, { status: 500 });
    }

    // Analyze patterns and suggest next workout
    const suggestion = analyzeWorkoutPatterns(recentWorkouts);
    
    return NextResponse.json({ suggestion });
  } catch (error) {
    console.error('Error in workout suggestions API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function analyzeWorkoutPatterns(recentWorkouts: any[]) {
  if (recentWorkouts.length === 0) {
    return { type: 'push', reason: 'Start with a classic push day' };
  }

  // Get the last workout type
  const lastWorkout = recentWorkouts[0];
  const lastWorkoutType = lastWorkout.workout_types?.name;

  // Count days since each muscle group was trained
  const muscleGroupCounts: Record<string, number> = {};
  const today = new Date();

  recentWorkouts.forEach(workout => {
    const workoutDate = new Date(workout.created_at);
    const daysSince = Math.floor((today.getTime() - workoutDate.getTime()) / (1000 * 60 * 60 * 24));
    
    const targetMuscles = workout.workout_types?.target_muscles || [];
    targetMuscles.forEach((muscle: string) => {
      if (!muscleGroupCounts[muscle] || muscleGroupCounts[muscle] > daysSince) {
        muscleGroupCounts[muscle] = daysSince;
      }
    });
  });

  // Suggest based on last workout and muscle group needs
  if (lastWorkoutType === 'push') {
    return { type: 'pull', reason: 'Natural progression after push day' };
  }
  
  if (lastWorkoutType === 'pull') {
    return { type: 'legs', reason: 'Time for leg day after pull' };
  }
  
  if (lastWorkoutType === 'legs') {
    return { type: 'push', reason: 'Back to push after leg day' };
  }

  // Suggest based on muscle group needs
  const muscleGroupNeeds = Object.entries(muscleGroupCounts)
    .filter(([_, days]) => days >= 3) // Muscle groups not trained in 3+ days
    .sort(([_, a], [__, b]) => b - a); // Sort by days since training

  if (muscleGroupNeeds.length > 0) {
    const [muscleGroup, daysSince] = muscleGroupNeeds[0];
    
    // Map muscle groups to workout types
    const muscleToWorkoutType: Record<string, string> = {
      'chest': 'push',
      'shoulders': 'push',
      'triceps': 'push',
      'back': 'pull',
      'biceps': 'pull',
      'quads': 'legs',
      'hamstrings': 'legs',
      'glutes': 'legs',
      'calves': 'legs'
    };

    const suggestedType = muscleToWorkoutType[muscleGroup];
    if (suggestedType) {
      return { 
        type: suggestedType, 
        reason: `${muscleGroup} hasn't been trained in ${daysSince} days` 
      };
    }
  }

  // Default suggestion
  return { type: 'push', reason: 'Classic push day to start your week' };
} 