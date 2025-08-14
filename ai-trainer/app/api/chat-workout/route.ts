// app/api/chat-workout/route.ts
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

export const runtime = "nodejs";

// ---- Clients ----
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// ───────────────────────── helpers: equipment, prefs, recent, names ─────────────────────────
const S = (v: any) => (v == null ? undefined : String(v).trim());
const keyOf = (name: string) => String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "");

function hasEq(list: string[], q: RegExp) { return list.some(n => q.test(n)); }

async function getEquipmentNames(userId: string) {
  const { data, error } = await supabase
    .from("user_equipment")
    .select("is_available, equipment:equipment_id(name)")
    .eq("user_id", userId);
  if (error) return [];
  const names = (data ?? [])
    .filter((r: any) => r?.is_available !== false && r?.equipment?.name)
    .map((r: any) => String(r.equipment.name).trim());
  return Array.from(new Set(names));
}

async function getUserPrefs(userId: string) {
  const { data } = await supabase
    .from("user_preferences")
    .select("preferred_exercises, avoided_exercises, coaching_style, conditioning_bias, detail_level")
    .eq("user_id", userId)
    .maybeSingle();
  return {
    preferred: Array.isArray(data?.preferred_exercises) ? data!.preferred_exercises : [],
    avoided: Array.isArray(data?.avoided_exercises) ? data!.avoided_exercises : [],
    coaching_style: data?.coaching_style || null,
    conditioning_bias: data?.conditioning_bias || null,  // 'hiit' | 'steady' | 'mixed'
    detail_level: typeof data?.detail_level === "number" ? data!.detail_level : null, // 1..3
  };
}

// Pull recent exercises from both planned sessions and logged sets
// NO_REPEAT_DAYS: window to consider "recent"; MAX_RECENT: cap to keep set small
const NO_REPEAT_DAYS = 7;
const MAX_RECENT = 25;

async function buildRecentExerciseSet(userId: string) {
  const since = new Date();
  since.setDate(since.getDate() - NO_REPEAT_DAYS);
  const sinceISO = since.toISOString().slice(0, 10);

  const seen = new Set<string>();

  // 1) From workout_sessions.planned_exercises (JSON)
  const { data: sess } = await supabase
    .from("workout_sessions")
    .select("planned_exercises, date")
    .eq("user_id", userId)
    .gte("date", sinceISO)
    .order("date", { ascending: false })
    .limit(12);

  for (const s of sess || []) {
    const pe = s?.planned_exercises;
    if (pe && typeof pe === "object") {
      const phases = ["warmup", "main", "cooldown", "accessory", "conditioning"];
      for (const ph of phases) {
        const items = Array.isArray(pe[ph]) ? pe[ph] : [];
        for (const it of items) {
          const k = keyOf(it?.name);
          if (k) seen.add(k);
          if (seen.size >= MAX_RECENT) break;
        }
      }
    }
    if (seen.size >= MAX_RECENT) break;
  }

  // 2) From workout_entries/exercise_name (logged sets)
  if (seen.size < MAX_RECENT) {
    const { data: entries } = await supabase
      .from("workout_entries")
      .select("exercise_name, date")
      .eq("user_id", userId)
      .gte("date", sinceISO)
      .order("date", { ascending: false })
      .limit(200);
    for (const e of entries || []) {
      const k = keyOf(e?.exercise_name);
      if (k) seen.add(k);
      if (seen.size >= MAX_RECENT) break;
    }
  }

  return seen;
}

// Canonicalize & filter names according to owned equipment
function canonicalizeNameByEquipment(rawName: string, owned: string[]) {
  let name = String(rawName || "").trim();
  const L = owned.map(s => s.toLowerCase());

  // Bike synonyms → Exercise Bike (only if owned)
  if (/\b(air\s*bike|assault|echo|airdyne)\b/i.test(name)) {
    if (L.includes("exercise bike")) {
      name = name.replace(/\b(air\s*bike|assault|echo|airdyne)\b/gi, "Exercise Bike");
    } else {
      return null; // drop non-owned bike
    }
  }

  // Disallow rower/treadmill/skierg unless explicitly in user's equipment list
  if (/\b(row(er|ing)|erg|treadmill|ski\s*erg|skierg)\b/i.test(name)) {
    const ok = L.includes("rower") || L.includes("treadmill") || L.includes("ski erg");
    if (!ok) return null;
  }

  // Canonical plurals
  name = name
    .replace(/\bBarbells?\b/gi, "Barbell")
    .replace(/\bDumbbells?\b/gi, "Dumbbell")
    .replace(/\bKettlebells?\b/gi, "Kettlebell")
    .replace(/\bBattle\s*Ropes?\b/gi, "Battle Rope");

  return name;
}

// ---- Types ----
type PlanItem = {
  name: string;
  sets?: string | number;
  reps?: string | number;
  duration?: string;
  instruction?: string;
  isAccessory?: boolean;
};
type PlanPhase =
  | { phase: "warmup" | "main" | "accessory" | "conditioning" | "cooldown"; items: PlanItem[] };
type Plan = {
  name: string;
  duration_min?: number | string;
  phases: PlanPhase[];
  est_total_minutes?: number | string;
};
type Split = "push" | "pull" | "legs" | "upper" | "full";
type Theme = "strength" | "hypertrophy" | "conditioning" | "balanced" | "hiit";

