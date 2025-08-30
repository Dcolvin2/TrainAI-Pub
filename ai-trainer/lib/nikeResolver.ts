import { supabase } from '@/lib/supabaseClient';
import { extractNikeHints } from '@/lib/nlpLite';

type NikeResolved =
  | { ok: true; rows: any[] }
  | { ok: false; reason: string; suggestion?: any };

export async function resolveNikeFromNL(nl: string, llmGuess?: { index?: number; type?: string; descriptors?: string[]; confidence: number }): Promise<NikeResolved> {
  // Heuristics from text
  const { index, typeHint, keywords } = extractNikeHints(nl);

  // Merge LLM guess + heuristics
  const useIndex = llmGuess?.index ?? index;
  const type = (llmGuess?.type ?? typeHint)?.toLowerCase();

  // Confidence gate: only auto-run Nike if high confidence OR explicit ordinal + clear type
  const confident = (llmGuess?.confidence ?? 0) >= 0.8 || (useIndex && type);

  if (!confident) return { 
    ok: false, 
    reason: 'low_confidence', 
    suggestion: { index: useIndex ?? null, type: type ?? null, keywords } 
  };

  // Look up in your table
  // Table: nike_workouts(workout int, workout_type text, sets, reps, exercise, instructions, exercise_type, exercise_phase)
  let q = supabase.from('nike_workouts').select('*').eq('workout', useIndex ?? 1);

  if (type) q = q.ilike('workout_type', `%${type}%`);

  // Optional: descriptors like 'eccentric' in instructions or exercise_type
  const hasEcc = [...(llmGuess?.descriptors ?? []), ...keywords].some(k => k.includes('eccent'));
  if (hasEcc) {
    // Prefer rows that mention eccentric somewhere
    q = q.or('instructions.ilike.%eccent%,exercise_type.ilike.%eccent%');
  }

  const { data, error } = await q;
  if (error || !data || data.length === 0) return { ok: false, reason: 'not_found' };

  return { ok: true, rows: data as any[] };
}

export function rowsToWorkout(rows: any[]): { plan: any; workout: any } {
  // Group by exercise_phase
  const warmup = rows.filter(r => r.exercise_phase === 'warmup').map(r => ({
    name: r.exercise,
    sets: r.sets,
    reps: r.reps,
    instruction: r.instructions,
    duration: r.duration
  }));
  
  const main = rows.filter(r => r.exercise_phase === 'main').map(r => ({
    name: r.exercise,
    sets: r.sets,
    reps: r.reps,
    instruction: r.instructions,
    isAccessory: r.exercise_type === 'accessory'
  }));
  
  const cooldown = rows.filter(r => r.exercise_phase === 'cooldown').map(r => ({
    name: r.exercise,
    sets: r.sets,
    reps: r.reps,
    instruction: r.instructions,
    duration: r.duration
  }));

  const plan = {
    name: `Nike Workout ${rows[0]?.workout || 1}`,
    phases: [
      { phase: 'warmup', items: warmup },
      { phase: 'main', items: main },
      { phase: 'cooldown', items: cooldown }
    ]
  };

  const workout = {
    warmup,
    main,
    cooldown
  };

  return { plan, workout };
}
