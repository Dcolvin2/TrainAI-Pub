import { supabase } from "@/lib/supabaseClient";

export async function fetchInstructions(name: string): Promise<string | null> {
  const { data } = await supabase
    .from("exercises")
    .select("instruction")
    .ilike("name", `%${name}%`)
    .maybeSingle();

  return data?.instruction ?? null;
} 