// ---- DB helpers ----
async function getEquipmentForUser(userId: string | null): Promise<string[]> {
  if (!userId) return [];
  const { data } = await admin
    .from("user_equipment")
    .select("is_available, equipment:equipment_id(name)")
    .eq("user_id", userId);

  // Handle both shapes: equipment: { name }  OR  equipment: [{ name }]
  type Row = {
    is_available: boolean | null;
    equipment: { name?: string } | { name?: string }[] | null;
  };

  const rows = (data as Row[] | null) ?? [];
  const names: string[] = [];

  for (const r of rows) {
    if (r?.is_available === false || !r?.equipment) continue;
    const eq = Array.isArray(r.equipment) ? r.equipment[0] : r.equipment;
    const n = eq?.name?.trim();
    if (n) names.push(n);
  }

  return Array.from(new Set(names));
}

async function getUserPreferences(userId: string | null): Promise<{ preferred: string[]; avoided: string[] }> {
  if (!userId) return { preferred: [], avoided: [] };
  const { data } = await admin
    .from("user_preferences")
    .select("preferred_exercises, avoided_exercises")
    .eq("user_id", userId)
    .maybeSingle();
  return {
    preferred: Array.isArray(data?.preferred_exercises) ? (data!.preferred_exercises as string[]) : [],
    avoided: Array.isArray(data?.avoided_exercises) ? (data!.avoided_exercises as string[]) : [],
  };
}

// ---- Params / routing helpers ----
function parseMinutesFromMessage(msg: string): number | null {
  const m = (msg || "").toLowerCase();

  // e.g., "32 min", "32 minutes", "in 32", "for 32"
  const num = m.match(/\b(\d{2,3})\s*(?:min|minutes?)?\b/);
  if (num) {
    const n = parseInt(num[1], 10);
    if (n >= 10 && n <= 120) return n;
  }

  // phrases
  if (/\bhalf\s*hour\b/.test(m)) return 30;
  if (/\b(an?\s*)?hour\b/.test(m)) return 60;
  return null;
}

function parseThemeFromMessage(msg: string): Theme {
  const m = (msg || "").toLowerCase();
  if (/hiit|metcon|interval|emom|amrap|tabata/.test(m)) return "hiit";
  if (/strength|strong/.test(m)) return "strength";
  if (/hypertrophy|muscle/.test(m)) return "hypertrophy";
  if (/conditioning|cardio/.test(m)) return "conditioning";
  return "balanced";
}
function parseSplitFromQuery(url: URL): Split | null {
  const q = (url.searchParams.get("split") || "").toLowerCase().trim();
  return (["push", "pull", "legs", "upper", "full"].includes(q) ? (q as Split) : null);
}
function extractEquipmentExclusions(msg: string): string[] {
  const m = (msg || "").toLowerCase();
  const out: string[] = [];
  if (/\b(no|without)\s*(air\s*bike|assault|echo|airdyne|bike)\b/.test(m)) out.push("Exercise Bike");
  return Array.from(new Set(out));
}

// ---- Vocabulary & harmonization ----
function buildEquipmentVocabulary(allowed: string[]) {
  const vocab = Array.from(new Set(allowed)); // exact DB strings, case preserved
  const renameMap: Record<string, string> = {};
  if (vocab.includes("Exercise Bike")) {
    ["air bike", "assault bike", "echo bike", "airdyne"].forEach(a => (renameMap[a] = "Exercise Bike"));
  }
  if (vocab.includes("Battle Rope")) {
    ["battle ropes", "battle rope"].forEach(a => (renameMap[a] = "Battle Rope"));
  }
  if (vocab.includes("Kettlebells")) {
    ["kettlebell", "kb"].forEach(a => (renameMap[a] = "Kettlebells"));
  }
  if (vocab.includes("Dumbbells")) {
    ["dumbbell", "db"].forEach(a => (renameMap[a] = "Dumbbells"));
  }
  if (vocab.includes("Barbells")) {
    ["barbell"].forEach(a => (renameMap[a] = "Barbells"));
  }
  // (intentionally no generic tokens like "rope"/"box")
  return { vocab, renameMap };
}

function replaceSynonymsOnce(text: string, renameMap: Record<string, string>) {
  let out = text || "";
  const entries = Object.entries(renameMap).sort((a, b) => b[0].length - a[0].length);
  for (const [alias, target] of entries) {
    const targetRe = new RegExp(`\\b${target.replace(/\s+/g, "\\s+")}\\b`, "i");
    if (targetRe.test(out)) continue;
    const aliasRe = new RegExp(`\\b${alias.replace(/\s+/g, "\\s+")}\\b`, "ig");
    out = out.replace(aliasRe, target);
  }
  // collapse accidental duplicates
  out = out.replace(/\b(\w+)(\s+\1\b)+/gi, "$1");
  out = out.replace(/\b(Battle)\s+\1\s+Rope\b/gi, "Battle Rope");
  out = out.replace(/\b(Plyo)\s+\1\s+Box\b/gi, "Plyo Box");
  return out.trim().replace(/\s{2,}/g, " ");
}
function harmonizePlanEquipmentNames(plan: Plan, renameMap: Record<string, string>) {
  plan.phases.forEach(p => {
    p.items = p.items.map(it => ({ ...it, name: replaceSynonymsOnce(it.name || "", renameMap) }));
  });
}
function harmonizeCoachMessage(msg: string, renameMap: Record<string, string>) {
  return replaceSynonymsOnce(msg, renameMap);
}

