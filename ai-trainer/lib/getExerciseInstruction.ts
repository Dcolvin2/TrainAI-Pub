import { supabase } from './supabaseClient';

/**
 * Fetches the instruction text from exercises_final.
 * Returns null if not found.
 */
export async function getExerciseInstruction(exName: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('exercises_final')
    .select('instruction')
    .ilike('name', `%${exName}%`)
    .limit(1)
    .single();

  if (error || !data?.instruction) {
    console.warn('No instruction found for', exName, error);
    return null;
  }
  return data.instruction;
} 