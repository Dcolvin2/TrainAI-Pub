// app/api/chat-workout/route.ts
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabaseClient";
import { devlog } from "@/lib/devlog";
import { buildRuleBasedBackup, makeTitle } from "@/lib/backupWorkouts";

export const runtime = "nodejs";

// ---- Clients ----
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// utils inside your /api route file
type PhaseKey = 'prep'|'activation'|'strength'|'carry_block'|'conditioning'|'cooldown';

type WorkoutItem = {
  name: string;
  sets?: number;
  reps?: string | number;
  duration_seconds?: number;
  load?: string | number | null;
  instruction?: string | null;
  rest_seconds?: number | null;
};

type PlanShape = {
  name: string;
  phases: Array<{ phase: PhaseKey; items: WorkoutItem[] }>;
};

type WorkoutShape = {
  warmup: WorkoutItem[];
  main: WorkoutItem[];
  cooldown: WorkoutItem[];
};

function extractJson(raw: string): { plan?: PlanShape; workout?: WorkoutShape; error?: string } {
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

function validatePlan(plan?: PlanShape, workout?: WorkoutShape): { ok: boolean; why?: string } {
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
function toLegacyWorkout(plan: Plan) {
  const get = (k: PlanPhase["phase"]) => plan.phases.find(p => p.phase === k)?.items ?? [];
  const warmup = get("prep").map(i => ({ name: i.name, sets: i.sets ?? "1", reps: i.reps ?? "10-15", instruction: i.instruction ?? "" }));
  const mainPrim = get("strength").map(i => ({ name: i.name, sets: i.sets ?? "3", reps: i.reps ?? (i.duration ?? "8-12"), instruction: i.instruction ?? "", isAccessory: !!i.isAccessory }));
  const acc = get("activation").map(i => ({ name: i.name, sets: i.sets ?? "3", reps: i.reps ?? "10-15", instruction: i.instruction ?? "", isAccessory: true }));
  const carry = get("carry_block").map(i => ({ name: i.name, sets: i.sets ?? "3", reps: i.reps ?? "10-15", instruction: i.instruction ?? "", isAccessory: true }));
  const cond = get("conditioning").map(i => ({ name: i.name, sets: i.sets ?? "4", reps: i.reps ?? (i.duration ?? "30s"), instruction: i.instruction ?? "", isAccessory: true }));
  const cooldown = get("cooldown").map(i => ({ name: i.name, duration: i.duration ?? (i.reps || "60s"), instruction: i.instruction ?? "" }));
  return { warmup, main: [...mainPrim, ...acc, ...carry, ...cond], cooldown };
}

/** Pretty "coach" narrative */
function formatCoach(plan: Plan, workout: ReturnType<typeof toLegacyWorkout>): string {
  const title = plan?.name || "Planned Session";
  const minutes = S(plan?.est_total_minutes ?? plan?.duration_min);
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

    // 1) Build messages for the model (keep this exactly what you send)
    const systemPrompt = 'You are a workout generator that returns STRICT JSON with keys: plan{...} and workout{...}.';
    const userPrompt = JSON.stringify({ split, minutes, equipment: equipmentList });

    // 2) Call your existing chat service (unchanged)
    const rawText = await llmJSON({
      system: systemPrompt,
      user: userPrompt,
      max_tokens: 1600,
      temperature: 0.3
    });
    devlog('model.raw', rawText);

    // 3) Parse & validate
    const extracted = extractJson(rawText);
    devlog('parse', extracted.error ? { error: extracted.error } : { planKeys: Object.keys(extracted.plan ?? {}), workoutKeys: Object.keys(extracted.workout ?? {}) });

    const validity = validatePlan(extracted.plan, extracted.workout);
    devlog('validate', validity);

    // 4) If invalid, DO NOT silently switch to Ocho. Build rule-based backup for the split.
    let finalPlan = extracted.plan;
    let finalWorkout = extracted.workout;

    if (!validity.ok) {
      devlog('fallback.reason', validity.why ?? 'unknown');
      const backup = buildRuleBasedBackup(split, minutes, equipmentList);
      finalPlan = backup.plan;
      finalWorkout = backup.workout;
    }

    // 5) Return with explicit debug
    return NextResponse.json({
      ok: true,
      name: makeTitle(split, minutes), // see helper below
      message: makeTitle(split, minutes),
      coach: null,
      plan: finalPlan,
      workout: finalWorkout,
      debug: {
        usedTwoPass: false,   // set true only if you actually do it
        minutesRequested: minutes,
        split,
        equipmentList: equipmentList,
        parseError: extracted.error ?? null,
        validity: validity.ok ? 'ok' : validity.why
      }
    }, { headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: S(e?.message) || "Failed to generate workout plan" }, { status: 500 });
  }
}