// ---- Normalize + legacy shaping ----
function coerceToString(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  return typeof v === "number" ? String(v) : String(v);
}
function normalizePlan(input: any) {
  const warnings: string[] = [];
  if (!input || typeof input !== "object") {
    return { plan: null as unknown as Plan, warnings: ["LLM returned empty or non-object JSON"] };
  }
  const plan: Plan = {
    name: String(input.name ?? "Workout"),
    duration_min: input.duration_min ?? input.est_total_minutes,
    phases: Array.isArray(input.phases)
      ? input.phases.map((p: any) => {
          const phase = String(p?.phase ?? "").toLowerCase();
          const allowed: PlanPhase["phase"][] = ["warmup", "main", "accessory", "conditioning", "cooldown"];
          const normalizedPhase = allowed.includes(phase as any) ? (phase as PlanPhase["phase"]) : "main";
          if (phase !== normalizedPhase) warnings.push(`Unknown phase "${phase}" → coerced to "main"`);
          const items: PlanItem[] = Array.isArray(p?.items)
            ? p.items.map((it: any) => ({
                name: String(it?.name ?? "Exercise"),
                sets: coerceToString(it?.sets),
                reps: coerceToString(it?.reps),
                duration: it?.duration ? String(it.duration) : undefined,
                instruction: it?.instruction ? String(it.instruction) : undefined,
                isAccessory: Boolean(it?.isAccessory),
              }))
            : [];
          return { phase: normalizedPhase, items };
        })
      : [],
    est_total_minutes: input.est_total_minutes ?? input.duration_min,
  };
  const ensure = (k: PlanPhase["phase"]) => {
    if (!plan.phases.some(ph => ph.phase === k)) plan.phases.push({ phase: k, items: [] });
  };
  ensure("warmup");
  ensure("main");
  ensure("cooldown");
  return { plan, warnings };
}
function toLegacyWorkout(plan: Plan, opts?: { theme?: Theme }) {
  const get = (k: PlanPhase["phase"]) => plan.phases.find(p => p.phase === k)?.items ?? [];

  const warmup = get("warmup").map(it => ({
    name: it.name,
    sets: it.sets ?? "1",
    reps: it.reps ?? "10-15",
    instruction: it.instruction ?? "",
  }));

  const PRIMARY_MAIN_COUNT = 2; // set 1 if you want a single primary
  const mainItems = get("main");
  const mainPrimaryAndSecondary = mainItems.map((it, idx) => ({
    name: it.name,
    sets: it.sets ?? "3",
    reps: it.reps ?? "8-12",
    instruction: it.instruction ?? "",
    isAccessory: idx >= PRIMARY_MAIN_COUNT,
  }));

  const accessories = get("accessory").map(it => ({
    name: it.name,
    sets: it.sets ?? "3",
    reps: it.reps ?? "10-15",
    instruction: it.instruction ?? "",
    isAccessory: true,
  }));

  const cooldown = get("cooldown").map(it => ({
    name: it.name,
    duration: it.duration ?? (it.reps ? String(it.reps) : "30-60s"),
    instruction: it.instruction ?? "",
  }));

  let mainOut = [...mainPrimaryAndSecondary, ...accessories];

  // HIIT fallback: if MAIN empty, surface conditioning stations into table
  if ((opts?.theme === "hiit" || mainOut.length === 0) && get("conditioning").length > 0 && mainItems.length === 0) {
    const stations = get("conditioning").map(it => ({
      name: it.name,
      sets: it.sets ?? "4-5 rounds",
      reps: it.reps ?? (it.duration ? String(it.duration) : "40s/20s"),
      instruction: it.instruction ?? "",
      isAccessory: true,
    }));
    mainOut = stations;
  }

  return { warmup, main: mainOut, cooldown };
}

