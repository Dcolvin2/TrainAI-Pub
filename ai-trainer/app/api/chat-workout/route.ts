// app/api/chat-workout/route.ts
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabaseClient";
import { devlog } from "@/lib/devlog";
import { buildRuleBasedBackup, makeTitle } from "@/lib/backupWorkouts";
import { normalizePlan as normalizePlanLib, buildChatSummary } from "@/lib/normalizePlan";

export const runtime = "nodejs";

// ---- Clients ----
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// MAIN LIFT ANCHORS — only this repeats. Everything else can vary.
const MAIN_LIFTS: Record<string, string[]> = {
  pull: ['Trap Bar Deadlift', 'Conventional Deadlift', 'Dumbbell Romanian Deadlift'],
  push: ['Barbell Bench Press', 'Dumbbell Bench Press', 'Incline Bench Press'],
  legs: ['Back Squat', 'Front Squat', 'Belt Squat'],
  upper: ['Standing Overhead Press', 'Seated DB Shoulder Press'],
  full: ['Trap Bar Deadlift', 'Back Squat', 'Bench Press'],
  hiit: [], // no fixed main lift
};

// ----- local types (unique to avoid collisions) -----
type PhaseKey =
  | 'prep'
  | 'activation'
  | 'strength'
  | 'carry_block'
  | 'conditioning'
  | 'cooldown';

type Item = {
  name: string;
  // allow either number or string since the model sometimes sends "30s" etc.
  sets?: number | string;
  reps?: number | string;
  duration?: number | string;       // <-- add (you use i.duration)
  duration_seconds?: number;        // optional, some schemas use this
  instruction?: string | null;
  rest_seconds?: number | null;
  is_main?: boolean;
  isAccessory?: boolean;            // <-- add (you read i.isAccessory)
};

// Renamed types to avoid duplicate identifier errors
type ChatPlan = {
  name?: string;
  duration_min?: number;
  phases: Array<{ phase: PhaseKey; items: Item[] }>;
};

type ChatWorkout = {
  warmup: Item[];
  main: Item[];
  cooldown: Item[];
};

function titleFor(split: string | undefined, minutes: number) {
  const pretty = split ? split[0].toUpperCase() + split.slice(1) : 'Session';
  return `${pretty} (~${minutes} min)`;
}

// Pick the best main lift given the user's equipment
function pickMainLift(split: string, equipment: string[]): string | null {
  const anchors = MAIN_LIFTS[split] || [];
  const have = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('trap bar')) return equipment.some(e => e.toLowerCase().includes('trap bar'));
    if (n.includes('deadlift')) return equipment.some(e => /barbell|trap bar/.test(e.toLowerCase()));
    if (n.includes('bench')) return equipment.some(e => /bench/.test(e.toLowerCase()));
    if (n.includes('squat')) return equipment.some(e => /rack|belt squat|barbell/.test(e.toLowerCase()));
    if (n.includes('press')) return equipment.some(e => /barbell|dumbbell/.test(e.toLowerCase()));
    return true; // permissive fallback
  };
  for (const lift of anchors) if (have(lift)) return lift;
  return anchors[0] ?? null;
}

// Pull candidate accessories from Supabase (including rotation)
type Candidate = { name: string; instruction?: string | null };

