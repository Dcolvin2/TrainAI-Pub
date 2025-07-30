import { supabase } from '@/lib/supabaseClient';
import { ExerciseRow, Exercise, toExercise } from "@/types/Exercise";

interface EquipmentAndExercises {
  equipment: Set<string>;
  exercises: Exercise[];
}

/** Returns { equipment:Set<string>, exercises: Exercise[] } */
export async function fetchEquipmentAndExercises(userId: string): Promise<EquipmentAndExercises> {
  const { data: eq } = await supabase
    .from("user_equipment")
    .select("equipment!inner(name)")
    .eq("user_id", userId);
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userEq = new Set((eq as any[])?.map(r => r.equipment.name) || []);

  const { data: ex } = await supabase.from("exercises_final").select("*");
  const exercises = ex?.filter(e => {
    if (!e.equipment_required?.length) return true;          // body-weight
    return e.equipment_required.every((req: string) => userEq.has(req));
  }).map(toExercise) || [];

  return { equipment: userEq, exercises };
} 