// ---- Narrative helpers ----
function fmtItem(it: PlanItem): string {
  if (it.sets && it.reps) return `${it.name} — ${String(it.sets)}×${String(it.reps)}`;
  if (it.duration) return `${it.name} — ${String(it.duration)}`;
  return it.name;
}
function renderSpecificCoachMessage(plan: Plan, durationMin: number): string {
  const warm = plan.phases.find(p => p.phase === "warmup")?.items ?? [];
  const main = plan.phases.find(p => p.phase === "main")?.items ?? [];
  const acc = plan.phases.find(p => p.phase === "accessory")?.items ?? [];
  const cond = plan.phases.find(p => p.phase === "conditioning")?.items ?? [];
  const cool = plan.phases.find(p => p.phase === "cooldown")?.items ?? [];

  const wMin = Math.min(8, Math.max(5, Math.round(durationMin * 0.14)));
  const aMin = Math.max(10, Math.round(durationMin * 0.28));
  const bMin = Math.max(8, Math.round(durationMin * 0.22));
  const uMin = Math.max(6, Math.round(durationMin * 0.18));
  const fMin = Math.max(4, durationMin - (wMin + aMin + bMin + uMin + 3));

  const A = main.slice(0, 2);
  const B = main.slice(2, 4);
  const U = acc.slice(0, 2);
  const F = cond.slice(0, 2);

  const lines: string[] = [];
  lines.push(`Got it — ${durationMin} minutes.`);
  lines.push("");
  lines.push(`0:00–${String(wMin).padStart(2, " ")}:00 – Prep`);
  warm.slice(0, 4).forEach((it, i) => lines.push(`${i + 1}. ${fmtItem(it)}`));

  lines.push("");
  lines.push(`${String(wMin).padStart(2, " ")}:00–${String(wMin + aMin).padStart(2, " ")}:00 – Power & Strength A`);
  (A.length ? A : main.slice(0, 2)).forEach((it, i) => lines.push(`${i + 1}. ${fmtItem(it)}`));

  lines.push("");
  lines.push(`${String(wMin + aMin).padStart(2, " ")}:00–${String(wMin + aMin + bMin).padStart(2, " ")}:00 – Power & Strength B`);
  (B.length ? B : main.slice(2, 4)).forEach((it, i) => lines.push(`${i + 1}. ${fmtItem(it)}`));

  lines.push("");
  lines.push(`${String(wMin + aMin + bMin).padStart(2, " ")}:00–${String(wMin + aMin + bMin + uMin).padStart(2, " ")}:00 – Unilateral + Pull`);
  (U.length ? U : acc.slice(0, 2)).forEach((it, i) => lines.push(`${i + 1}. ${fmtItem(it)}`));

  lines.push("");
  lines.push(`${String(wMin + aMin + bMin + uMin).padStart(2, " ")}:00–${String(wMin + aMin + bMin + uMin + fMin).padStart(2, " ")}:00 – Finisher`);
  (F.length ? F : [{ name: "EMOM — Swings", reps: "20", sets: "4" } as PlanItem]).forEach((it, i) => lines.push(`${i + 1}. ${fmtItem(it)}`));

  lines.push("");
  lines.push(`${String(durationMin - 3).padStart(2, " ")}:00–${String(durationMin).padStart(2, " ")}:00 – Cooldown`);
  cool.slice(0, 3).forEach((it, i) => lines.push(`${i + 1}. ${fmtItem(it)}`));

  return lines.join("\n").trim();
}
function stripLegacySections(msg: string): string {
  const s = (msg || "").trim();
  if (!s) return s;

  // Find the first section header and truncate there.
  const headerRx =
    /(^|\n)\s*(?:\*\*|\*)?\s*(?:🔥|💪|🧘)?\s*(warm[-\s]?up|main(?:\s*workout)?|conditioning|cool[-\s]?down)\s*:?\s*(?:\*\*|\*)?\s*(?=\n|$)/i;

  const m = s.match(headerRx);
  if (!m) return s;

  const cutIndex = m.index!; // start of first header
  const trimmed = s.slice(0, cutIndex).trim();

  // If nothing useful before header, fall back to removing headers+lists everywhere
  if (trimmed.length < 20) {
    return s
      .split("\n")
      .filter(line => !headerRx.test(line))
      .join("\n")
      .replace(/^\s*[\d\-\*]+\.\s+.*$/gim, "") // remove numbered/bulleted items that followed
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
  return trimmed;
}

// ---- Split → primary requirements ----
type PrimarySpec = {
  promptBullets: string[];
  require: Array<RegExp[]>;
};
function primarySpecForSplit(split: Split, equipmentList: string[]): PrimarySpec {
  const has = (k: string) => equipmentList.some(e => new RegExp(`\\b${k}\\b`, "i").test(e));
  const preferBarbell = has("Barbells");
  const preferTrap = has("Trap Bar");
  const preferDB = has("Dumbbells");
  const preferKB = has("Kettlebells");

  const pressLabel = preferBarbell
    ? "Barbell Bench Press / Incline Bench"
    : preferDB
    ? "Dumbbell Bench Press / Incline Bench"
    : "Floor Press / Push Press";
  const ohpLabel = preferBarbell ? "Barbell Overhead Press" : preferDB ? "Dumbbell Shoulder Press" : "Kettlebell Push Press";
  const deadliftLabel = preferTrap
    ? "Trap Bar Deadlift"
    : preferBarbell
    ? "Barbell Deadlift"
    : preferDB
    ? "Dumbbell Romanian Deadlift"
    : preferKB
    ? "Kettlebell Deadlift"
    : "Hip Hinge Deadlift";
  const squatLabel = preferBarbell
    ? "Back Squat / Front Squat"
    : preferDB
    ? "Goblet Squat / DB Front Squat"
    : "Kettlebell Goblet/Front Rack Squat";

  switch (split) {
    case "push":
      return {
        promptBullets: [`MAIN first two items must be presses: (a) ${pressLabel}, (b) ${ohpLabel} or another heavy press.`],
        require: [[/(bench|incline)\s*press/i], [/(overhead|shoulder)\s*press|push\s*press/i]],
      };
    case "pull":
      return {
        promptBullets: [
          `MAIN must start with a heavy deadlift hinge (e.g., ${deadliftLabel}).`,
          `Second MAIN can be a heavy row or pull-up variant.`,
        ],
        require: [[/deadlift/i]],
      };
    case "legs":
      return {
        promptBullets: [
          `MAIN must include a heavy squat as first item (e.g., ${squatLabel}).`,
          `Second MAIN can be hinge or quad-dominant accessory.`,
        ],
        require: [[/(back|front)\s*squat|(?<!jump\s)goblet\s*squat/i]],
      };
    case "upper":
      return {
        promptBullets: [
          `MAIN must include (a) one heavy press (e.g., ${pressLabel} or ${ohpLabel}) AND (b) one heavy pull (row or pull-up).`,
        ],
        require: [[/(bench|incline)\s*press|(overhead|shoulder)\s*press|push\s*press/i], [/\brow\b|pull[-\s]?up|chin[-\s]?up/i]],
      };
    case "full":
      return {
        promptBullets: [`MAIN must include exactly two primaries: (a) one lower (squat or deadlift), (b) one upper (press or row).`],
        require: [[/deadlift|squat/i], [/(bench|incline)\s*press|(overhead|shoulder)\s*press|push\s*press|\brow\b|pull[-\s]?up|chin[-\s]?up/i]],
      };
  }
}
function mainSatisfies(plan: Plan, spec: PrimarySpec): boolean {
  const main = plan.phases.find(p => p.phase === "main")?.items ?? [];
  const names = main.map(i => String(i.name || "").toLowerCase());
  return spec.require.every(group => group.some(rx => names.some(n => rx.test(n))));
}

// ---- LLM I/O ----
function findJsonObject(s: string): string | null {
  const m = s.match(/\{[\s\S]*\}/);
  return m ? m[0] : null;
}
function extractAiText(resp: any) {
  return (resp?.content ?? [])
    .map((b: any) => (b && typeof b === "object" && "text" in b ? b.text : ""))
    .join("\n");
}
async function callPlannerLLM(userMessage: string, cues: {
  durationMin: number;
  equipmentList: string[];
  theme: Theme;
  exclusions: string[];
  vocab: string[];
  split: Split | null;
  splitBullets?: string[];
  prefer?: string[];
  avoid?: string[];
}): Promise<string> {
  const splitText = cues.split
    ? `Split focus: ${cues.split}. ${(cues.splitBullets || []).map(b => "- " + b).join("\n")}`
    : "Split focus: balanced.";

  const preferText = cues.prefer && cues.prefer.length ? `Prefer when reasonable: ${cues.prefer.join(", ")}.` : "";
  const avoidText = cues.avoid && cues.avoid.length ? `Avoid (do not include): ${cues.avoid.join(", ")}.` : "";

  const prompt = `
Return ONLY JSON (no markdown/fences):
{
  "plan": {
    "name": string,
    "duration_min": number,
    "phases": [
      { "phase": "warmup"|"main"|"accessory"|"conditioning"|"cooldown",
        "items": [ { "name": string, "sets"?: string|number, "reps"?: string|number, "duration"?: string, "instruction"?: string, "isAccessory"?: boolean } ]
      }
    ],
    "est_total_minutes"?: number
  },
  "coach_message": string
}

Hard rules:
- Target duration: ${cues.durationMin} minutes.
- Use ONLY this equipment (exact, case-sensitive): ${JSON.stringify(cues.vocab)}.
- EXCLUSIONS: ${cues.exclusions.join(", ") || "none"}.
- ${avoidText}
- ${preferText}
- BANNED: snatch/clean/jerk. If requested, SUBSTITUTE to Kettlebell High Pull or Push Press.
- MAIN uses sets×reps (no duration-only in MAIN). Put duration-only in CONDITIONING.

Output rules (must follow):
- Use ONLY the user's available equipment: ${cues.equipmentList.join(', ')}.
- Canonical names: "Exercise Bike" (not Air/Assault/Echo), "Battle Rope", "Dumbbell", "Barbell", "Kettlebell".
- No olympic lifts: no snatch, clean, jerk (and variants).
- Always return JSON only. sets/reps/duration must be strings.
- Every item MUST include a short "instruction" cue (1–2 coaching notes).
- If there is a conditioning block or the request implies HIIT, each station MUST include:
  • exact interval format (e.g., "40s work / 20s rest"),
  • target intensity (RPE 7–9 or %HRmax),
  • 1 technique cue (e.g., "braced torso"), and how to breathe ("nasal inhale on recovery").
- Phases must be one of: warmup | main | accessory | conditioning | cooldown.
- Use only equipment the user owns. If you'd pick something else, substitute with owned equipment.

${splitText}

Coach message: single time-block narrative; list exact items per block that match the plan; include sets×reps or work:rest; no duplicate "Warm-up/Main/Cool-down" section.

Theme: ${cues.theme}. User: "${userMessage}"
`.trim();

  const resp = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    temperature: 0.2,
    max_tokens: 1900,
    messages: [{ role: "user", content: prompt }],
  });
  return extractAiText(resp);
}
async function repairPlanWithPrimaries(originalPlan: any, cues: {
  durationMin: number; vocab: string[]; split: Split; spec: PrimarySpec;
}) {
  const prompt = `
You returned a plan that lacks required MAIN primaries for split="${cues.split}".
Revise minimally so MAIN's first 2 items satisfy:
${cues.spec.promptBullets.map(b => "- " + b).join("\n")}
Use ONLY equipment: ${JSON.stringify(cues.vocab)}. Keep durations/conditioning intact.
Return JSON with "plan" only.

Original plan:
${JSON.stringify(originalPlan)}
`.trim();

  const resp = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    temperature: 0.1,
    max_tokens: 1400,
    messages: [{ role: "user", content: prompt }],
  });
  return extractAiText(resp);
}

