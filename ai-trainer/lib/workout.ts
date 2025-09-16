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

export function estimateMinutes(plan: { phases: Array<{ items: Array<Record<string, unknown>> }> }): number {
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
        
        // handle "40s work / 20s rest" style
        const s = duration.match(/(\d+)\s*s(ec)?/i);
        if (s) {
          const sec = parseInt(s[1] as string, 10);
          if (!Number.isNaN(sec)) mins += sec / 60;
        }
      }
    }
  }
  return Math.ceil(mins);
}

/** Ensure only the first strength item is treated as main (isAccessory=false), others default to accessory=true */
export function normalizeStrengthAccessories<T extends {
  phases: Array<{ phase: string; items: Array<Record<string, unknown>> }>;
}>(plan: T): T {
  const clone: T = JSON.parse(JSON.stringify(plan));
  const strength = clone.phases.find(p => p.phase === "strength");
  
  if (strength && Array.isArray(strength.items) && strength.items.length) {
    strength.items.forEach((it, idx) => {
      if (idx === 0) it["isAccessory"] = false;
      else if (it["isAccessory"] === undefined) it["isAccessory"] = true;
    });
  }
  
  return clone;
}

function styleFromText(text: string): "ski"|"ocho"|"athlean"|"tabata"|"generic" {
  const t = (text || "").toLowerCase();
  if (t.includes("ski")) return "ski";
  if (t.includes("ocho") || t.includes("joe holder")) return "ocho";
  if (t.includes("tabata")) return "tabata";
  if (t.includes("cavaliere") || t.includes("athlean")) return "athlean";
  return "generic";
}

function pick<T>(arr: T[], n: number): T[] {
  const out: T[] = [];
  for (let i = 0; i < arr.length && out.length < n; i++) out.push(arr[i]);
  return out;
}

function paddingForStyle(style: ReturnType<typeof styleFromText>, equipment: string[]) {
  const has = (s: string) => equipment.some(e => e.toLowerCase().includes(s));
  const dbRow = has("cable") ? "Cable Row" : has("trx") ? "TRX Row" : "1-Arm DB Row";
  const kbSwing = has("kettlebell") ? "Kettlebell Swing" : has("dumbbell") ? "DB Hip Hinge (RDL)" : "Hip Hinge Drill";
  const sled = has("sled") ? "Sled Push" : has("belt") ? "Belt Squat March" : "Farmer Carry";
  
  switch (style) {
    case "ski":
      return [
        { name: "Lateral Bounds", sets: "3", reps: "20s work", isAccessory: true },
        { name: "Copenhagen Plank", sets: "3", reps: "20-30s/side", isAccessory: true },
        { name: "Rear-Foot Elevated Split Squat", sets: "3", reps: "8-10/side", isAccessory: true },
        { name: kbSwing, sets: "3", reps: "12-15", isAccessory: true },
        { name: sled, sets: "3", reps: "30-40m", isAccessory: true },
      ];
    case "ocho":
      return [
        { name: kbSwing, sets: "3", reps: "40s work / 20s rest", isAccessory: true },
        { name: "Push-Up", sets: "3", reps: "AMRAP-2", isAccessory: true },
        { name: dbRow, sets: "3", reps: "10-12/side", isAccessory: true },
        { name: "Reverse Lunge", sets: "3", reps: "10/side", isAccessory: true },
      ];
    case "athlean":
      return [
        { name: "Face Pull", sets: "3", reps: "12-15", isAccessory: true },
        { name: "DB Overhead Press", sets: "3", reps: "8-10", isAccessory: true },
        { name: "Hip Thrust (BB/DB)", sets: "3", reps: "8-12", isAccessory: true },
      ];
    case "tabata":
      return [
        { name: "Air Squat", sets: "4", reps: "20s on/10s off", isAccessory: true },
        { name: "Mountain Climbers", sets: "4", reps: "20s on/10s off", isAccessory: true },
      ];
    default:
      return [
        { name: kbSwing, sets: "3", reps: "12-15", isAccessory: true },
        { name: dbRow, sets: "3", reps: "10-12/side", isAccessory: true },
        { name: "DB Overhead Press", sets: "3", reps: "8-12", isAccessory: true },
      ];
  }
}

