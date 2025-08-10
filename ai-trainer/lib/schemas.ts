import { z } from 'zod';

export const PhaseItem = z.object({
  name: z.string(),
  sets: z.union([z.number(), z.string()]).optional(),
  reps: z.string().optional(),
  duration: z.string().optional(),
  instruction: z.string().optional(),
  isAccessory: z.boolean().optional(),
  substitutions: z.array(z.string()).optional(),
});

export const Phase = z.object({
  phase: z.enum(['warmup','main','accessory','conditioning','cooldown']),
  items: z.array(PhaseItem).min(1),
});

export const PlanSchema = z.object({
  name: z.string(),
  duration_min: z.number().int().positive(),
  phases: z.array(Phase).min(3),
  progression_tip: z.string().optional(),
});

export type Plan = z.infer<typeof PlanSchema>;
