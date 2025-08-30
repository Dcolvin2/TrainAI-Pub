// utils/normalizeWorkoutResponse.ts
export type NormalizedWorkout = {
  ok: boolean;
  name?: string;
  message?: string;
  coach?: string;
  chatMsg?: string;
  plan?: any;
  workout: {
    warmup: Array<{ name: string; sets?: number | string; reps?: string; duration?: string; instruction?: string }>;
    mainExercises: Array<{ name: string; sets?: number | string; reps?: string; duration?: string; instruction?: string; isAccessory?: boolean }>;
    finisher?: { name: string; sets?: number | string; reps?: string; duration?: string };
  };
  debug?: any;
  error?: string | null;
};

function arr<T>(v: any): T[] {
  return Array.isArray(v) ? v : v ? [v] : [];
}

function asItem(v: any) {
  const name = v?.name ?? v?.exercise ?? '';
  return {
    name,
    sets: v?.sets,
    reps: v?.reps,
    duration: v?.duration,
    instruction: v?.instruction,
    isAccessory: !!v?.isAccessory,
  };
}

export function normalizeWorkoutResponse(raw: any): NormalizedWorkout {
  const warmup = arr(raw?.workout?.warmup).map(asItem);
  const main = arr(raw?.workout?.mainExercises).map(asItem);
  const f = raw?.workout?.finisher;
  const finisher = f ? { name: f.name ?? f.exercise ?? '', sets: f.sets, reps: f.reps, duration: f.duration } : undefined;

  return {
    ok: !!raw?.ok,
    name: raw?.name ?? raw?.plan?.name,
    message: raw?.message,
    coach: raw?.coach,
    chatMsg: raw?.chatMsg,
    plan: raw?.plan,
    workout: { warmup, mainExercises: main, finisher },
    debug: raw?.debug,
    error: raw?.error ?? null,
  };
}