/** If the plan is short, pad with style-appropriate accessories; if long, trim. */
export function ensureDuration<T extends {
  split: string;
  duration: number;
  phases: Array<{ phase: string; items: Array<Record<string, unknown>> }>;
}>(plan: T, targetMinutes: number, userText: string, equipment: string[]): T {
  let clone: T = JSON.parse(JSON.stringify(plan));
  const style = styleFromText(userText);
  const target = Math.max(10, targetMinutes);
  const lower = Math.round(target * 0.9);
  const upper = Math.round(target * 1.05);
  let mins = estimateMinutes(clone);
  
  if (mins < lower) {
    const pad = paddingForStyle(style, equipment);
    const accessory = clone.phases.find(p => p.phase === "accessory");
    if (accessory) {
      for (const item of pad) {
        accessory.items.push({ ...item });
        mins = estimateMinutes(clone);
        if (mins >= lower) break;
      }
    }
  } else if (mins > upper) {
    clone = trimPlanToDuration(clone, target);
  }
  
  clone.duration = target;
  return clone;
}

/** Build a contextual, 1–2 sentence coach message based on style and split. */
export function coachFor(plan: { split: string }, userText: string): string {
  const style = styleFromText(userText);
  
  switch (style) {
    case "ski":
      return "Ski prep focus: power + unilateral control—keep landings soft, control eccentrics, and cap rest at ~60s to stay on time.";
    case "ocho":
      return "Ocho circuit: steady 7–8/10 effort—own the pace across stations and keep transitions tight.";
    case "athlean":
      return "Tension and form drive results—stay strict, use full ROM, and leave 1–2 reps in reserve on the heaviest sets.";
    case "tabata":
      return "Hit crisp intervals—quality over speed; breathe through rests and maintain consistent rounds.";
    default:
      return "Move with intent and clean form—prioritize quality reps and steady pacing to finish on time.";
  }
}

// ---------- DB Name Sanitizer ----------
function normName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

function tokenSet(s: string): Set<string> {
  return new Set(normName(s).split(" ").filter(Boolean));
}

function jaccard(a: string, b: string): number {
  const A = tokenSet(a), B = tokenSet(b);
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const union = A.size + B.size - inter;
  return union ? inter / union : 0;
}

function bestMatch(name: string, allowed: string[]): { hit: string | null; score: number } {
  const n = normName(name);
  
  // Exact / startswith / includes fast paths
  for (const a of allowed) {
    const an = normName(a);
    if (an === n) return { hit: a, score: 1 };
  }
  
  for (const a of allowed) {
    const an = normName(a);
    if (an.startsWith(n) || n.startsWith(an)) return { hit: a, score: 0.92 };
    if (an.includes(n) || n.includes(an)) return { hit: a, score: 0.9 };
  }
  
  // Jaccard fallback
  let best = { hit: null as string | null, score: 0 };
  for (const a of allowed) {
    const sc = jaccard(a, name);
    if (sc > best.score) best = { hit: a, score: sc };
  }
  
  return best;
}

/** Map every item.name to the closest allowed DB name; optionally drop if no match. */
export function sanitizePlanExercises<T extends {
  phases: Array<{ phase: string; items: Array<{ name?: string; [k: string]: unknown }> }>;
}>(plan: T, allowedNames: string[], opts?: { dropUnknown?: boolean; minScore?: number }): T {
  const drop = opts?.dropUnknown ?? true;
  const minScore = opts?.minScore ?? 0.55;
  const allowSet = new Set(allowedNames.map(normName));
  const out: T = JSON.parse(JSON.stringify(plan));
  
  console.log('🧹 Sanitization function called with:', {
    allowedNamesCount: allowedNames.length,
    minScore,
    drop,
    sampleAllowed: allowedNames.slice(0, 5)
  });
  
  for (const ph of out.phases) {
    const next: Array<{ name?: string; [k: string]: unknown }> = [];
    for (const it of ph.items) {
      const raw = String(it.name ?? "").trim();
      if (!raw) continue;
      
      const nn = normName(raw);
      if (allowSet.has(nn)) {
        console.log(`✅ Exact match found: "${raw}" -> "${raw}"`);
        next.push(it); // already exact
        continue;
      }
      
      const { hit, score } = bestMatch(raw, allowedNames);
      console.log(`🔍 Matching "${raw}": hit="${hit}", score=${score}, minScore=${minScore}`);
      
      if (hit && score >= minScore) {
        console.log(`✅ Mapped: "${raw}" -> "${hit}" (score: ${score})`);
        next.push({ ...it, name: hit });
      } else if (!drop) {
        console.log(`⚠️ Keeping unknown: "${raw}" (drop=false)`);
        next.push(it);
      } else {
        console.log(`❌ Dropped: "${raw}" (score: ${score} < ${minScore})`);
      }
    }
    ph.items = next;
  }
  
  return out;
}
