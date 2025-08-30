export type WorkoutItem = { 
  name: string; 
  sets?: number; 
  reps?: string|number; 
  duration_seconds?: number; 
  instruction?: string|null; 
  rest_seconds?: number|null 
};

export type WorkoutShape = { 
  warmup: WorkoutItem[]; 
  main: WorkoutItem[]; 
  cooldown: WorkoutItem[] 
};

type PhaseName = 'prep'|'activation'|'strength'|'carry_block'|'conditioning'|'cooldown';

export function normalizeWorkout(resp: any): WorkoutShape {
  const safeArr = (x: any) => Array.isArray(x) ? x : [];
  const fixName = (it: any): WorkoutItem | null => {
    if (!it) return null;
    const n = it.name ?? it.exercise ?? null;
    if (!n || typeof n !== 'string') return null;
    const out: WorkoutItem = { name: n };
    if (it.sets != null) out.sets = it.sets;
    if (it.reps != null) out.reps = it.reps;
    if (it.duration_seconds != null) out.duration_seconds = it.duration_seconds;
    if (it.instruction != null) out.instruction = it.instruction;
    if (it.rest_seconds != null) out.rest_seconds = it.rest_seconds;
    return out;
  };

  // 1) Prefer explicit workout block
  const w = resp?.workout ?? {};
  const workoutFirst: WorkoutShape = {
    warmup: safeArr(w.warmup).map(fixName).filter(Boolean) as WorkoutItem[],
    main: safeArr(w.main).map(fixName).filter(Boolean) as WorkoutItem[],
    cooldown: safeArr(w.cooldown).map(fixName).filter(Boolean) as WorkoutItem[],
  };
  const haveFirst = workoutFirst.warmup.length + workoutFirst.main.length + workoutFirst.cooldown.length > 0;
  if (haveFirst) return workoutFirst;

  // 2) Fall back to phases
  const phases = safeArr(resp?.plan?.phases);
  const pick = (p: PhaseName) => {
    const section = phases.find((x: any) => x?.phase === p);
    return safeArr(section?.items).map(fixName).filter(Boolean) as WorkoutItem[];
  };

  const warmup = [...pick('prep'), ...pick('activation')];
  let main = pick('strength');
  if (main.length === 0) main = pick('conditioning');
  const cooldown = pick('cooldown');

  return { warmup, main, cooldown };
}