async function getCandidates(equipment: string[], wantedTags: string[], limit = 12): Promise<Candidate[]> {
  // Try exercises_final first
  const eq = equipment.map(e => e.toLowerCase());
  const tags = wantedTags.map(t => t.toLowerCase());

  // 1) Try exercises_final
  let q = supabase
    .from('exercises_final')
    .select('name,instruction,equipment_required,category,target_muscles,movement_pattern', { count: 'exact' })
    .limit(limit * 2); // get extra, we'll filter in JS too

  const { data: efData } = await q;

  const rows1 = (efData ?? []).filter(r => {
    const rowStr = `${r.name} ${r.instruction ?? ''} ${r.category ?? ''} ${r.target_muscles ?? ''} ${r.movement_pattern ?? ''} ${r.equipment_required ?? ''}`.toLowerCase();
    const equipOk = eq.length === 0 || eq.some(k => rowStr.includes(k));
    const hasTag = tags.some(t => rowStr.includes(t));
    return equipOk && hasTag;
  });

  // 2) Fallback to exercises (if needed)
  let rows = rows1;
  if (rows.length < limit) {
    const { data: exData } = await supabase
      .from('exercises')
      .select('name,instruction,category,primary_muscle,equipment_required,exercise_phase,target_muscles,movement_pattern', { count: 'exact' })
      .limit(limit * 2);

    const rows2 = (exData ?? []).filter(r => {
      const rowStr = `${r.name} ${r.instruction ?? ''} ${r.category ?? ''} ${r.primary_muscle ?? ''} ${r.exercise_phase ?? ''} ${r.target_muscles ?? ''} ${r.movement_pattern ?? ''} ${r.equipment_required ?? ''}`.toLowerCase();
      const equipOk = eq.length === 0 || eq.some(k => rowStr.includes(k));
      const hasTag = tags.some(t => rowStr.includes(t));
      return equipOk && hasTag;
    });

    rows = [...rows1, ...rows2];
  }

  // Dedup by name and cap
  const seen = new Set<string>();
  const unique = rows.filter(r => {
    const key = (r.name || '').toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return unique.slice(0, limit).map(r => ({ name: r.name, instruction: r.instruction ?? null }));
}

// Build a deterministic time budget for the LLM
function phaseBudget(totalMin: number) {
  const warmup = Math.min(10, Math.max(5, Math.round(totalMin * 0.18)));
  const main = Math.round(totalMin * 0.42);
  const accessories = Math.max(8, totalMin - warmup - main - 4); // leave ~4 for cooldown
  const cooldown = Math.max(3, totalMin - warmup - main - accessories);
  return { warmup, main, accessories, cooldown };
}

// System prompt to anchor main lift and vary the rest (rotation included)
function buildSystemPrompt(split: string, mainLift: string, budget: ReturnType<typeof phaseBudget>) {
  return [
    `You are TrainAI, a strength coach. Build a ${split.toUpperCase()} workout respecting time budget.`,
    `Rules:`,
    `- The MAIN LIFT is fixed and must appear first in main exercises: "${mainLift}".`,
    `- Everything else (warm-up, accessories, finisher, cooldown) is variable based on equipment and variety.`,
    `- Warm-up MUST be 5–10 minutes and include shoulder/scap prep AND thoracic rotation or anti-rotation.`,
    `- Include at least one rotational or anti-rotation core movement (e.g., chops, lifts, Pallof).`,
    `- Favor high-quality pulls: horizontal pull, vertical pull, scap retraction/ER, posterior chain; add grip/carries if time allows.`,
    `- Fit within minutes: warmup ${budget.warmup}, main ${budget.main}, accessories ${budget.accessories}, cooldown ${budget.cooldown}.`,
    `Output JSON ONLY using keys: plan, workout.warmup[], workout.mainExercises[], workout.finisher (optional).`,
    `For each item use { "name", "sets" (number or string), "reps" (string) OR "duration" (string), "instruction" (optional), "isAccessory" (boolean for accessories) }.`,
  ].join('\n');
}

// Generate pull workout with anchored main lift and rotating accessories
async function generatePullWorkoutLLM({
  split,
  totalMin,
  equipment,
  chatWithFunctions,
}: {
  split: 'pull';
  totalMin: number;
  equipment: string[];
  chatWithFunctions: (args: { system: string; user: string }) => Promise<any>;
}) {
  const budget = phaseBudget(totalMin);
  const mainLift = pickMainLift(split, equipment) || 'Dumbbell Romanian Deadlift';

  // Pull candidates
  const rot = await getCandidates(equipment, ['chop', 'lift', 'pallof', 'rotation', 'anti-rotation']);
  const horiz = await getCandidates(equipment, ['row', 't-bar', 'seated row']);
  const vert = await getCandidates(equipment, ['pull-up', 'lat pulldown']);
  const scap = await getCandidates(equipment, ['face pull', 'external rotation', 'band pull apart']);
  const post = await getCandidates(equipment, ['rdl', 'hinge', 'good morning']);
  const grip = await getCandidates(equipment, ['farmer carry', 'suitcase carry', 'dead hang']);

  const system = buildSystemPrompt(split, mainLift, budget);

  const user = JSON.stringify({
    equipment,
    anchors: { mainLift },
    candidates: {
      rotation: rot,
      horizontalPull: horiz,
      verticalPull: vert,
      scapular: scap,
      posterior: post,
      gripCarry: grip,
    },
    budget,
  });

  const raw = await chatWithFunctions({ system, user });

  // Expect JSON back; if model returns string, parse
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;

  // Ensure main lift is first and flagged
  const main = [{ name: mainLift, sets: '4', reps: '5', instruction: 'Build to working weight', isAccessory: false }];
  const rest = Array.isArray(data?.workout?.mainExercises) ? data.workout.mainExercises : [];
  const mainExercises = [ ...main, ...rest.map((x:any) => ({ ...x, isAccessory: true })) ];

  return {
    ok: true,
    name: `Pull (~${totalMin} min)`,
    message: `Pull (~${totalMin} min)`,
    plan: { split, duration: totalMin, main_lift: mainLift, name: `Pull (~${totalMin} min)` },
    workout: {
      warmup: Array.isArray(data?.workout?.warmup) ? data.workout.warmup : [],
      mainExercises,
      finisher: data?.workout?.finisher,
    },
  };
}

function coachText(split: string | undefined, minutes: number, hasHistory: boolean) {
  if (!hasHistory) {
    return `This is your first workout—great time to set a baseline. We'll do a ${minutes}-minute ${split || 'full'} session. Focus on smooth reps, controlled tempo, and stop 1–2 reps shy of failure.`;
  }
  switch (split) {
    case 'push': return `Push day (chest/shoulders/triceps). Stay tight on bench, control the eccentric, and keep rests ~90–120s.`;
    case 'pull': return `Pull day (back/biceps). Lead pulls with your elbows, squeeze lats at the top, keep bracing on rows.`;
    case 'legs': return `Leg day. Drive through mid-foot/heel, own the bottom position, and control your eccentric on squats/RDLs.`;
    case 'hiit': return `Intervals today. Hit hard on the work sets, nasal-breathe on recovery, and keep posture tall.`;
    default: return `Full body today. Move crisply, leave 1–2 reps in the tank, and keep transitions tight.`;
  }
}

// explicit, non-vague backups (used when LLM parsing fails)
function buildRuleBackup(split: string | undefined, minutes: number, equipment: string[]): { plan: ChatPlan; workout: ChatWorkout } {
  const has = (s: string) => equipment.some(e => e.toLowerCase().includes(s));
  const warm: Item[] = [
    { name: 'Bike Easy', duration_seconds: 180 },
    { name: 'Band Pull-Apart', sets: 2, reps: 15 },
  ];
  let main: Item[] = [];
  const cool: Item[] = [
    { name: 'Child\'s Pose', duration_seconds: 60 },
    { name: 'Doorway Pec Stretch', duration_seconds: 60 },
  ];

  switch (split) {
    case 'push':
      main = [
        { name: has('barbell') ? 'Barbell Bench Press' : 'Dumbbell Bench Press', sets: 4, reps: '6-8', is_main: true },
        { name: 'Overhead Press (DB or Barbell)', sets: 3, reps: '8-10' },
        { name: 'Incline DB Press', sets: 3, reps: '10-12' },
        { name: 'Cable Triceps Pressdown', sets: 3, reps: '10-12' },
      ];
      break;
    case 'pull':
      main = [
        { name: has('cable') ? 'Lat Pulldown' : 'Pull-Up or Assisted Pull-Up', sets: 4, reps: '6-8', is_main: true },
        { name: 'One-Arm DB Row', sets: 3, reps: '8-10' },
        { name: 'Chest-Supported Row', sets: 3, reps: '10-12' },
        { name: 'DB Hammer Curl', sets: 3, reps: '10-12' },
      ];
      break;
    case 'legs':
      main = [
        { name: has('barbell') ? 'Back Squat' : 'Goblet Squat', sets: 4, reps: '6-8', is_main: true },
        { name: 'Romanian Deadlift (DB or Barbell)', sets: 3, reps: '8-10' },
        { name: 'DB Walking Lunge', sets: 3, reps: '10 each' },
        { name: 'Seated Calf Raise (Machine or DB on knees)', sets: 3, reps: '12-15' },
      ];
      break;
    default: // FULL BODY — explicit, never "Circuit"
      main = [
        { name: has('barbell') ? 'Back Squat' : 'Goblet Squat', sets: 3, reps: '8-10', is_main: true },
        { name: 'DB Bench Press', sets: 3, reps: '8-10' },
        { name: 'One-Arm DB Row', sets: 3, reps: '10-12' },
        { name: 'Kettlebell Swing', sets: 3, reps: '12-15' },
      ];
  }

  const workout: ChatWorkout = { warmup: warm, main, cooldown: cool };
  const plan: ChatPlan = {
    name: 'Planned Session',
    phases: [
      { phase: 'prep', items: warm },
      { phase: 'activation', items: [] },
      { phase: 'strength', items: main },
      { phase: 'carry_block', items: [] },
      { phase: 'conditioning', items: split === 'hiit' ? main : [] },
      { phase: 'cooldown', items: cool },
    ],
  };
  return { plan, workout };
}

async function getRecentCoreLift(userId: string, mainLift?: string) {
  if (!userId || !mainLift) return null;
  // Pull the last set logged for that lift
  const { data, error } = await supabase
    .from("workout_sets")
    .select("actual_weight,reps,session_id")
    .eq("exercise_name", mainLift)
    .not("actual_weight","is",null)
    .order("session_id", { ascending: false })
    .limit(1);
  if (error || !data || data.length === 0) return null;
  return data[0];
}

async function getEquipmentList(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("user_equipment")
    .select("custom_name");
  if (error || !data) return [];
  return data.map(r => r.custom_name).filter(Boolean);
}

function coachTips(n: ReturnType<typeof normalizePlanLib> extends infer T ? T : any, last?: { actual_weight?: number; reps?: number } | null) {
  const tips: string[] = [];
  if (n?.totalMinutes && n.totalMinutes < 30) {
    tips.push("Tight on time: prioritize the main lift; trim accessories first.");
  }
  if (n?.split && n.split !== "hiit" && n?.mainLiftName) {
    tips.push(`Focus: ${n.mainLiftName}. Warm up well and keep rest ~2–3 min between working sets.`);
  }
  if (last?.actual_weight && last?.reps) {
    tips.push(`Last time on ${n?.mainLiftName}: ${last.actual_weight} x ${last.reps}. Aim to match or add 2.5–5 lb if all sets hit.`);
  }
  return tips;
}

// --- BEGIN: workout-based summary helpers (SAFE) ---
function listify<T = any>(x: any): T[] {
  if (!x) return [];
  if (Array.isArray(x)) return x as T[];
  if (typeof x === "object") return [x as T];
  return [];
}
function getName(it: any) {
  if (!it) return "";
  if (typeof it === "string") return it;
  return it.name ?? it.exercise ?? "";
}
function getReps(it: any) {
  if (!it) return "";
  if (typeof it === "string") return "";
  return it.reps ?? it.rep_range ?? "";
}
function getSets(it: any) {
  if (!it) return "";
  if (typeof it === "string") return "";
  return it.sets ?? it.set_count ?? "";
}
function getDurStr(it: any) {
  if (!it || typeof it === "string") return "";
  if (typeof it.duration_seconds === "number") return `${Math.round(it.duration_seconds / 60)} min`;
  if (typeof it.duration === "string") return it.duration;
  return "";
}

function summarizeFromWorkout(workout: any, split?: string, minutes?: number) {
  if (!workout || typeof workout !== "object") return null;

  // Your payload sometimes uses "mainExercises". Normalize all lists.
  const warm = listify(workout.warmup);
  const main = listify(workout.mainExercises ?? workout.main);
  const cool = listify(workout.cooldown);
  const fin = workout.finisher; // can be object or string

  const title =
    `${(split ?? "Session").slice(0,1).toUpperCase()}${(split ?? "Session").slice(1)}` +
    (minutes ? ` (~${minutes} min)` : "");

  const lines: string[] = [];

  if (warm.length) {
    lines.push("Warm-up:");
    warm.forEach((it: any, i: number) => {
      const bits = [getName(it)];
      const s = getSets(it);
      const r = getReps(it);
      const d = getDurStr(it);
      if (s && r) bits.push(`${s} × ${r}`);
      else if (d) bits.push(d);
      lines.push(`${i + 1}. ${bits.filter(Boolean).join(" — ")}`);
    });
  }

  if (main.length) {
    lines.push("", "Main:");
    main.forEach((it: any, i: number) => {
      const bits = [getName(it)];
      const s = getSets(it);
      const r = getReps(it);
      const d = getDurStr(it);
      if (s && r) bits.push(`${s} × ${r}`);
      else if (d) bits.push(d);
      lines.push(`${i + 1}. ${bits.filter(Boolean).join(" — ")}`);
    });
  }

  if (fin) {
    const bits = [getName(fin)];
    const s = getSets(fin);
    const r = getReps(fin);
    const d = getDurStr(fin);
    if (s && r) bits.push(`${s} × ${r}`);
    else if (d) bits.push(d);
    const finLine = bits.filter(Boolean).join(" — ");
    if (finLine) lines.push("", `Finisher: ${finLine}`);
  }

  if (cool.length) {
    lines.push("", "Cooldown:");
    cool.forEach((it: any, i: number) => {
      const bits = [getName(it)];
      const s = getSets(it);
      const r = getReps(it);
      const d = getDurStr(it);
      if (s && r) bits.push(`${s} × ${r}`);
      else if (d) bits.push(d);
      lines.push(`${i + 1}. ${bits.filter(Boolean).join(" — ")}`);
    });
  }

  const paragraph = lines.join("\n");
  const mainLift = getName(main[0]) || undefined;
  return { title, paragraph, mainLift };
}
// --- END: workout-based summary helpers (SAFE) ---

function extractJson(raw: string): { plan?: ChatPlan; workout?: ChatWorkout; error?: string } {
  // Try ```json fencing first
  const fence = raw.match(/```json([\s\S]*?)```/i);
  const candidate = fence ? fence[1] : raw;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return { error: 'No JSON object found in model output.' };
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1));
    return { plan: parsed.plan, workout: parsed.workout };
  } catch (e) {
    return { error: `JSON.parse failed: ${(e as Error).message}` };
  }
}

