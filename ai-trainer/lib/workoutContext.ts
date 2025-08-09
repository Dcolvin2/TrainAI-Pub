// lib/workoutContext.ts
import { supabase } from '@/lib/supabaseClient';

export type ProfileCtx = {
  preferred_workout_duration: number;
  training_goal: string | null;
  fitness_level: string | null;
};

export type AllowedExercise = {
  id: string;
  name: string;
  muscle_group: string | null;
  required_equipment: string[];
};

const norm = (x: string) => x.trim().toLowerCase();

export async function getUserContext(userId: string) {
  const [{ data: profileRow }, { data: userEquip }, { data: exRows }] = await Promise.all([
    supabase
      .from('profiles')
      .select('preferred_workout_duration, training_goal, fitness_level')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('user_equipment')
      .select('equipment:equipment_id(name)')
      .eq('user_id', userId),
    supabase
      .from('exercises')
      .select('id, name, muscle_group, required_equipment')
  ]);

  const availableEquipment = (userEquip ?? [])
    .map((r: any) => r.equipment?.name)
    .filter(Boolean)
    .map(String);

  const availSet = new Set(availableEquipment.map(norm));

  const allowedExercises: AllowedExercise[] = (exRows ?? [])
    .filter((ex: any) => {
      const req = Array.isArray(ex.required_equipment) ? (ex.required_equipment as string[]) : [];
      if (req.length === 0) return true; // bodyweight OK
      return req.every((e) => availSet.has(norm(String(e))));
    })
    .map((ex: any) => ({
      id: ex.id,
      name: ex.name,
      muscle_group: ex.muscle_group ?? null,
      required_equipment: Array.isArray(ex.required_equipment) ? ex.required_equipment : []
    }));

  const profile: ProfileCtx = {
    preferred_workout_duration: profileRow?.preferred_workout_duration ?? 45,
    training_goal: profileRow?.training_goal ?? null,
    fitness_level: profileRow?.fitness_level ?? null
  };

  return { profile, availableEquipment, allowedExercises };
}


