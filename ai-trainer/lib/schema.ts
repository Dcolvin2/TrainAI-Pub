// lib/schema.ts
import { z } from 'zod';

export const WarmItem = z.object({
  name: z.string(),
  sets: z.union([z.string(), z.number()]).optional(),
  reps: z.string().optional(),
  duration: z.string().optional(),
  instruction: z.string().optional(),
});

export const MainItem = WarmItem.extend({
  isAccessory: z.boolean(),
});

export const PlanOut = z.object({
  split: z.enum(['pull','push','legs','upper','full','hiit']),
  duration: z.number(),
  name: z.string(),
  main_lift: z.string().optional(),
});

export const WorkoutOut = z.object({
  warmup: z.array(WarmItem),
  mainExercises: z.array(MainItem).min(1),
  finisher: WarmItem.optional(),
});

export const ResponseOut = z.object({
  ok: z.literal(true),
  name: z.string(),
  message: z.string(),
  coach: z.string(),
  plan: PlanOut,
  workout: WorkoutOut,
});

export type Resp = z.infer<typeof ResponseOut>;

export function budget(total: number) {
  const warmup = Math.min(10, Math.max(5, Math.round(total * 0.18)));
  const main = Math.round(total * 0.42);
  const cooldown = Math.max(3, Math.round(total * 0.10));
  const accessories = Math.max(6, total - warmup - main - cooldown);
  return { warmup, main, accessories, cooldown };
}

export function phasesFromWorkout(w: any) {
  const warm = Array.isArray(w?.warmup) ? w.warmup : [];
  const main = Array.isArray(w?.mainExercises) ? w.mainExercises : [];
  const fin  = w?.finisher ? [w.finisher] : [];
  return [
    { phase: 'prep',       items: warm },
    { phase: 'strength',   items: main },
    { phase: 'activation', items: [] },
    { phase: 'carry',      items: fin },
  ];
}
