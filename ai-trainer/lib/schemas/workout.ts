/* Strict, dependency-free JSON contract + validator for workout plans */

export type PhaseName = "warmup" | "strength" | "accessory" | "cooldown";

export interface WorkoutItem {
  name: string;
  sets?: string | number;
  reps?: string | number;
  duration?: string | number;
  instruction?: string;
  isAccessory?: boolean;
  // Allow additional fields (e.g., last/suggested) without failing validation:
  [k: string]: unknown;
}

export interface PlanPhase {
  phase: PhaseName;
  items: WorkoutItem[];
}

export interface WorkoutPlan {
  split: string; // e.g., push, pull, legs, upper, hiit
  duration: number; // minutes
  phases: PlanPhase[]; // must contain all required phases (except HIIT no-main-lift exception handled upstream)
}

export type ValidationResult =
  | { ok: true }
  | { ok: false; error: string };

function isString(x: unknown): x is string {
  return typeof x === "string";
}
function isNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}
function isObject(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object";
}
function isArray(x: unknown): x is unknown[] {
  return Array.isArray(x);
}

export function validateWorkoutPlan(input: unknown): ValidationResult {
  if (!isObject(input)) return { ok: false, error: "Plan must be an object" };
  const { split, duration, phases } = input as Record<string, unknown>;

  if (!isString(split) || split.trim() === "") {
    return { ok: false, error: "split must be a non-empty string" };
  }
  if (!isNumber(duration) || duration <= 0) {
    return { ok: false, error: "duration must be a positive number" };
  }
  if (!isArray(phases) || phases.length === 0) {
    return { ok: false, error: "phases must be a non-empty array" };
  }

  for (const p of phases) {
    if (!isObject(p)) return { ok: false, error: "phase must be an object" };
    const phase = (p as Record<string, unknown>).phase;
    const items = (p as Record<string, unknown>).items;
    if (!isString(phase)) return { ok: false, error: "phase.phase must be a string" };
    if (!isArray(items)) return { ok: false, error: "phase.items must be an array" };

    for (const it of items) {
      if (!isObject(it)) return { ok: false, error: "item must be an object" };
      const name = (it as Record<string, unknown>).name;
      if (!isString(name) || name.trim() === "") {
        return { ok: false, error: "item.name must be a non-empty string" };
      }
      const sets = (it as Record<string, unknown>).sets;
      const reps = (it as Record<string, unknown>).reps;
      const durationStr = (it as Record<string, unknown>).duration;
      if (sets !== undefined && !(isString(sets) || isNumber(sets))) {
        return { ok: false, error: "item.sets must be string|number if present" };
      }
      if (reps !== undefined && !(isString(reps) || isNumber(reps))) {
        return { ok: false, error: "item.reps must be string|number if present" };
      }
      if (durationStr !== undefined && !(isString(durationStr) || isNumber(durationStr))) {
        return { ok: false, error: "item.duration must be string|number if present" };
      }
    }
  }

  return { ok: true };
}
