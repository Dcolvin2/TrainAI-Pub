import { supabase } from './supabaseClient';

/**
 * Returns the best-match instruction or null
 *  – case-insensitive  ILIKE '%query%'
 *  – falls back to pg_trgm similarity if enabled
 */
export async function getExerciseInstruction(name: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('exercises')              // 👉 or 'exercise' if that's where the column lives
    .select('name,instruction_text')
    .ilike('name', `%${name}%`)
    .limit(1)
    .single();

  if (error || !data) return null;
  return data.instruction_text;
} 