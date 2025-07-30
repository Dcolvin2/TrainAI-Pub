import { supabase } from './supabaseClient';

export async function getExerciseInstruction(raw: string) {
  const cleaned = raw.replace(/^the\s+/i, '').trim();

  console.log('[instr] searching for:', cleaned);   // step 3

  const { data, error } = await supabase
    .from('exercises_final')
    .select('instruction')
    .ilike('name', `%${cleaned}%`)
    .limit(1)
    .single();

  console.log('[instr] data:', data, 'err:', error); // step 5

  if (error || !data?.instruction) return null;
  return data.instruction;
} 