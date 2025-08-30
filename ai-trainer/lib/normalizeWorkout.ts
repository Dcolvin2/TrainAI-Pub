// lib/normalizeWorkout.ts
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

function ensureSingleMain(list: WorkoutItem[]) {
  if (!list?.length) return list;
  if (list.some(i => i.is_main === true)) return list.map(i => ({ ...i, is_main: !!i.is_main }));
  return list.map((i, idx) => ({ ...i, is_main: idx === 0 }));
}

export function normalizeWorkout(resp: any): WorkoutShape {
  const w = resp?.workout ?? {};
  const w1 = {
    warmup: arr(w.warmup).map(fix).filter(Boolean) as WorkoutItem[],
    main: arr(w.main).map(fix).filter(Boolean) as WorkoutItem[],
    cooldown: arr(w.cooldown).map(fix).filter(Boolean) as WorkoutItem[],
  };
  if (w1.warmup.length + w1.main.length + w1.cooldown.length > 0) {
    return { ...w1, main: ensureSingleMain(w1.main) };
  }

  const phases = arr(resp?.plan?.phases);
  const pick = (p: string) => arr(phases.find((x: any) => x?.phase === p)?.items).map(fix).filter(Boolean) as WorkoutItem[];

  const warmup = [...pick('prep'), ...pick('activation')];
  let main = pick('strength');
  if (main.length === 0) main = pick('conditioning');
  const cooldown = pick('cooldown');

  return { warmup, main: ensureSingleMain(main), cooldown };
}
