import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function getExerciseInstructions(rawName: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("exercises_final")
    .select("name, instruction")
    .ilike("name", `%${rawName}%`)
    .limit(1);

  if (error) {
    console.error("DB error", error);
    return null;
  }
  
  return data?.[0]?.instruction ?? null;
} 