function validatePlan(plan?: ChatPlan, workout?: ChatWorkout): { ok: boolean; why?: string } {
  if (workout && (workout.main?.length || workout.warmup?.length || workout.cooldown?.length)) return { ok: true };
  if (!plan) return { ok: false, why: 'Missing plan & workout.' };
  if (!Array.isArray(plan.phases)) return { ok: false, why: 'plan.phases not array.' };
  const anyItems = plan.phases.some(p => Array.isArray(p.items) && p.items.length > 0);
  if (!anyItems) return { ok: false, why: 'All phases empty.' };
  // light shape check
  const badItem = plan.phases.flatMap(p => p.items).find(it => !it?.name);
  if (badItem) return { ok: false, why: 'Item missing name.' };
  return { ok: true };
}

/** Utilities */
const S = (v: any) => (v == null ? "" : String(v).trim());
const uniq = <T,>(arr: T[]) => Array.from(new Set(arr));

/** Exact user equipment names (no guessing) */
async function getEquipmentNames(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from("user_equipment")
    .select("is_available, equipment:equipment_id(name)")
    .eq("user_id", userId);
  const names = (data ?? [])
    .filter((r: any) => r?.is_available !== false && r?.equipment?.name)
    .map((r: any) => String(r.equipment.name).trim());
  return uniq(names);
}

