// src/utils/normalizeWorkout.ts
export type WorkoutItem = {
  name: string;
  sets?: number;
  reps?: string | number;
  duration_seconds?: number;
  instruction?: string | null;
  rest_seconds?: number | null;
  is_main?: boolean;
};
export type WorkoutShape = { warmup: WorkoutItem[]; main: WorkoutItem[]; cooldown: WorkoutItem[] };

const arr = (x: any) => (Array.isArray(x) ? x : []);
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

function ensureSingleMainBadge(list: WorkoutItem[]): WorkoutItem[] {
  if (!list?.length) return list;
  // If any item already flags is_main, respect that; otherwise mark only the first.
  const already = list.some(it => it.is_main === true);
  if (already) return list.map(it => ({ ...it, is_main: !!it.is_main }));
  return list.map((it, i) => ({ ...it, is_main: i === 0 }));
}

export function normalizeWorkout(resp: any): WorkoutShape {
  // 1) Prefer explicit workout block
  const w = resp?.workout ?? {};
  const warmup1 = arr(w.warmup).map(fix).filter(Boolean) as WorkoutItem[];
  const main1 = arr(w.main).map(fix).filter(Boolean) as WorkoutItem[];
  const cooldown1 = arr(w.cooldown).map(fix).filter(Boolean) as WorkoutItem[];
  if (warmup1.length + main1.length + cooldown1.length > 0) {
    return { warmup: warmup1, main: ensureSingleMainBadge(main1), cooldown: cooldown1 };
  }

  // 2) Fallback to plan.phases
  const phases = arr(resp?.plan?.phases);
  const pick = (p: string) => arr(phases.find((x: any) => x?.phase === p)?.items).map(fix).filter(Boolean) as WorkoutItem[];
  const warmup = [...pick('prep'), ...pick('activation')];
  let main = pick('strength');
  if (main.length === 0) main = pick('conditioning');
  const cooldown = pick('cooldown');
  return { warmup, main: ensureSingleMainBadge(main), cooldown };
}
