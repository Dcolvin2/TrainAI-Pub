import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/** Returns { equipment:Set<string>, exercises: ExerciseRow[] } */
export async function fetchEquipmentAndExercises(userId: string) {
  const { data: eq } = await supabase
    .from("user_equipment")
    .select("equipment!inner(name)")
    .eq("user_id", userId);
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userEq = new Set((eq as any[])?.map(r => r.equipment.name) || []);

  const { data: ex } = await supabase.from("exercises").select("*");
  const exercises = ex?.filter(e => {
    if (!e.equipment_required?.length) return true;          // body-weight
    return e.equipment_required.every((req: string) => userEq.has(req));
  }) || [];

  return { equipment: userEq, exercises };
} 