export type WorkoutItem = {
  name: string;
  sets?: number;
  reps?: string | number;
  duration_seconds?: number;
  instruction?: string | null;
  rest_seconds?: number | null;
  is_main?: boolean;
};

export type WorkoutShape = { 
  warmup: WorkoutItem[]; 
  main: WorkoutItem[]; 
  cooldown: WorkoutItem[] 
};

type PhaseName = 'prep'|'activation'|'strength'|'carry_block'|'conditioning'|'cooldown';

// Ensure exactly one main lift badge.
// If any item already has is_main=true (e.g., from DB), respect that.
// Otherwise, mark only the first main item.
function ensureSingleMainBadge(list: WorkoutItem[]): WorkoutItem[] {
  if (!list?.length) return list;
  const already = list.some(it => it.is_main === true);
  if (already) {
    return list.map(it => ({ ...it, is_main: !!it.is_main }));
  }
  return list.map((it, i) => ({ ...it, is_main: i === 0 }));
}

export function normalizeWorkout(resp: any): WorkoutShape {
  const arr = (x: any) => Array.isArray(x) ? x : [];
  const fix = (it: any): WorkoutItem | null => {
    if (!it) return null;
    const name = it.name ?? it.exercise;
    if (!name || typeof name !== 'string') return null;
    return {
      name,
      sets: it.sets ?? undefined,
      reps: it.reps ?? undefined,
      duration_seconds: it.duration_seconds ?? undefined,
      instruction: it.instruction ?? null,
      rest_seconds: it.rest_seconds ?? null,
      is_main: it.is_main ?? (it.exercise_phase ? String(it.exercise_phase).toLowerCase() === 'main' : undefined),
    };
  };

  // Prefer resp.workout
  const w = resp?.workout ?? {};
  const w1: WorkoutShape = {
    warmup: arr(w.warmup).map(fix).filter(Boolean) as WorkoutItem[],
    main: arr(w.main).map(fix).filter(Boolean) as WorkoutItem[],
    cooldown: arr(w.cooldown).map(fix).filter(Boolean) as WorkoutItem[],
  };
  if (w1.warmup.length + w1.main.length + w1.cooldown.length > 0) {
    w1.main = ensureSingleMainBadge(w1.main);
    return w1;
  }

  // Fallback: plan.phases
  const phases = arr(resp?.plan?.phases);
  const pick = (p: PhaseName) => arr(phases.find((x: any) => x?.phase === p)?.items).map(fix).filter(Boolean) as WorkoutItem[];

  const warmup = [...pick('prep'), ...pick('activation')];
  let main = pick('strength');
  if (main.length === 0) main = pick('conditioning');
  const cooldown = pick('cooldown');

  main = ensureSingleMainBadge(main);

  return { warmup, main, cooldown };
}