/** Preferences (existing table; optional knobs are nullable) */
type Prefs = {
  preferred_exercises?: string[];
  avoided_exercises?: string[];
  coaching_style?: string | null;
  conditioning_bias?: "hiit" | "steady" | "mixed" | null;
  detail_level?: number | null;
};
async function getUserPrefs(userId: string): Promise<Prefs> {
  const { data } = await supabase
    .from("user_preferences")
    .select(
      "preferred_exercises, avoided_exercises, coaching_style, conditioning_bias, detail_level"
    )
    .eq("user_id", userId)
    .maybeSingle();
  return {
    preferred_exercises: Array.isArray(data?.preferred_exercises) ? data!.preferred_exercises : [],
    avoided_exercises: Array.isArray(data?.avoided_exercises) ? data!.avoided_exercises : [],
    coaching_style: data?.coaching_style ?? null,
    conditioning_bias: (data?.conditioning_bias as any) ?? null,
    detail_level: (typeof data?.detail_level === "number" ? data!.detail_level : null),
  };
}

/** Recent exercise names (for "no repeat" guidance) — from planned + logged */
const NO_REPEAT_DAYS = 7;
async function getRecentExerciseNames(userId: string): Promise<string[]> {
  const since = new Date();
  since.setDate(since.getDate() - NO_REPEAT_DAYS);
  const sinceISO = since.toISOString().slice(0, 10);

  const seen = new Set<string>();

  // Planned (workout_sessions.planned_exercises)
  const { data: sess } = await supabase
    .from("workout_sessions")
    .select("planned_exercises, date")
    .eq("user_id", userId)
    .gte("date", sinceISO)
    .order("date", { ascending: false })
    .limit(16);
  for (const s of sess || []) {
    const pe = s?.planned_exercises || {};
    const phases = ["warmup", "main", "accessory", "conditioning", "cooldown"];
    for (const ph of phases) {
      const items = Array.isArray(pe?.[ph]) ? pe[ph] : [];
      for (const it of items) {
        const nm = S(it?.name);
        if (nm) seen.add(nm.toLowerCase());
      }
    }
  }

  // Logged (workout_entries.exercise_name)
  if (seen.size < 64) {
    const { data: entries } = await supabase
      .from("workout_entries")
      .select("exercise_name, date")
      .eq("user_id", userId)
      .gte("date", sinceISO)
      .order("date", { ascending: false })
      .limit(256);
    for (const e of entries || []) {
      const nm = S(e?.exercise_name);
      if (nm) seen.add(nm.toLowerCase());
    }
  }

  return Array.from(seen);
}

