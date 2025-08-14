// app/api/chat-workout/route.ts
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabaseClient";

export const runtime = "nodejs";

// ---- Clients ----
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

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

/** LLM JSON helper - handles two-pass workflow for optimal workout generation */
async function llmJSON(opts: { system: string; user: string; max_tokens?: number; temperature?: number }) {
  const resp = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.max_tokens ?? 1600,
    messages: [{ role: "user", content: `${opts.system}\n\n${opts.user}` }]
  });
  const raw = (resp?.content ?? []).map((b: any) => ("text" in b ? b.text : "")).join("\n");
  try { return JSON.parse(raw); } catch {
    const m = raw.match(/\{[\s\S]*\}$/); // best-effort
    if (m) return JSON.parse(m[0]);
    throw new Error("LLM did not return JSON");
  }
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

    // ---------- Pass 1: Draft plan (LLM uses its own knowledge) ----------
    const sysCapsule = `
You are a strength coach producing "Joe Holder / Ocho System" workouts.

Constraints:
- Name each session "Ocho System <descriptor>" (e.g., "Ocho System Power Flow").
- Duration target: ${minutes} minutes total (±3). Budget time across phases.
- Phases in order: ["prep", "activation", "strength", "carry_block", "conditioning", "cooldown"].
- Strength = unilateral bias + tempo notes; no Olympic barbell cycling.
- Conditioning = low‑skill cyclical or med‑ball work. Prefer rope/bike/row, jumps, slams.
- Every item MUST include a short coaching cue ("— …").
- Prefer minimal equipment swaps. Offer obvious substitutions if an item is missing.

Return BOTH:
1) \`coach\` = a chat‑ready markdown summary for users.
2) \`plan\` = structured JSON with fields exactly as below.

JSON schema (must match):
{
  "name": "Ocho System Power Flow",
  "duration_min": ${minutes},
  "phases": [
    {
      "phase": "prep",
      "items": [
        { "name": "Box Breathing", "duration": "2 min", "instruction": "nasal, tall ribcage" }
      ]
    },
    {
      "phase": "activation",
      "items": [
        { "name": "Dead Bug + Band Pulldown", "sets": "2", "reps": "8/side", "instruction": "ribs down" }
      ]
    },
    {
      "phase": "strength",
      "items": [
        { "name": "Front-Foot Elevated Split Squat", "sets": "4", "reps": "6/side", "instruction": "3-1-1 tempo" },
        { "name": "Ring Row", "sets": "4", "reps": "8-10", "instruction": "pause 1s at chest" },
        { "name": "DB Half-Kneeling OH Press", "sets": "4", "reps": "6/side", "instruction": "ribs stacked" }
      ]
    },
    {
      "phase": "carry_block",
      "items": [
        { "name": "Suitcase Carry", "sets": "4", "duration": "45s", "instruction": "tall, no lean" }
      ]
    },
    {
      "phase": "conditioning",
      "items": [
        { "name": "Jump Rope", "sets": "8", "reps": "30s on/30s off", "instruction": "smooth wrists" },
        { "name": "Med Ball Slams", "sets": "8", "reps": "30s on/30s off", "instruction": "hips drive" }
      ]
    },
    {
      "phase": "cooldown",
      "items": [
        { "name": "Box Breathing", "duration": "2", "instruction": "longer exhale" }
      ]
    }
  ]
}

Also include:
- \`message\`: short one-line title like "Ocho System Power Flow (~${minutes} min)".
- Ensure time adds up to \`duration_min\`. If it won't, reduce reps/sets first, then shorten conditioning.

Context:
- User message: "${message || "(none)"}"
- Split hint (optional): ${split || "(none)"}
- Equipment: ${equipmentList.join(", ") || "(none)"}
- Preferences: prefer ${(prefs.preferred_exercises || []).join(", ") || "(none)"}; avoid ${(prefs.avoided_exercises || []).join(", ") || "(none)"}.
- Conditioning bias: ${prefs.conditioning_bias || "mixed"}
- Detail level: ${prefs.detail_level ?? 2}
`;

    const pass1 = await llmJSON({
      system: sysCapsule,
      user: "Create the workout plan JSON now.",
      max_tokens: 1600,
      temperature: 0.4
    });

    // ---------- Pass 2: Refine to constraints (no-repeat, canonical, prefs) ----------
    const refineSystem = `
You are revising an Ocho System workout plan to strictly adhere to constraints.

- Use ONLY these equipment names and their implements: ${equipmentList.join(", ") || "(none)"}.
- If cardio bike is used and "Exercise Bike" exists, call it exactly "Exercise Bike".
- Avoid exercises whose names match any of: ${recentLower.slice(0, 40).join(", ") || "(none recently)"} (recent window ${NO_REPEAT_DAYS} days). If something is essential, you may keep a close variant; otherwise swap to a comparable movement that uses owned equipment.
- Respect user preferences: Prefer ${(prefs.preferred_exercises || []).join(", ") || "(none)"}; Avoid ${(prefs.avoided_exercises || []).join(", ") || "(none)"}.
- Maintain Ocho System structure: prep → activation → strength → carry_block → conditioning → cooldown.
- Keep unilateral bias in strength phase with tempo notes.
- Ensure conditioning uses low-skill cyclical work or med-ball movements.
- Keep structure and time realism; do not add fluff.
- Return ONLY JSON in the exact schema of the input.

Refine this plan JSON:
`;
    const pass2 = await llmJSON({
      system: refineSystem,
      user: JSON.stringify(pass1),
      max_tokens: 1600,
      temperature: 0.2
    });

    // Extract coach message and plan from LLM response
    const coach = pass2?.coach || "";
    const plan = pass2?.plan || pass2;
    
    // Normalize plan structure
    const { plan: normalizedPlan, warnings } = normalizePlan(plan);
    const workout = toLegacyWorkout(normalizedPlan);
    
    // Use LLM-generated message or fallback
    const messageText = pass2?.message || `${normalizedPlan.name}${S(normalizedPlan.est_total_minutes ?? normalizedPlan.duration_min) ? ` (~${S(normalizedPlan.est_total_minutes ?? normalizedPlan.duration_min)} min)` : ""}`;

    return NextResponse.json({
      ok: true,
      name: normalizedPlan.name,
      message: messageText,
      coach,
      plan: normalizedPlan,
      workout,
      debug: {
        validation_ok: true,
        warnings,
        minutesRequested: minutes,
        split,
        equipmentList,
        recentWindowDays: NO_REPEAT_DAYS,
        usedTwoPass: true
      }
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: S(e?.message) || "Failed to generate workout plan" }, { status: 500 });
  }
}


