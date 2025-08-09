// lib/types.ts
export type PlanSet = {
  set_number?: number; // optional for simple phases
  reps?: number | string | null;
  prescribed_weight?: number | string | null;
  rest_seconds?: number | null;
};

export type PlanItem = {
  exercise_id?: string | null;  // may be absent if we only have names
  name: string;                  // display name for your UI
  sets: string | number;
  reps?: string | number;
  instruction?: string | null;
  isAccessory?: boolean;
};

export type PlanPhaseName = 'warmup' | 'main' | 'accessory' | 'conditioning' | 'cooldown';

export type PlanPhase = {
  phase: PlanPhaseName;
  items: PlanItem[];
};

export type StrictPlan = {
  name: string;
  duration_min: number;
  phases: PlanPhase[];
  est_total_minutes: number;
};
