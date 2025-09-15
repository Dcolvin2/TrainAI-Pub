/* Pure business-logic helpers for the workout generator flow */

export function mainLiftForSplit(split: string, equipment: string[]): string | null {
  const s = (split || "").toLowerCase();
  const has = (needle: string) =>
    equipment.some(e => e.toLowerCase().includes(needle));

  switch (s) {
    case "push":
      if (has("barbell")) return "Barbell Bench Press";
      if (has("dumbbell")) return "Dumbbell Bench Press";
      return "Push-Up";
    case "pull":
      if (has("trap")) return "Trap Bar Deadlift";
      if (has("barbell")) return "Barbell Deadlift";
      return "Romanian Deadlift (DB)";
    case "legs":
      if (has("belt")) return "Belt Squat";
      if (has("barbell")) return "Back Squat";
      return "Goblet Squat";
    case "upper":
      return has("barbell") ? "Overhead Press" : "Dumbbell Shoulder Press";
    case "hiit":
      return null;
    default:
      return null;
  }
}

export function focusMusclesForSplit(split: string): string[] {
  switch ((split || "").toLowerCase()) {
    case "push": return ["chest", "shoulders", "triceps"];
    case "pull": return ["back", "lats", "biceps", "posterior_chain"];
    case "legs": return ["quads", "hamstrings", "glutes", "adductors", "calves"];
    case "upper": return ["shoulders", "chest", "back", "triceps", "biceps"];
    case "hiit": return ["full_body"];
    default: return [];
  }
}

/** Select cooldowns from an available list of exercises (already fetched from DB) */
export function selectCooldowns(
  allExercises: Array<{
    name: string;
    exercise_phase?: string;
    primary_muscle?: string;
    target_muscles?: string[];
  }>,
  focus: string[],
  limit = 3
) {
  const fset = new Set(focus.map(m => m.toLowerCase()));
  const candidates = allExercises.filter(ex =>
    (ex.exercise_phase || "").toLowerCase() === "cooldown" &&
    (
      (ex.primary_muscle && fset.has(ex.primary_muscle.toLowerCase())) ||
      (Array.isArray(ex.target_muscles) && ex.target_muscles.some(m => fset.has(String(m).toLowerCase())))
    )
  );
  return candidates.slice(0, Math.max(0, limit));
}

/** Trim a plan to a target duration by cutting accessories first, then strength volume */
export function trimPlanToDuration<T extends {
  split: string;
  duration: number;
  phases: Array<{ phase: string; items: Array<Record<string, unknown>> }>;
}>(plan: T, targetMinutes: number): T {
  if (plan.duration <= targetMinutes) return plan;

  const clone: T = JSON.parse(JSON.stringify(plan));
  const get = (name: string) => clone.phases.find(p => p.phase === name);

  // 1) Cut accessories
  const accessory = get("accessory");
  if (accessory) {
    while (accessory.items.length > 0 && estimateMinutes(clone) > targetMinutes) {
      accessory.items.pop();
    }
  }

  // 2) Trim strength items (reduce sets field if present)
  const strength = get("strength");
  if (strength) {
    for (const it of strength.items) {
      if (estimateMinutes(clone) <= targetMinutes) break;
      const sets = it["sets"];
      if (typeof sets === "number" && sets > 1) it["sets"] = sets - 1;
      if (typeof sets === "string") {
        const n = parseInt(sets, 10);
        if (!Number.isNaN(n) && n > 1) it["sets"] = String(n - 1);
      }
    }
  }

  // Final: reset duration to target to reflect intent
  clone.duration = targetMinutes;
  return clone;
}

function estimateMinutes(plan: { phases: Array<{ items: Array<Record<string, unknown>> }> }): number {
  // Heuristic: sets ~2.5 min each; duration strings try to parse minutes
  let mins = 0;
  for (const ph of plan.phases) {
    for (const it of ph.items) {
      const sets = it["sets"];
      const duration = it["duration"];
      if (typeof sets === "number") mins += sets * 2.5;
      else if (typeof sets === "string") {
        const n = parseInt(sets, 10);
        if (!Number.isNaN(n)) mins += n * 2.5;
      }
      if (typeof duration === "number") mins += duration;
      else if (typeof duration === "string") {
        const m = duration.match(/(\d+)\s*min/gi);
        if (m) mins += m.map(x => parseInt(x, 10)).filter(n => !Number.isNaN(n)).reduce((a, b) => a + b, 0);
      }
    }
  }
  return Math.ceil(mins);
}
