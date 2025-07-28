import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function fetchNikeWorkout(workoutNo: number) {
  const { data, error } = await supabase
    .from("nike_workouts")          // <— correct table
    .select("*")
    .eq("workout", workoutNo)       // integer filter
    .order("sets", { ascending: true }); // optional

  console.debug("NIKE rows", workoutNo, data?.length, error);
  return { data, error };
} 