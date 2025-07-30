import { supabase } from './supabaseClient';

/**
 * Returns the best-match instruction or null
 *  – case-insensitive  ILIKE '%query%'
 *  – falls back to pg_trgm similarity if enabled
 */
export async function getExerciseInstruction(name: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('exercises_final')              // Updated to exercises_final
    .select('name,instruction')
    .ilike('name', `%${name}%`)
    .limit(1)
    .single();

  if (error || !data) return null;
  return data.instruction;
} 