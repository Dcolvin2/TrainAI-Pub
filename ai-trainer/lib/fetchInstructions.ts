import { supabase } from "@/lib/supabaseClient";

export async function fetchInstructions(name: string): Promise<string | null> {
  const { data } = await supabase
    .from("exercises")
    .select("instruction_text")
    .ilike("name", `%${name}%`)
    .maybeSingle();

  return data?.instruction_text ?? null;
} 