import { supabase } from '@/lib/supabaseClient';

export async function getExerciseInstruction(msg: string) {
  // 1. remove leading "how do i …", then leading articles a/an/the
  const cleaned = msg
    .replace(/^how\s+do\s+i\s+(?:perform|do)\s+/i, '')
    .replace(/^(the|a|an)\s+/i, '')
    .replace(/\?$/, '')
    .trim();

  console.log('[instr] cleaned →', cleaned);           // keep for smoke test

  // 2. query the new table
  const { data, error } = await supabase
    .from('exercises')
    .select('instruction')
    .ilike('name', `%${cleaned}%`)
    .limit(1)
    .maybeSingle();                // ← tolerates 0 or >1 rows

  console.log('[instr] data:', data, 'error:', error); // smoke log

  return data?.instruction ?? null;
} 