// ---- Equipment feasibility guard (vocab-only; uses user_equipment) ----
function enforceEquipmentGuard(plan: Plan, allowedExact: string[], exclusions: string[]) {
  const allow = new Set(allowedExact.map(s => s.toLowerCase()));
  const block = new Set(exclusions.map(s => s.toLowerCase()));

  type AliasGroup = { canonical: string; aliases: RegExp[]; fallback: string };
  const groups: AliasGroup[] = [];

  // Only consider Exercise Bike (based on your DB). Add more later if you add them to user_equipment.
  groups.push({
    canonical: "exercise bike",
    aliases: [/\bair\s*bike\b/i, /\bassault\s*bike\b/i, /\becho\s*bike\b/i, /\bairdyne\b/i],
    fallback: allow.has("battle rope") ? "Battle Rope Waves"
      : allow.has("kettlebells") ? "Kettlebells Swings"
      : allow.has("jump rope") ? "Jump Rope"
      : allow.has("medicine ball") ? "Medicine Ball Slams"
      : "Burpees"
  });

  const needsGroup = (name: string): AliasGroup | null => {
    for (const g of groups) {
      if (g.aliases.some(rx => rx.test(name))) return g;
      if (new RegExp(`\\b${g.canonical}\\b`, "i").test(name)) return g;
    }
    return null;
  };

  plan.phases.forEach(ph => {
    const keep: PlanItem[] = [];
    for (const it of ph.items) {
      const g = needsGroup(it.name || "");
      if (!g) { keep.push(it); continue; }
      const allowed = allow.has(g.canonical);
      const excluded = block.has(g.canonical);
      if (!allowed || excluded) {
        keep.push({ ...it, name: g.fallback, instruction: it.instruction ?? "Swapped for unavailable machine" });
      } else {
        keep.push(it);
      }
    }
    ph.items = keep;
  });
}

