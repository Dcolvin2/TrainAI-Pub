import { supabase } from '@/lib/supabaseClient';

/**
 * Returns instruction text or `null` if not found.
 *  - Strips a leading "the "
 *  - Always queries public.exercises_final
 */
export async function getExerciseInstruction(msg: string) {
  // 1 Clean phrase
  const cleaned = msg
    .replace(/^how\s+do\s+i\s+(?:perform|do)\s+/i, '')
    .replace(/^(the\s+)/i, '')
    .replace(/\?$/, '')
    .trim();

  console.log('[instr] cleaned →', cleaned);

  // 2 DB hit
  const { data, error } = await supabase
    .from('exercises_final')
    .select('instruction')
    .ilike('name', `%${cleaned}%`)
    .limit(1)
    .single();

  console.log('[instr] data:', data, 'error:', error);

  return data?.instruction ?? null;
} 