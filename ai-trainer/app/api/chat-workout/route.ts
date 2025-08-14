// app/api/chat-workout/route.ts
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// ---- Clients ----
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

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
  const user = url.searchParams.get("user");
  const styleParam = url.searchParams.get("style") || url.searchParams.get("type");
  const split = parseSplitFromQuery(url);
  const queryMin = Number(url.searchParams.get("min") || 45);

  const body = await req.json().catch(() => ({}));
  const message: string = body?.message || "";
  const msgMin = parseMinutesFromMessage(message);
  const durationMin = msgMin ?? queryMin; // ← prefer what the user typed

  // DB: equipment + preferences
  const equipmentList = await getEquipmentForUser(user);
  const { vocab, renameMap } = buildEquipmentVocabulary(equipmentList);
  const prefs = await getUserPreferences(user);

  // Theme + exclusions
  let theme: Theme = parseThemeFromMessage(message);
  if (styleParam && /hiit|interval|emom|amrap|tabata/i.test(styleParam)) theme = "hiit";
  const exclusions = extractEquipmentExclusions(message);

  // Split rules
  const splitSpec = split ? primarySpecForSplit(split, equipmentList) : null;

  // ---- LLM call
  let aiText = await callPlannerLLM(message || `${split ?? "full"} workout`, {
    durationMin,
    equipmentList,
    theme,
    exclusions,
    vocab,
    split,
    splitBullets: splitSpec?.promptBullets,
    prefer: prefs.preferred,
    avoid: prefs.avoided,
  });

  // ---- Parse JSON
  let parsed: any = null;
  try {
    parsed = JSON.parse(aiText);
  } catch {
    const fence = aiText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fence?.[1]) parsed = JSON.parse(fence[1]);
    else {
      const chunk = findJsonObject(aiText);
      if (chunk) parsed = JSON.parse(chunk);
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

  // ───────────────────────── Universal Plan Guard ─────────────────────────
  // Keeps model content; fills only what's missing. Uses user_equipment strictly.
  // Works for ALL splits (push/pull/legs/upper/full/hiit/custom).

  // local helpers
  const S = (v: any) => (v == null ? undefined : String(v).trim());
  const hasEq = (list: string[], q: RegExp) => list.some(n => q.test(n));
  const makeItem = (
    name: string,
    opts: Partial<{sets: string; reps: string; duration: string; instruction: string; isAccessory: boolean}> = {}
  ) => ({
    name,
    ...(opts.sets ? { sets: String(opts.sets) } : {}),
    ...(opts.reps ? { reps: String(opts.reps) } : {}),
    ...(opts.duration ? { duration: String(opts.duration) } : {}),
    ...(opts.instruction ? { instruction: String(opts.instruction) } : {}),
    isAccessory: Boolean(opts.isAccessory),
  });
  const ensurePhase = (phase: PlanPhase['phase']) => {
    let ph = plan.phases.find(p => p.phase === phase);
    if (!ph) { ph = { phase, items: [] as any[] }; plan.phases.push(ph); }
    return ph;
  };
  const hasName = (ph: {items: any[]}, re: RegExp) =>
    ph.items?.some(it => re.test(String(it?.name || '').toLowerCase()));
  const addIfMissing = (ph: {items: any[]}, re: RegExp, add: () => any | null) => {
    if (!hasName(ph, re)) {
      const next = add();
      if (next) ph.items.push(next);
    }
  };
  const ensureMinItems = (ph: {items: any[]}, min: number, picks: Array<() => any | null>) => {
    let i = 0;
    while (ph.items.length < min && i < picks.length) {
      const cand = picks[i++]();
      if (cand) ph.items.push(cand);
    }
  };
  const keyOf = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const dedupPhaseItems = (ph: {items: any[]}, seen: Set<string>) => {
    const out: any[] = [];
    for (const it of ph.items || []) {
      const k = keyOf(String(it?.name || ''));
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(it);
    }
    ph.items = out;
  };

  // request context
  const guardUrl = new URL(req.url);
  const searchParams = guardUrl.searchParams;
  const msg = String(message || '').toLowerCase();
  const splitQ = String(searchParams.get('split') || '').toLowerCase();   // push/pull/legs/upper/full/hiit
  const styleQ = String(searchParams.get('style') || '').toLowerCase();   // strength/hiit
  const minutesQ = Number(searchParams.get('minutes') || '') || undefined;

  // equipment map (from user_equipment)
  const equipmentListLower = (equipmentList ?? []).map(s => String(s).toLowerCase());
  const hasTrapBar      = hasEq(equipmentListLower, /\btrap\s*bar\b/);
  const hasBarbell      = hasEq(equipmentListLower, /\bbarbells?\b/);
  const hasBench        = hasEq(equipmentListLower, /\b(adjustable\s+)?bench\b/);
  const hasRack         = hasEq(equipmentListLower, /\bsquat\s*rack\b/);
  const hasDumbbell     = hasEq(equipmentListLower, /\bdumbbells?\b/);
  const hasKettlebell   = hasEq(equipmentListLower, /\bkettlebells?\b/);
  const hasPullupBar    = hasEq(equipmentListLower, /\bpull\s*up\s*bar\b/);
  const hasRings        = hasEq(equipmentListLower, /\brings?\b/);
  const hasCables       = hasEq(equipmentListLower, /\bcables?\b/);
  const hasBattleRope   = hasEq(equipmentListLower, /\bbattle\s*rope\b/);
  const hasExerciseBike = hasEq(equipmentListLower, /\bexercise\s*bike\b/);
  const hasJumpRope     = hasEq(equipmentListLower, /\bjump\s*rope\b/);
  const hasPlyoBox      = hasEq(equipmentListLower, /\bplyo\s*box\b/);
  const hasMedBall      = hasEq(equipmentListLower, /\bmedicine\s*ball\b/);
  const hasBall         = hasEq(equipmentListLower, /\bexercise\s*ball\b/);
  const hasBands        = hasEq(equipmentListLower, /\b(mini|super)bands?\b/);

  // prefs: normalize and type
  type GuardPrefs = { preferred?: string[]; avoided?: string[] };

  const guardPrefs: GuardPrefs = {
    preferred: Array.isArray(prefs?.preferred) ? (prefs!.preferred as string[]) : [],
    avoided:   Array.isArray(prefs?.avoided)   ? (prefs!.avoided as string[])   : [],
  };

  const preferred: string[] = (guardPrefs.preferred || []).map((s) => String(s).toLowerCase());
  const avoided: string[]   = (guardPrefs.avoided   || []).map((s) => String(s).toLowerCase());

  // helpers using typed arrays
  const isAvoided = (name: string): boolean =>
    avoided.some((a: string) => name.toLowerCase().includes(a));

  const preferFirst = <T extends { name: string }>(cands: T[]): T[] => {
    return [...cands].sort((a, b) => {
      const ap = preferred.some((p: string) => a.name.toLowerCase().includes(p)) ? 1 : 0;
      const bp = preferred.some((p: string) => b.name.toLowerCase().includes(p)) ? 1 : 0;
      return bp - ap;
    });
  };

  // sanitize names to canonical equipment, drop non-owned cardio devices
  function canonicalizeNameByEquipment(rawName: string): string | null {
    let name = rawName;

    // Bike: normalize to Exercise Bike or drop if not owned
    if (/\b(air\s*bike|assault|echo|airdyne)\b/i.test(name)) {
      if (hasExerciseBike) name = name.replace(/\b(air\s*bike|assault|echo|airdyne)\b/gi, 'Exercise Bike');
      else return null;
    }
    // Rower / Treadmill / SkiErg: drop if not owned (you don't list these)
    if (/\b(row(er|ing)|erg|treadmill|ski\s*erg|skierg)\b/i.test(name)) return null;

    // Canonical plurals → singular tool labels
    name = name
      .replace(/\bBarbells?\b/gi, 'Barbell')
      .replace(/\bDumbbells?\b/gi, 'Dumbbell')
      .replace(/\bKettlebells?\b/gi, 'Kettlebell')
      .replace(/\bBattle\s*Ropes?\b/gi, 'Battle Rope');

    return name;
  }
  // apply canonicalization & non-owned filter to all items
  for (const ph of plan.phases) {
    const kept: any[] = [];
    for (const it of (ph.items || [])) {
      const n0 = String(it?.name || '').trim();
      const n1 = canonicalizeNameByEquipment(n0);
      if (!n1) continue; // drop non-owned device suggestion
      it.name = n1;
      kept.push(it);
    }
    ph.items = kept;
  }

  // infer split if not provided
  function inferSplit(): 'push'|'pull'|'legs'|'upper'|'full'|'hiit'|'custom' {
    if (splitQ) {
      if (['push','pull','legs','upper','full','hiit'].includes(splitQ)) return splitQ as any;
    }
    if (styleQ === 'hiit' || /\b(hiit|interval|tabata|emom|finisher|conditioning)\b/.test(msg)) return 'hiit';
    if (/\bleg(s)?\b/.test(msg)) return 'legs';
    if (/\bpush\b/.test(msg)) return 'push';
    if (/\bpull\b/.test(msg)) return 'pull';
    if (/\bupper\b/.test(msg)) return 'upper';
    if (/\bfull\b/.test(msg)) return 'full';
    if (/\bocho\b/.test(msg) || /joe\s*holder/.test(msg)) return 'full'; // map Ocho to balanced full-body
    return 'custom';
  }
  const guardSplit = inferSplit();

  // Title + minutes (non-destructive)
  if (!plan.name) {
    const titleMap: Record<string,string> = {
      push:  'Push — Strength Focus',
      pull:  'Pull — Strength Focus',
      legs:  'Legs — Strength Focus',
      upper: 'Upper Body — Strength Focus',
      full:  'Full Body — Strength Focus',
      hiit:  'High-Intensity Interval Session',
      custom:'Planned Session',
    };
    plan.name = titleMap[guardSplit] || 'Planned Session';
  }
  if (minutesQ) {
    plan.est_total_minutes = minutesQ;
    plan.duration_min = minutesQ;
  }

  // Ensure phases for ALL workouts
  const warmupPh = ensurePhase('warmup');
  const mainPh   = ensurePhase('main');
  const accPh    = ensurePhase('accessory');
  const condPh   = ensurePhase('conditioning');
  const coolPh   = ensurePhase('cooldown');

  // MAIN LIFT presence per split (only add if missing)
  function ensureMainLift() {
    if (guardSplit === 'push' || guardSplit === 'upper') {
      const cands = preferFirst([
        ...(hasBarbell && hasBench ? [makeItem('Barbell Bench Press', { sets: '4', reps: '6-8', instruction: 'Feet set, controlled descent' })] : []),
        ...(hasDumbbell && hasBench ? [makeItem('Dumbbell Bench Press', { sets: '4', reps: '6-8', instruction: 'Neutral wrist, leg drive' })] : []),
        ...(hasBarbell ? [makeItem('Barbell Overhead Press', { sets: '4', reps: '5-8', instruction: 'Glutes on, ribs down' })] : []),
        ...(hasDumbbell ? [makeItem('Dumbbell Overhead Press', { sets: '4', reps: '6-10', instruction: 'Finish biceps-by-ears' })] : []),
      ]).filter(c => !isAvoided(c.name));
      if (!hasName(mainPh, /(bench|overhead\s*press)/)) addIfMissing(mainPh, /(bench|overhead\s*press)/, () => cands[0] || null);
    }
    if (guardSplit === 'pull' || guardSplit === 'upper') {
      const cands = preferFirst([
        ...(hasTrapBar ? [makeItem('Trap Bar Deadlift', { sets: '4', reps: '4-6', instruction: 'Hinge at hips, neutral spine' })] : []),
        ...(hasBarbell ? [makeItem('Barbell Deadlift', { sets: '4', reps: '3-5', instruction: 'Bar close, wedge hard' })] : []),
        [makeItem('Barbell Row', { sets: '4', reps: '6-10', instruction: 'Hinge torso, pull to ribs' })][0],
        ...(hasPullupBar ? [makeItem('Pull Ups', { sets: '3', reps: '6-10', instruction: 'Full hang, strong scap pull' })] : []),
      ] as any).filter(Boolean).filter(c => !isAvoided(c.name));
      if (!hasName(mainPh, /(deadlift|row|pull\s*ups?)/)) addIfMissing(mainPh, /(deadlift|row|pull\s*ups?)/, () => cands[0] || null);
    }
    if (guardSplit === 'legs' || guardSplit === 'full') {
      const cands = preferFirst([
        ...(hasBarbell && hasRack ? [makeItem('Barbell Back Squat', { sets: '5', reps: '3-5', instruction: 'Brace 360°, control descent' })] : []),
        ...(hasBarbell && hasRack ? [makeItem('Barbell Front Squat', { sets: '4', reps: '5-8', instruction: 'Elbows high, tall chest' })] : []),
        ...(hasTrapBar ? [makeItem('Trap Bar Deadlift', { sets: '4', reps: '4-6', instruction: 'Drive floor away, lats on' })] : []),
      ] as any).filter(Boolean).filter(c => !isAvoided(c.name));
      if (!hasName(mainPh, /(squat|deadlift)/)) addIfMissing(mainPh, /(squat|deadlift)/, () => cands[0] || null);
    }
    if (guardSplit === 'full') {
      addIfMissing(mainPh, /(press)/, () => {
        if (isAvoided('press')) return null;
        if (hasDumbbell && hasBench) return makeItem('Dumbbell Bench Press', { sets: '3', reps: '6-10', instruction: 'Controlled tempo' });
        if (hasBarbell && hasBench)  return makeItem('Barbell Bench Press', { sets: '3', reps: '5-8', instruction: 'Solid arch, leg drive' });
        if (hasDumbbell)             return makeItem('Dumbbell Overhead Press', { sets: '3', reps: '8-10', instruction: 'Stacked lockout' });
        return null;
      });
      addIfMissing(mainPh, /(row|pull\s*ups?)/, () => {
        if (isAvoided('row') && isAvoided('pull up')) return null;
        if (!isAvoided('pull up') && hasPullupBar) return makeItem('Pull Ups', { sets: '3', reps: '6-10', instruction: 'Full hang, controlled rep' });
        return makeItem('Barbell Row', { sets: '3', reps: '8-10', instruction: 'Strong hinge, no shrug' });
      });
    }
  }
  ensureMainLift();

  // ACCESSORIES (ensure at least 2 for non-HIIT)
  const isHIIT = guardSplit === 'hiit' || styleQ === 'hiit' || /\b(hiit|interval|tabata|emom|finisher|conditioning)\b/.test(msg);
  if (!isHIIT) {
    ensureMinItems(accPh, Math.min(2, 5), [
      () => hasCables && !isAvoided('face pull') ? makeItem('Cable Face Pull', { sets: '3', reps: '12-15', instruction: 'High elbows, pause', isAccessory: true }) : null,
      () => hasDumbbell && !isAvoided('lateral raise') ? makeItem('Dumbbell Lateral Raise', { sets: '3', reps: '12-15', instruction: 'Small arc, no shrug', isAccessory: true }) : null,
      () => hasKettlebell && !isAvoided('rdl') ? makeItem('Kettlebell RDL', { sets: '3', reps: '10-12', instruction: 'Soft knees, hinge back', isAccessory: true }) : null,
      () => hasCables && !isAvoided('tricep') ? makeItem('Cable Tricep Pushdown', { sets: '3', reps: '10-12', instruction: 'Elbows pinned', isAccessory: true }) : null,
      () => hasDumbbell && !isAvoided('curl') ? makeItem('Dumbbell Curl', { sets: '3', reps: '10-12', instruction: 'No sway, full supination', isAccessory: true }) : null,
    ]);
  }

  // CONDITIONING (ensure stations if HIIT-ish request)
  if (isHIIT) {
    ensureMinItems(condPh, 2, [
      () => hasBattleRope ? makeItem('Battle Rope Waves', { duration: '40s work / 20s rest', instruction: 'RPE 8, braced torso' }) : null,
      () => hasKettlebell ? makeItem('Kettlebell Swings', { duration: '40s work / 20s rest', instruction: 'Hinge snap, neutral neck' }) : null,
      () => hasExerciseBike ? makeItem('Exercise Bike Sprint', { duration: '40s work / 20s rest', instruction: 'RPE 9 work / 3 rest' }) : null,
      () => hasMedBall ? makeItem('Medicine Ball Slams', { duration: '30s work / 30s rest', instruction: 'Full reach, exhale on slam' }) : null,
      () => hasJumpRope ? makeItem('Jump Rope', { duration: '40s work / 20s rest', instruction: 'Small hops, steady cadence' }) : null,
      () => hasPlyoBox ? makeItem('Box Step-Overs', { duration: '40s work / 20s rest', instruction: 'Soft landings, upright chest' }) : null,
    ]);
  }

  // WARMUP & COOLDOWN minimums for any plan
  ensureMinItems(warmupPh, 2, [
    () => hasJumpRope ? makeItem('Jump Rope', { duration: '2-3 min', instruction: 'Light bounce, relaxed shoulders' }) : null,
    () => hasBands ? makeItem('Band Pull Aparts', { sets: '2', reps: '12-15', instruction: 'Squeeze mid-back' }) : null,
    () => makeItem('Bodyweight Squats', { sets: '2', reps: '10', instruction: 'Controlled depth' }),
  ]);
  ensureMinItems(coolPh, 2, [
    () => hasBall ? makeItem('Exercise Ball Back Extension', { duration: '1-2 min', instruction: 'Gentle range' }) : null,
    () => makeItem('Standing Forward Fold', { duration: '1 min', instruction: 'Soft knees, long exhales' }),
  ]);

  // De-dup across phases in a stable order
  const seen = new Set<string>();
  for (const phaseName of ['warmup','main','accessory','conditioning','cooldown'] as PlanPhase['phase'][]) {
    const ph = plan.phases.find(p => p.phase === phaseName);
    if (ph) dedupPhaseItems(ph, seen);
  }
  // ─────────────────────── End Universal Plan Guard ───────────────────────

  // If model ignored minutes, coerce to the user's target (±3 min tolerance)
  const modelMin = Number(plan?.duration_min ?? plan?.est_total_minutes ?? 0);
  if (!Number.isNaN(durationMin) && Math.abs((modelMin || 0) - durationMin) > 3) {
    plan.duration_min = durationMin;
    plan.est_total_minutes = durationMin;
    warnings.push(`duration_mismatch: forced ${modelMin || "unknown"} → ${durationMin}`);
  }

  // Harmonize DB vocabulary; guard machines; ban oly terms
  harmonizePlanEquipmentNames(plan, renameMap);
  enforceEquipmentGuard(plan, vocab, exclusions);
  const banned = /snatch|power\s*clean|clean\s*&?\s*jerk|jerk\b/i;
  plan.phases.forEach(ph => (ph.items = ph.items.filter(it => !banned.test(it.name))));

  // If split primaries are missing, auto-repair once (LLM stays in charge)
  if (split && splitSpec && !mainSatisfies(plan, splitSpec)) {
    const fixText = await repairPlanWithPrimaries(parsed?.plan ?? parsed, {
      durationMin,
      vocab,
      split,
      spec: splitSpec,
    });
    try {
      const fixed = JSON.parse(fixText);
      const r = normalizePlan(fixed?.plan ?? fixed);
      if (r.plan && mainSatisfies(r.plan, splitSpec)) {
        plan = r.plan;
        harmonizePlanEquipmentNames(plan, renameMap);
      }
    } catch {
      // keep original if repair fails
    }
  }

  // Legacy shape for your UI
  const workout = toLegacyWorkout(plan, { theme });
  const minutes = Number(plan.est_total_minutes ?? plan.duration_min ?? durationMin) || durationMin;

  // Narrative
  let messageOut = (typeof parsed?.coach_message === "string" ? parsed.coach_message : "").trim();
  if (!messageOut) messageOut = renderSpecificCoachMessage(plan, minutes);
  messageOut = stripLegacySections(messageOut);
  messageOut = harmonizeCoachMessage(messageOut, renameMap);

  return NextResponse.json({
    ok: true,
    message: messageOut,
    plan,
    workout,
    debug: {
      version: "chat-workout:v10-splits-prefs-vocab-only-guard",
      validation_ok: true,
      warnings,
      durationMin: minutes,
      split,
      theme,
      equipmentList: vocab,
      preferences: prefs,
      guard: {
        split: guardSplit,
        minutes: minutesQ ?? plan.est_total_minutes ?? plan.duration_min,
        has: {
          trapBar: hasTrapBar, barbell: hasBarbell, bench: hasBench, rack: hasRack,
          dumbbell: hasDumbbell, kettlebell: hasKettlebell, pullupBar: hasPullupBar,
          rings: hasRings, cables: hasCables, battleRope: hasBattleRope,
          exerciseBike: hasExerciseBike, jumpRope: hasJumpRope, plyoBox: hasPlyoBox,
          medBall: hasMedBall, exerciseBall: hasBall, bands: hasBands
        }
      }
    },
  });
}