/** Light normalizer to coerce numbers → strings & cap phases */
type PlanItem = {
  name: string;
  sets?: string;
  reps?: string;
  duration?: string;
  instruction?: string;
  isAccessory?: boolean;
};
type PlanPhase = { phase: "prep" | "activation" | "strength" | "carry_block" | "conditioning" | "cooldown"; items: PlanItem[] };
type Plan = { name: string; duration_min?: number | string; est_total_minutes?: number | string; phases: PlanPhase[] };

function normalizePlan(input: any): { plan: Plan; warnings: string[] } {
  const warnings: string[] = [];
  const allowed = new Set(["prep","activation","strength","carry_block","conditioning","cooldown"]);

  const plan: Plan = {
    name: S(input?.name) || "Planned Session",
    duration_min: input?.duration_min ?? input?.est_total_minutes,
    est_total_minutes: input?.est_total_minutes ?? input?.duration_min,
    phases: [],
  };

  const rawPhases = Array.isArray(input?.phases) ? input.phases : [];
  for (const p of rawPhases) {
    const ph = S(p?.phase).toLowerCase();
    if (!allowed.has(ph)) { warnings.push(`Unknown phase "${ph}" dropped`); continue; }
    const items: PlanItem[] = Array.isArray(p?.items) ? p.items.map((it: any) => ({
      name: S(it?.name),
      sets: it?.sets != null ? S(it.sets) : undefined,
      reps: it?.reps != null ? S(it.reps) : undefined,
      duration: it?.duration != null ? S(it.duration) : undefined,
      instruction: it?.instruction != null ? S(it.instruction) : undefined,
      isAccessory: Boolean(it?.isAccessory),
    })).filter((x: PlanItem) => x.name) : [];
    plan.phases.push({ phase: ph as PlanPhase["phase"], items });
  }

  // Ensure buckets exist (don't auto-add content — let LLM decide)
  const ensure = (k: PlanPhase["phase"]) => {
    if (!plan.phases.some(ph => ph.phase === k)) plan.phases.push({ phase: k, items: [] });
  };
  ensure("prep"); ensure("activation"); ensure("strength"); ensure("carry_block"); ensure("conditioning"); ensure("cooldown");

  return { plan, warnings };
}

