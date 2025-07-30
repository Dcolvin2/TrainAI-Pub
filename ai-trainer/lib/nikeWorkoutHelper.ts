import { supabase } from '@/lib/supabaseClient';

interface NikeWorkoutRow {
  workout: number;
  workout_type: string;
  sets: number;
  reps: string;
  exercise: string;
  exercise_type: string;
  instructions?: string;
  exercise_phase?: string;
}

interface NikeWorkoutResult {
  data: NikeWorkoutRow[] | null;
  error: Error | null;
}

export async function fetchNikeWorkout(workoutNo: number): Promise<NikeWorkoutResult> {
  const { data, error } = await supabase
    .from("nike_workouts")          // <— correct table
    .select("*")
    .eq("workout", workoutNo)       // integer filter
    .order("sets", { ascending: true }); // optional

  console.info("NIKE rows", workoutNo, data?.length, error);
  return { data, error };
} 