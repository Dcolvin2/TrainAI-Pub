// lib/planSchema.ts
import { z } from "zod";

export const PhaseEnum = z.enum(["warmup","main","accessory","conditioning","cooldown"]);

const numOrNumericString = z.union([z.number(), z.string().regex(/^\d+$/)]);

export const PlanItem = z.object({
  name: z.string().min(1),
  sets: z.union([numOrNumericString, z.undefined()]),
  reps: z.union([z.string(), z.number(), z.undefined()]),
  duration: z.string().optional(),            // e.g. "45s", "6/side"
  instruction: z.string().optional(),
  isAccessory: z.boolean().optional(),
}).passthrough();                               // ignore extra keys instead of failing

export const PhaseBlock = z.object({
  phase: PhaseEnum,
  items: z.array(PlanItem).min(1),
});

export const PlanSchema = z.object({
  name: z.string(),
  duration_min: numOrNumericString,
  phases: z.array(PhaseBlock).min(1),
}).passthrough();

export type Plan = z.infer<typeof PlanSchema>;