/** Legacy bridge for your UI */
function toLegacyWorkout(plan: ChatPlan) {
  const get = (k: PlanPhase["phase"]) => plan.phases.find(p => p.phase === k)?.items ?? [];
  const warmup = get("prep").map(i => ({ name: i.name, sets: i.sets ?? "1", reps: i.reps ?? "10-15", instruction: i.instruction ?? "" }));
  
  // Make mapping resilient to either duration or duration_seconds
  const mainPrim = get("strength").map(i => {
    const dur = (i.duration ?? (typeof i.duration_seconds === 'number' ? `${i.duration_seconds}s` : undefined));
    return { 
      name: i.name, 
      sets: i.sets ?? '3', 
      reps: i.reps ?? (dur ?? '8-12'), 
      instruction: i.instruction ?? '', 
      isAccessory: !!i.isAccessory 
    };
  });
  
  const acc = get("activation").map(i => ({ name: i.name, sets: i.sets ?? "3", reps: i.reps ?? "10-15", instruction: i.instruction ?? "", isAccessory: true }));
  const carry = get("carry_block").map(i => ({ name: i.name, sets: i.sets ?? "3", reps: i.reps ?? "10-15", instruction: i.instruction ?? "", isAccessory: true }));
  
  const cond = get("conditioning").map(i => {
    const dur = (i.duration ?? (typeof i.duration_seconds === 'number' ? `${i.duration_seconds}s` : undefined));
    return { 
      name: i.name, 
      sets: i.sets ?? '4', 
      reps: i.reps ?? (dur ?? '30s'), 
      instruction: i.instruction ?? '', 
      isAccessory: true 
    };
  });
  
  const cooldown = get("cooldown").map(i => ({ name: i.name, duration: i.duration ?? (i.reps || "60s"), instruction: i.instruction ?? "" }));
  return { warmup, main: [...mainPrim, ...acc, ...carry, ...cond], cooldown };
}

