// lib/backupWorkouts.ts

/**
 * Minimal, dependency-free backup builder used only when the LLM response
 * is unusable. It selects from your *catalog* names (no hardcoding),
 * anchors a main lift that matches the split, and formats a UI-ready shape.
 */

type Split = "pull" | "push" | "legs" | "upper" | "full" | "hiit";

const SPLIT_PATTERNS: Record<Split, RegExp> = {
  pull: /(deadlift|hinge|row|pull[-\s]?up|pull[-\s]?down|lat|rear delt|face pull|carry)/i,
  push: /(bench|press|push[-\s]?up|dip|overhead|triceps)/i,
  legs: /(squat|lunge|hinge|deadlift|step[-\s]?up|hamstring|quad|posterior|calf)/i,
  upper: /(press|row|pull[-\s]?down|pull[-\s]?up|rear delt|face pull|overhead|push[-\s]?up)/i,
  full: /(squat|press|row|hinge|carry)/i,
  hiit: /(interval|sled|rope|swing|burpee|circuit|emom|amrap)/i,
};

function titleCase(s: string) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

export function makeTitle(split: string, minutes?: number) {
  const m = Number.isFinite(minutes as number) ? minutes : 45;
  return `${titleCase(split)} (~${m} min)`;
}

function pickMain(split: Split, names: string[]): string {
  const rx = SPLIT_PATTERNS[split];
  const hit = names.find(n => rx.test(n)) || names[0] || "Primary Lift";
  return hit;
}

function pickAccessories(split: Split, names: string[], exclude: string, max = 3): string[] {
  const rx = SPLIT_PATTERNS[split];
  const pool = names.filter(n => n && n !== exclude);
  const prefer = pool.filter(n => rx.test(n));
  const chosen = [...prefer.slice(0, max)];
  if (chosen.length < max) {
    for (const n of pool) {
      if (chosen.length >= max) break;
      if (!chosen.includes(n)) chosen.push(n);
    }
  }
  return chosen.slice(0, max);
}

function pickWarmup(names: string[], max = 3): string[] {
  const cues = /(band|face pull|scap|pallof|rotation|t[-\s]?spine|crawl|open|thoracic)/i;
  const prefer = names.filter(n => cues.test(n));
  const rest = names.filter(n => !cues.test(n));
  const list = [...prefer.slice(0, max)];
  for (const n of rest) {
    if (list.length >= max) break;
    if (!list.includes(n)) list.push(n);
  }
  return list.slice(0, max);
}

export function buildRuleBasedBackup(input: any) {
  const split = (input?.split || "pull") as Split;
  const minutes = Number(input?.minutes || 45);
  // Accept either array of rows ({name}) or plain strings
  const catalogNames: string[] = Array.isArray(input?.catalog)
    ? input.catalog
        .map((r: any) => (typeof r === "string" ? r : r?.name))
        .filter(Boolean)
        .map((s: string) => String(s))
    : [];

  // Ensure we have some names to work with
  const names = [...new Set(catalogNames)].filter(Boolean);
  const title = makeTitle(split, minutes);

  // Main + accessories (from catalog only)
  const mainLift = pickMain(split, names);
  const acc = pickAccessories(split, names, mainLift, 3);

  // Warm-up (rotation/scap-prep biased if present in catalog wording)
  const wu = pickWarmup(names, 3);

  const workout = {
    warmup: wu.map(n => ({ name: n, sets: 1, reps: "8–12" })),
    mainExercises: [
      { name: mainLift, sets: 4, reps: "5", isAccessory: false },
      ...acc.map(n => ({ name: n, sets: 3, reps: "8–12", isAccessory: true })),
    ],
    finisher: undefined as any,
  };

  const plan = {
    split,
    duration: minutes,
    name: title,
    main_lift: mainLift,
    phases: [
      { phase: "prep", items: workout.warmup },
      { phase: "strength", items: workout.mainExercises },
      { phase: "activation", items: [] },
      { phase: "carry", items: [] },
    ],
  };

  const coach =
    `${split.toUpperCase()} backup plan. Main lift: ${mainLift}. ` +
    `Warm-up emphasizes scap/rotation; accessories rotate from your catalog.`;

  return {
    ok: true,
    name: title,
    message: title,
    coach,
    plan,
    workout,
  };
}