// ---- Route handlers ----
export async function GET(req: Request) {
  const qs = Object.fromEntries(new URL(req.url).searchParams);
  const hint = "POST { message } with ?user=UUID&min=45&split=push|pull|legs|upper|full&style=hiit|strength";
  return NextResponse.json({ ok: true, hint, qs });
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const searchParams = url.searchParams;
  const body = await req.json().catch(() => ({}));
  const message: string = body?.message || "";

  // 0) context
  const userId = String(searchParams.get("user") || body.userId || "").trim();
  const equipmentList = await getEquipmentNames(userId);
  const prefs = await getUserPrefs(userId);
  const recentSet = await buildRecentExerciseSet(userId);

  // 1) strengthen prompt (append to your existing prompt text)
  const preferLine = prefs.preferred.length ? `Prefer: ${prefs.preferred.join(", ")}.` : "";
  const avoidLine  = prefs.avoided.length   ? `Avoid: ${prefs.avoided.join(", ")}.` : "";
  const styleLine  = prefs.coaching_style   ? `Tone: ${prefs.coaching_style}.` : "Tone: concise.";
  const condBias   = prefs.conditioning_bias || "mixed";
  const detail     = prefs.detail_level || 2;

  let prompt = `
Return ONLY JSON (no markdown/fences):
{
  "plan": {
    "name": string,
    "duration_min": number,
    "phases": [
      { "phase": "warmup"|"main"|"accessory"|"conditioning"|"cooldown",
        "items": [ { "name": string, "sets"?: string|number, "reps"?: string|number, "duration"?: string, "instruction"?: string, "isAccessory"?: boolean } ]
      }
    ],
    "est_total_minutes"?: number
  },
  "coach_message": string
}

Context:
- Equipment you may use exactly: ${equipmentList.join(", ")}.
- ${preferLine}
- ${avoidLine}
- Conditioning preference: ${condBias}. Detail level: ${detail} (1=min, 2=normal, 3=rich).

Output rules (must follow):
- Use ONLY the equipment listed (do not invent devices). Normalize names: "Exercise Bike", "Battle Rope", "Barbell", "Dumbbell", "Kettlebell".
- No olympic lifts (no snatch, clean, jerk or variants).
- Return ONLY JSON. sets/reps/duration MUST be strings.
- Include a brief "instruction" cue for EVERY item (1–2 crisp coaching tips).
- If HIIT/conditioning is present, give exact intervals (e.g., "40s work / 20s rest") + intensity (e.g., "RPE 8") + a breath/tempo cue.
${styleLine}

User: "${message}"
`.trim();

  // 2) ... you already parse model text → parsed → const { plan, warnings } = normalizePlan(parsed);
  const resp = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    temperature: 0.2,
    max_tokens: 1900,
    messages: [{ role: "user", content: prompt }],
  });

  const aiText = (resp?.content ?? [])
    .map((b: any) => (b && typeof b === "object" && "text" in b ? b.text : ""))
    .join("\n");

  let parsed: any = null;
  try {
    parsed = JSON.parse(aiText);
  } catch {
    const fence = aiText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fence?.[1]) parsed = JSON.parse(fence[1]);
    else {
      const chunk = aiText.match(/\{[\s\S]*\}/);
      if (chunk) parsed = JSON.parse(chunk[0]);
    }
  }

  const rawPlan = parsed?.plan ?? parsed;
  let { plan, warnings } = normalizePlan(rawPlan);
  if (!plan) {
    return NextResponse.json(
      { ok: false, error: "Failed to generate workout plan", details: "Planner JSON failed validation" },
      { status: 400 }
    );
  }

  // 3) Universal Guard + No-Repeat (non-destructive; fills gaps; rotates recent)
  (function guardAndRotate() {
    const equipmentLower = equipmentList.map(s => s.toLowerCase());
    const hasTrapBar      = hasEq(equipmentLower, /\btrap\s*bar\b/);
    const hasBarbell      = hasEq(equipmentLower, /\bbarbells?\b/);
    const hasBench        = hasEq(equipmentLower, /\b(adjustable\s+)?bench\b/);
    const hasRack         = hasEq(equipmentLower, /\bsquat\s*rack\b/);
    const hasDumbbell     = hasEq(equipmentLower, /\bdumbbells?\b/);
    const hasKettlebell   = hasEq(equipmentLower, /\bkettlebells?\b/);
    const hasPullupBar    = hasEq(equipmentLower, /\bpull\s*up\s*bar\b/);
    const hasCables       = hasEq(equipmentLower, /\bcables?\b/);
    const hasBattleRope   = hasEq(equipmentLower, /\bbattle\s*rope\b/);
    const hasExerciseBike = hasEq(equipmentLower, /\bexercise\s*bike\b/);
    const hasJumpRope     = hasEq(equipmentLower, /\bjump\s*rope\b/);
    const hasPlyoBox      = hasEq(equipmentLower, /\bplyo\s*box\b/);
    const hasMedBall      = hasEq(equipmentLower, /\bmedicine\s*ball\b/);
    const hasBall         = hasEq(equipmentLower, /\bexercise\s*ball\b/);
    const hasBands        = hasEq(equipmentLower, /\b(mini|super)bands?\b/);

    const ensurePhase = (k: any) => {
      let ph = plan.phases.find((p: any) => p.phase === k);
      if (!ph) { ph = { phase: k, items: [] }; plan.phases.push(ph); }
      return ph;
    };
    const warmupPh = ensurePhase("warmup");
    const mainPh   = ensurePhase("main");
    const accPh    = ensurePhase("accessory");
    const condPh   = ensurePhase("conditioning");
    const coolPh   = ensurePhase("cooldown");

    // Canonicalize & drop non-owned devices
    for (const ph of plan.phases) {
      const kept: any[] = [];
      for (const it of ph.items || []) {
        const n0 = S(it?.name);
        if (!n0) continue;
        const n1 = canonicalizeNameByEquipment(n0, equipmentList);
        if (!n1) continue;
        it.name = n1;
        kept.push(it);
      }
      ph.items = kept;
    }

    const hasName = (ph: any, re: RegExp) =>
      ph.items?.some((it: any) => re.test(String(it?.name || "").toLowerCase()));

    // Ensure a main lift depending on message/split hints (simple inference)
    const msg = String(body?.message || "").toLowerCase();
    const wantHIIT = /\b(hiit|interval|tabata|emom|finisher|conditioning|ocho)\b/.test(msg);

    function addMainIfMissing() {
      if (wantHIIT) return; // HIIT may not require heavy main lift
      // Push/upper: bench/press
      if (/\bpush|upper\b/.test(msg)) {
        if (!hasName(mainPh, /(bench|overhead\s*press)/)) {
          if (hasBarbell && hasBench) mainPh.items.unshift({ name: "Barbell Bench Press", sets: "4", reps: "6-8", instruction: "Feet set, controlled descent" });
          else if (hasDumbbell && hasBench) mainPh.items.unshift({ name: "Dumbbell Bench Press", sets: "4", reps: "6-8", instruction: "Neutral wrist, leg drive" });
          else if (hasBarbell) mainPh.items.unshift({ name: "Barbell Overhead Press", sets: "4", reps: "5-8", instruction: "Glutes on, ribs down" });
          else if (hasDumbbell) mainPh.items.unshift({ name: "Dumbbell Overhead Press", sets: "4", reps: "6-10", instruction: "Stack lockout" });
        }
      }
      // Pull/upper: deadlift/row/pull-up
      if (/\bpull|upper\b/.test(msg)) {
        if (!hasName(mainPh, /(deadlift|row|pull\s*ups?)/)) {
          if (hasTrapBar) mainPh.items.unshift({ name: "Trap Bar Deadlift", sets: "4", reps: "4-6", instruction: "Hips back, brace 360°" });
          else if (hasBarbell) mainPh.items.unshift({ name: "Barbell Deadlift", sets: "4", reps: "3-5", instruction: "Bar close, wedge hard" });
          else mainPh.items.unshift({ name: "Barbell Row", sets: "4", reps: "6-10", instruction: "Hinge torso, pull to ribs" });
        }
      }
      // Legs/full: squat/deadlift
      if (/\blegs|full\b/.test(msg) || (!/\bpush|pull|upper|hiit\b/.test(msg) && !wantHIIT)) {
        if (!hasName(mainPh, /(squat|deadlift)/)) {
          if (hasBarbell && hasRack) mainPh.items.unshift({ name: "Barbell Back Squat", sets: "5", reps: "3-5", instruction: "Control down, drive up" });
          else if (hasTrapBar) mainPh.items.unshift({ name: "Trap Bar Deadlift", sets: "4", reps: "4-6", instruction: "Drive floor away" });
        }
      }
    }
    addMainIfMissing();

    // No-Repeat: rotate out items that appeared recently (within NO_REPEAT_DAYS)
    function rotatePhase(ph: any, pool: string[]) {
      const out: any[] = [];
      for (const it of ph.items || []) {
        const k = keyOf(it?.name);
        if (!k) continue;
        if (!recentSet.has(k)) { out.push(it); continue; }
        // choose first alt that isn't recent & is owned
        const alt = pool.find(n => !recentSet.has(keyOf(n)) && canonicalizeNameByEquipment(n, equipmentList));
        if (alt) {
          out.push({ name: alt, sets: it.sets || "3", reps: it.reps || "8-12", duration: it.duration, instruction: it.instruction || "Crisp form", isAccessory: it.isAccessory || false });
        } else {
          // keep original if no safe alt
          out.push(it);
        }
      }
      ph.items = out;
    }

    // Alternate pools by category (lean, safe swaps only)
    const pushAlts = [
      hasBarbell && hasBench ? "Barbell Bench Press" : null,
      hasDumbbell && hasBench ? "Dumbbell Bench Press" : null,
      hasBarbell ? "Barbell Overhead Press" : null,
      hasDumbbell ? "Dumbbell Overhead Press" : null,
      hasCables ? "Cable Chest Fly" : null,
      hasDumbbell ? "Dumbbell Incline Press" : null,
    ].filter(Boolean) as string[];

    const pullAlts = [
      hasTrapBar ? "Trap Bar Deadlift" : null,
      hasBarbell ? "Barbell Deadlift" : null,
      "Barbell Row",
      hasPullupBar ? "Pull Ups" : null,
      hasDumbbell ? "Single Arm Dumbbell Row" : null,
      hasCables ? "Cable Face Pull" : null,
    ].filter(Boolean) as string[];

    const legsAlts = [
      hasBarbell && hasRack ? "Barbell Back Squat" : null,
      hasBarbell && hasRack ? "Barbell Front Squat" : null,
      hasTrapBar ? "Trap Bar Deadlift" : null,
      hasKettlebell ? "Kettlebell Goblet Squat" : null,
      hasDumbbell ? "Dumbbell RDL" : null,
    ].filter(Boolean) as string[];

    const condAlts = [
      hasBattleRope ? "Battle Rope Waves" : null,
      hasKettlebell ? "Kettlebell Swings" : null,
      hasExerciseBike ? "Exercise Bike Sprint" : null,
      hasMedBall ? "Medicine Ball Slams" : null,
      hasJumpRope ? "Jump Rope" : null,
      hasPlyoBox ? "Box Step-Overs" : null,
    ].filter(Boolean) as string[];

    // Apply rotation (don't mutate warmup/cooldown too aggressively)
    rotatePhase(mainPh,   [...pushAlts, ...pullAlts, ...legsAlts]);
    rotatePhase(accPh,    [...pushAlts, ...pullAlts, ...legsAlts]);
    rotatePhase(condPh,   condAlts);

    // Ensure some basics exist
    const ensureMin = (ph: any, n: number, picks: string[]) => {
      let i = 0;
      while (ph.items.length < n && i < picks.length) {
        const cand = picks[i++];
        if (recentSet.has(keyOf(cand))) continue;
        const okName = canonicalizeNameByEquipment(cand, equipmentList);
        if (!okName) continue;
        ph.items.push({ name: okName, sets: "3", reps: "8-12", instruction: "Controlled tempo", isAccessory: true });
      }
    };
    if (accPh.items.length < 2 && !wantHIIT) ensureMin(accPh, 2, [...pushAlts, ...pullAlts, ...legsAlts]);
    if (condPh.items.length < 1 && (wantHIIT || /\bfinisher|conditioning\b/.test(msg))) ensureMin(condPh, 2, condAlts);

    // De-dup across phases
    const seen = new Set<string>();
    for (const p of ["warmup","main","accessory","conditioning","cooldown"]) {
      const ph = plan.phases.find((x: any) => x.phase === p);
      if (!ph) continue;
      const out: any[] = [];
      for (const it of ph.items || []) {
        const k = keyOf(it?.name);
        if (!k || seen.has(k)) continue;
        seen.add(k);
        out.push(it);
      }
      ph.items = out;
    }
  })();

  // Legacy shape for your UI
  const workout = toLegacyWorkout(plan, { theme: "balanced" });
  const minutes = Number(plan.est_total_minutes ?? plan.duration_min ?? 45) || 45;

  // Narrative
  let messageOut = (typeof parsed?.coach_message === "string" ? parsed.coach_message : "").trim();
  if (!messageOut) messageOut = "Workout generated successfully!";

  return NextResponse.json({
    ok: true,
    message: messageOut,
    plan,
    workout,
    debug: {
      version: "chat-workout:v11-universal-guard-no-repeat",
      validation_ok: true,
      warnings,
      durationMin: minutes,
      equipmentList,
      recentWindowDays: NO_REPEAT_DAYS,
      recentCount: recentSet.size,
    },
  });
}