/** Pretty "coach" narrative */
function formatCoach(plan: ChatPlan, workout: ReturnType<typeof toLegacyWorkout>): string {
  const title = plan?.name || "Planned Session";
  const minutes = S(plan?.duration_min);
  const lines: string[] = [];
  lines.push(`${title}${minutes ? ` — ${minutes} min` : ""}`);

  const add = (label: string, arr: any[]) => {
    if (!arr?.length) return;
    lines.push("");
    lines.push(label + ":");
    arr.forEach((it, i) => {
      const sets = it?.sets ? `${it.sets}×` : "";
      const repsOrDur = it?.duration || it?.reps || "";
      const cue = it?.instruction ? ` — ${it.instruction}` : "";
      lines.push(`${i + 1}. ${it.name} ${sets}${repsOrDur}${cue}`.trim());
    });
  };

  add("🔥 Prep", workout.warmup);
  add("💪 Strength", workout.main);
  add("🧘 Cool-down", workout.cooldown);
  return lines.join("\n");
}

/** Robust JSON parsing helper */
function tryParseWorkout(raw: string) {
  // 1) try JSON.parse directly
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj === 'object') return { plan: obj, coach: null, parseError: null };
  } catch (_) { /* ignore */ }

  // 2) try to extract the first {...} block (common when model wraps JSON in narration)
  const first = raw.indexOf('{');
  const last = raw.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    const maybe = raw.slice(first, last + 1);
    try {
      const obj = JSON.parse(maybe);
      return { plan: obj, coach: null, parseError: null };
    } catch (e) {
      return { plan: null, coach: raw, parseError: String(e) };
    }
  }

  // 3) fallback: treat as chat text only
  return { plan: null, coach: raw, parseError: 'no-json-found' };
}

/** LLM JSON helper - handles two-pass workflow for optimal workout generation */
async function llmJSON(opts: { system: string; user: string; max_tokens?: number; temperature?: number }) {
  const resp = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.max_tokens ?? 1600,
    messages: [{ role: "user", content: `${opts.system}\n\n${opts.user}` }]
  });
  const raw = (resp?.content ?? []).map((b: any) => ("text" in b ? b.text : "")).join("\n");
  return raw; // Return raw text instead of trying to parse
}



