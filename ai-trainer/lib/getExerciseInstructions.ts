import { supabase } from '@/lib/supabaseClient';

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