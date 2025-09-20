import type { PlanItem, PlanPhase, WorkoutPlan } from "@/app/lib/types";

// Defaults from your spec
export const REST_BY_PHASE: Record<PlanPhase, number> = {
  warmup: 30, // seconds
  strength: 150, // 2.5 min
  accessory: 90, // 1.5 min
  finisher: 30,
  cooldown: 0,
};

const BLACKLIST = new Set([
  "snatch", "power snatch", "muscle snatch", "clean and jerk", "split jerk"
]);

export function filterBlacklisted(items: PlanItem[]): PlanItem[] {
  return items.filter(i => {
    const n = i.name.toLowerCase();
    for (const b of BLACKLIST) if (n.includes(b)) return false;
    return true;
  });
}

export function hasEquip(equip: string[], keyword: string) {
  const k = keyword.toLowerCase();
  return equip.some(e => e.toLowerCase().includes(k));
}

export function deriveWorkoutTypeFromMessage(msgLower: string): string {
  if (msgLower.includes("back") || msgLower.includes("pull")) return "back";
  if (msgLower.includes("push") || msgLower.includes("chest")) return "push";
  if (msgLower.includes("legs") || msgLower.includes("squat")) return "legs";
  if (msgLower.includes("upper")) return "upper";
  if (msgLower.includes("hiit")) return "hiit";
  return "custom";
}

export function bodyAwareCooldown(msgLower: string): PlanItem[] {
  if (msgLower.includes("back") || msgLower.includes("pull") || msgLower.includes("lat")) {
    return [
      { name: "Cat-Cow", reps: "60s", sets: 1, restSeconds: REST_BY_PHASE.cooldown, isAccessory: true },
      { name: "Child's Pose (Lat Focus)", reps: "60s", sets: 1, restSeconds: REST_BY_PHASE.cooldown, isAccessory: true },
    ];
  }
  
  if (msgLower.includes("legs") || msgLower.includes("squat")) {
    return [
      { name: "Kneeling Hip Flexor Stretch", reps: "60s/side", sets: 1, restSeconds: REST_BY_PHASE.cooldown, isAccessory: true },
      { name: "Seated Hamstring Stretch", reps: "60s/side", sets: 1, restSeconds: REST_BY_PHASE.cooldown, isAccessory: true },
    ];
  }
  
  if (msgLower.includes("push") || msgLower.includes("chest") || msgLower.includes("shoulder")) {
    return [
      { name: "Doorway Pec Stretch", reps: "45s/side", sets: 1, restSeconds: REST_BY_PHASE.cooldown, isAccessory: true },
      { name: "Sleeper Stretch", reps: "45s/side", sets: 1, restSeconds: REST_BY_PHASE.cooldown, isAccessory: true },
    ];
  }
  
  return [{ name: "Box Breathing", reps: "60s", sets: 1, restSeconds: 0, isAccessory: true }];
}

export function computeCounts(phases: Array<{ items: PlanItem[] }>) {
  const all = phases.flatMap(p => p.items);
  const totalSets = all.reduce((acc, it) => acc + (it.sets ?? 1), 0);
  const exercisesCount = all.filter(it => (it.sets ?? 0) > 0).length;
  return { totalSets, exercisesCount };
}

export function estimateMinutes(plan: WorkoutPlan): number {
  // Heuristic: per set ~2.5 min if no explicit rest; phases already carry restSeconds for real timers.
  const all = plan.phases.flatMap(p => p.items);
  const setMins = all.reduce((acc, it) => acc + ((it.sets ?? 0) * 2.5), 0);
  return Math.ceil(setMins);
}

export function trimPlanToDuration(plan: WorkoutPlan, targetMinutes: number): WorkoutPlan {
  if (plan.durationMinutes <= targetMinutes) return plan;
  
  const clone: WorkoutPlan = JSON.parse(JSON.stringify(plan));
  const get = (ph: PlanPhase) => clone.phases.find(p => p.phase === ph);
  const currentEstimate = () => estimateMinutes(clone);
  
  // 1) Remove accessory items
  const acc = get("accessory");
  if (acc) {
    while (acc.items.length > 0 && currentEstimate() > targetMinutes) {
      acc.items.pop();
    }
  }
  
  // 2) Reduce strength sets
  const st = get("strength");
  if (st) {
    for (const it of st.items) {
      if (currentEstimate() <= targetMinutes) break;
      if (typeof it.sets === "number" && it.sets > 1) it.sets -= 1;
    }
  }
  
  clone.durationMinutes = targetMinutes;
  return clone;
}