export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const search = url.searchParams;
    const body = await req.json().catch(() => ({}));
    const userId = S(search.get("user") || body.userId);
    const minutes = Number(search.get("minutes") || body.minutes) || 45;
    const split = S(search.get("split") || body.split); // push|pull|legs|upper|full|hiit (optional)
    const message = S(body.message);

    if (!userId) {
      return NextResponse.json({ ok: false, error: "Missing userId" }, { status: 400 });
    }

    // Context
    const [equipmentList, prefs, recentLower] = await Promise.all([
      getEquipmentNames(userId),
      getUserPrefs(userId),
      getRecentExerciseNames(userId),
    ]);

    devlog('input', { split, minutes, equipmentCount: equipmentList.length });

    // 1) Check if this is a pull workout and use anchored main lift system
    if (split === 'pull') {
      const payload = await generatePullWorkoutLLM({
        split: 'pull',
        totalMin: minutes,
        equipment: equipmentList,
        chatWithFunctions: llmJSON,
      });
      
      // Build chat message for pull workout
      let chatMsg = `Pull day locked. Main lift: ${payload.plan.main_lift}. I'll rotate accessories based on your equipment and time.`;
      
      // Add equipment info
      if (equipmentList.length > 0) {
        chatMsg += `\n\nEquipment available: ${equipmentList.join(', ')}`;
      }
      
      return NextResponse.json({
        ...payload,
        chatMsg,
        coach: chatMsg,
      }, { headers: { 'Content-Type': 'application/json' } });
    }

    // 2) Build messages for the model (keep this exactly what you send)
    const systemPrompt = 'You are a workout generator that returns STRICT JSON with keys: plan{...} and workout{...}.';
    const userPrompt = JSON.stringify({ split, minutes, equipment: equipmentList });

    // 3) Call your existing chat service (unchanged)
    const rawText = await llmJSON({
      system: systemPrompt,
      user: userPrompt,
      max_tokens: 1600,
      temperature: 0.3
    });
    devlog('model.raw', rawText);

    // 4) Parse & validate
    const extracted = extractJson(rawText);
    devlog('parse', extracted.error ? { error: extracted.error } : { planKeys: Object.keys(extracted.plan ?? {}), workoutKeys: Object.keys(extracted.workout ?? {}) });

    const validity = validatePlan(extracted.plan, extracted.workout);
    devlog('validate', validity);

    // 5) If invalid, DO NOT silently switch to Ocho. Build rule-based backup for the split.
    let finalPlan = extracted.plan;
    let finalWorkout = extracted.workout;

    if (!validity.ok) {
      devlog('fallback.reason', validity.why ?? 'unknown');
      const backup = buildRuleBackup(split, minutes, equipmentList);
      finalPlan = backup.plan;
      finalWorkout = backup.workout;
    }

    // 6) Return with explicit debug
    const minutesNum = Number(minutes ?? 45);
    const respTitle = titleFor(split, minutesNum);

    // TODO: optionally check Supabase to detect history; for now:
    const hasHistory = false;

    // derive a good title
    const title =
      respTitle || finalPlan?.name || 'Workout';

    // ensure plan.name isn't "Planned Session" when model gave a better title
    const safePlan: ChatPlan | null = finalPlan
      ? { ...finalPlan, name: finalPlan.name || title }
      : null;

    // Build descriptive chat summary using the new normalizer
    let chatMsg = "Let's get started.";
    let mainLiftName: string | undefined;
    let chatBuildError: string | null = null;
    let normalized: any = null;

    try {
      normalized = finalPlan ? normalizePlanLib(finalPlan) : null;

      if (normalized && (normalized.main.length || normalized.warmup.length || normalized.cooldown.length)) {
        let msg = buildChatSummary(normalized);
        const [lastCore, eq] = await Promise.all([
          getRecentCoreLift(userId, normalized.mainLiftName),
          getEquipmentList(userId)
        ]);
        const extra: string[] = [];
        if (eq.length) extra.push(`Equipment on file: ${eq.join(", ")}`);
        extra.push(...coachTips(normalized, lastCore));
        chatMsg = `${msg}\n\n${extra.join("\n")}`;
        mainLiftName = normalized.mainLiftName;
      } else {
        const wkSum = summarizeFromWorkout(finalWorkout, split, minutes);
        if (wkSum) {
          const [lastCore, eq] = await Promise.all([
            getRecentCoreLift(userId, wkSum.mainLift),
            getEquipmentList(userId)
          ]);
          const tips: string[] = [];
          if (wkSum.mainLift) tips.push(`Focus on ${wkSum.mainLift}. Control the eccentric, brace, and rest 2–3 min.`);
          if (lastCore?.actual_weight && lastCore?.reps) tips.push(`Last time: ${wkSum.mainLift} at ${lastCore.actual_weight} × ${lastCore.reps}. Match or add 2.5–5 lb if clean.`);
          if (!tips.length) tips.push("First session? Keep 1–2 reps in reserve and prioritize form.");
          const extra: string[] = [];
          if (eq.length) extra.push(`Equipment on file: ${eq.join(", ")}`);
          chatMsg = `${wkSum.title}\n\n${wkSum.paragraph}\n\n${[...extra, ...tips].join("\n")}`;
          mainLiftName = wkSum.mainLift;
        }
      }
    } catch (e: any) {
      chatBuildError = e?.message ?? String(e);
      // keep chatMsg as the simple default; DO NOT throw
    }

    return NextResponse.json({
      ok: true,
      name: normalized?.name ?? finalPlan?.name ?? `${(split ?? 'Session').slice(0,1).toUpperCase()}${(split ?? 'Session').slice(1)} (~${minutes} min)`,
      message: normalized?.name ?? finalPlan?.name ?? `${(split ?? 'Session').slice(0,1).toUpperCase()}${(split ?? 'Session').slice(1)} (~${minutes} min)`,
      chatMsg,
      coach: chatMsg,         // keep for UI fallback
      plan: safePlan,
      workout: finalWorkout,
      debug: { split, minutesRequested: minutes, mainLiftName, chatBuildError }
    }, { headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: S(e?.message) || "Failed to generate workout plan" }, { status: 500 });
  }
}


