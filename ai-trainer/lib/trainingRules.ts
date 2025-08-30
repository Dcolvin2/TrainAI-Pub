// ai-trainer/lib/trainingRules.ts
export type Split =
  | "push" | "pull" | "legs" | "upper" | "full" | "hiit";

export const MAIN_LIFTS: Record<Exclude<Split, "hiit">, string[]> = {
  push: [
    "Barbell Bench Press",
    "Barbell Incline Press",
    "Dumbbell Bench Press",
    "Dumbbell Incline Bench Press",
  ],
  pull: [
    "Barbell Deadlift",
    "Trap Bar Deadlift",
  ],
  legs: [
    "Barbell Back Squat",
    "Belt Squat",
    "Barbell Front Squat",
  ],
  upper: [
    "Shoulder Press",
  ],
  full: [
    "Barbell Back Squat",
    "Barbell Deadlift",
    "Trap Bar Deadlift",
    "Barbell Bench Press",
    "Dumbbell Bench Press",
    "Shoulder Press",
  ],
};

export function isHiit(split: string | undefined) {
  return (split ?? "").toLowerCase() === "hiit";
}

export function canonicalSplit(raw?: string): Split | undefined {
  const x = (raw ?? "").toLowerCase();
  if (["push","pull","legs","upper","full","hiit"].includes(x)) return x as Split;
  return undefined;
}

export function isMainLiftForSplit(name: string, split?: string) {
  const s = canonicalSplit(split);
  if (!s || s === "hiit") return false;
  const list = MAIN_LIFTS[s];
  return !!list?.some(m => sameLift(m, name));
}

export function sameLift(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function pickFirstAllowedMain(split?: string, equipmentNames?: string[]) {
  const s = canonicalSplit(split);
  if (!s || s === "hiit") return null;
  const list = MAIN_LIFTS[s];
  // If you want equipment-aware choice, enrich this check (e.g., belt squat present)
  return list?.[0] ?? null;
}
