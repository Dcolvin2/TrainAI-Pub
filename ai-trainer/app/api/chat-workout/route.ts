// app/api/chat-workout/route.ts
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
// server-only client (service role) for reading user_equipment safely
import { createClient } from "@supabase/supabase-js";
export const runtime = "nodejs";
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const VERSION = "chat-workout:v9-duplicate-fix-hiit-stations-2025-08-11";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function getEquipmentForUser(userId: string | null): Promise<string[]> {
  if (!userId) return [];
  const { data, error } = await admin
    .from("user_equipment")
    .select("is_available, equipment:equipment_id(name)")
    .eq("user_id", userId);

  if (error || !data) return [];

  const names = data
    .filter((r: any) => r?.is_available !== false && r?.equipment?.name)
    .map((r: any) => String(r.equipment.name).trim())
    .filter(Boolean);

  // exact DB vocabulary, case preserved
  return Array.from(new Set(names));
}

function buildEquipmentVocabulary(allowed: string[]) {
  // Keep exact DB strings (case preserved)
  const vocab = Array.from(new Set(allowed));

  // Only map specific aliases → your exact DB terms.
  // IMPORTANT: no generic tokens like "rope" or "box".
  const renameMap: Record<string, string> = {};

  if (vocab.includes("Exercise Bike")) {
    ["air bike", "assault bike", "echo bike", "airdyne"].forEach(a => renameMap[a] = "Exercise Bike");
  }
  if (vocab.includes("Battle Rope")) {
    ["battle ropes", "battle rope"].forEach(a => renameMap[a] = "Battle Rope");
  }
  if (vocab.includes("Kettlebells")) {
    ["kettlebell", "kb"].forEach(a => renameMap[a] = "Kettlebells");
  }
  if (vocab.includes("Dumbbells")) {
    ["dumbbell", "db"].forEach(a => renameMap[a] = "Dumbbells");
  }
  if (vocab.includes("Barbells")) {
    ["barbell"].forEach(a => renameMap[a] = "Barbells");
  }
  // No plain "box" mapping — it caused "Plyo Plyo Plyo Box"
  return { vocab, renameMap };
}

function replaceSynonymsOnce(text: string, renameMap: Record<string, string>) {
  let out = text || "";
  // longest aliases first
  const entries = Object.entries(renameMap).sort((a, b) => b[0].length - a[0].length);

  for (const [alias, target] of entries) {
    const targetRe = new RegExp(`\\b${target.replace(/\s+/g, "\\s+")}\\b`, "i");
    if (targetRe.test(out)) continue; // already contains target, skip

    const aliasRe = new RegExp(`\\b${alias.replace(/\s+/g, "\\s+")}\\b`, "ig");
    out = out.replace(aliasRe, target);
  }

  // Collapse accidental repeated words: "Exercise Exercise Bike" -> "Exercise Bike"
  out = out.replace(/\b(\w+)(\s+\1\b)+/gi, "$1");
  // Specific tidy-ups for common pairs
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

function stripLegacySections(msg: string): string {
  const lines = msg.split('\n');
  const isHeader = (s: string) => /^\s*(?:\*\*|\*)?\s*(?:🔥|💪|🧘)?\s*(warm[-\s]?up|main(?:\s*workout)?|cool[-\s]?down)\s*:?\s*(?:\*\*|\*)?\s*$/i.test(s.trim());
  const out: string[] = [];
  let skipping = false;
  for (const line of lines) {
    if (!skipping && isHeader(line)) { skipping = true; continue; }
    if (skipping) { if (line.trim() === '') skipping = false; continue; }
    out.push(line);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function looksSpecific(msg: string, plan: Plan): boolean {
  const mainNames = (plan.phases.find(p=>p.phase==='main')?.items ?? []).map(i=>i.name.toLowerCase());
  const mustMention = mainNames.slice(0, 2); // at least 2 main moves referenced
  const lower = msg.toLowerCase();
  return mustMention.every(n => n && lower.includes(n));
}

function fmtItem(it: PlanItem): string {
  if (it.sets && it.reps) return `${it.name} — ${String(it.sets)}×${String(it.reps)}`;
  if (it.duration) return `${it.name} — ${String(it.duration)}`;
  return it.name;
}

function renderSpecificCoachMessage(plan: Plan, durationMin: number): string {
  const warm = plan.phases.find(p=>p.phase==='warmup')?.items ?? [];
  const main = plan.phases.find(p=>p.phase==='main')?.items ?? [];
  const acc  = plan.phases.find(p=>p.phase==='accessory')?.items ?? [];
  const cond = plan.phases.find(p=>p.phase==='conditioning')?.items ?? [];
  const cool = plan.phases.find(p=>p.phase==='cooldown')?.items ?? [];

  // simple allocation
  const wMin = Math.min(8, Math.max(5, Math.round(durationMin*0.14)));
  const aMin = Math.max(10, Math.round(durationMin*0.28));
  const bMin = Math.max(8,  Math.round(durationMin*0.22));
  const uMin = Math.max(6,  Math.round(durationMin*0.18));
  const fMin = Math.max(4,  durationMin - (wMin+aMin+bMin+uMin+3)); // 3 for cooldown

  const A = main.slice(0, 2);
  const B = main.slice(2, 4);
  const U = acc.slice(0, 2);
  const F = cond.slice(0, 2);

  const lines: string[] = [];
  lines.push(`Got it — ${durationMin} minutes, kettlebell-forward.`);
  lines.push('');
  lines.push(`0:00–${String(wMin).padStart(2,' ')}:00 – Prep`);
  (warm.length ? warm : []).slice(0,4).forEach((it, i) => lines.push(`${i+1}. ${fmtItem(it)}`));

  lines.push('');
  lines.push(`${String(wMin).padStart(2,' ')}:00–${String(wMin+aMin).padStart(2,' ')}:00 – Power & Strength A`);
  (A.length ? A : main.slice(0,2)).forEach((it, i) => lines.push(`${i+1}. ${fmtItem(it)}`));

  lines.push('');
  lines.push(`${String(wMin+aMin).padStart(2,' ')}:00–${String(wMin+aMin+bMin).padStart(2,' ')}:00 – Power & Strength B`);
  (B.length ? B : main.slice(2,4)).forEach((it, i) => lines.push(`${i+1}. ${fmtItem(it)}`));

  lines.push('');
  lines.push(`${String(wMin+aMin+bMin).padStart(2,' ')}:00–${String(wMin+aMin+bMin+uMin).padStart(2,' ')}:00 – Unilateral + Pull`);
  (U.length ? U : acc.slice(0,2)).forEach((it, i) => lines.push(`${i+1}. ${fmtItem(it)}`));

  lines.push('');
  lines.push(`${String(wMin+aMin+bMin+uMin).padStart(2,' ')}:00–${String(wMin+aMin+bMin+uMin+fMin).padStart(2,' ')}:00 – Finisher`);
  (F.length ? F : [{ name: 'EMOM — Swings', reps: '20', sets: '4' } as PlanItem]).forEach((it, i) => lines.push(`${i+1}. ${fmtItem(it)}`));

  lines.push('');
  lines.push(`${String(durationMin-3).padStart(2,' ')}:00–${String(durationMin).padStart(2,' ')}:00 – Cooldown`);
  (cool.length ? cool : []).slice(0,3).forEach((it, i) => lines.push(`${i+1}. ${fmtItem(it)}`));

  return lines.join('\n').trim();
}

function enforceEquipmentGuard(plan: Plan, allowedExact: string[], exclusions: string[], renameMap: Record<string,string>) {
  const allow = new Set(allowedExact.map(s => s.toLowerCase()));
  const block = new Set(exclusions.map(s => s.toLowerCase()));
  const aliasToDb: Record<string,string> = {};
  for (const [alias, dbName] of Object.entries(renameMap)) {
    aliasToDb[alias.toLowerCase()] = dbName; // "air bike" -> "Exercise Bike"
  }

  const swap: Record<string, string> = {
    "air bike": "Battle Rope Waves",
    "rower": "Kettlebell Swings",
    "treadmill": "Kettlebell Swings",
    "ski erg": "Battle Rope Alternating Waves",
  };

  const requires = (name: string): string[] => {
    const n = name.toLowerCase();
    const req: string[] = [];
    const test = (key: string, rx: RegExp) => { if (rx.test(n)) req.push(key); };
    test("air bike", /\b(air\s*bike|assault|echo|airdyne)\b/);
    test("rower", /\b(rower|erg|rowing)\b/);
    test("treadmill", /\b(treadmill|runner)\b/);
    test("ski erg", /\b(ski\s*erg|skierg)\b/);
    test("barbells", /\bbarbell(s)?\b/);
    test("trap bar", /\btrap\s*bar|hex\s*bar\b/);
    test("dumbbells", /\bdumbbells?\b|db\b/);
    test("kettlebells", /\bkettlebells?\b|kb\b/);
    test("battle rope", /\brope|waves\b/);
    test("plyo box", /\bbox|step[-\s]?overs?\b|step[-\s]?ups?\b/);
    test("medicine ball", /\bmedicine\s*ball|med\s*ball\b/);
    test("slam ball", /\bslam\s*ball\b/);
    return Array.from(new Set(req));
  };

  plan.phases.forEach(ph => {
    const keep: PlanItem[] = [];
    for (const it of ph.items) {
      const need = requires(it.name || "");
      const bad = need.some(r => {
        const dbTerm = (aliasToDb[r] ?? r).toLowerCase(); // e.g., "air bike" -> "exercise bike"
        if (block.has(r) || block.has(dbTerm)) return true;
        return !allow.has(dbTerm) && ["air bike","rower","treadmill","ski erg"].includes(r);
      });

      if (!bad) { keep.push(it); continue; }

      // try swap only for cardio machines
      const swapName = swap[need.find(n => swap[n]) || ""];
      if (swapName) {
        keep.push({ ...it, name: swapName, instruction: it.instruction ?? "Swap for unavailable machine" });
      }
      // else drop
    }
    ph.items = keep;
  });
}

function ensureHiitStations(plan: Plan, vocab: string[], durationMin: number) {
  const cond = plan.phases.find(p => p.phase === "conditioning") ?? { phase: "conditioning", items: [] as PlanItem[] };
  if (!plan.phases.includes(cond)) plan.phases.push(cond);

  const hasWorkRest = (s?: string) => !!s && /(\d{1,3}\s*(s|sec|seconds?|min)|work\s*\/\s*rest|on\s*\/\s*off)/i.test(s);
  const stationish = cond.items.filter(it => hasWorkRest(it.duration || String(it.reps || "")));

  if (stationish.length >= 3) return; // already good

  const pick = (want: string) => vocab.includes(want);
  const stations: PlanItem[] = [];

  if (pick("Battle Rope")) stations.push({ name: "Battle Rope Waves", duration: "40s work/20s rest" });
  if (pick("Kettlebells")) stations.push({ name: "Kettlebell Swings", duration: "40s work/20s rest" });
  if (pick("Plyo Box")) stations.push({ name: "Box Step-Overs", duration: "40s work/20s rest" });
  if (pick("Exercise Bike")) stations.push({ name: "Exercise Bike Sprint", duration: "30s on/30s off" });
  if (pick("Jump Rope")) stations.push({ name: "Jump Rope", duration: "40s work/20s rest" });
  if (pick("Medicine Ball")) stations.push({ name: "Med Ball Slams", duration: "30s on/30s off" });
  if (pick("Slam Ball")) stations.push({ name: "Slam Ball Slams", duration: "30s on/30s off" });

  // ensure at least 3
  cond.items = [...stationish, ...stations].slice(0, 4);
}

function renderCoachMessage(plan: Plan, equipment: string[], minutes: number): string {
  const title = plan.name || "Workout";
  const warmup = plan.phases.find(p => p.phase === "warmup")?.items.map(i => i.name).join(", ") || "—";
  const main = plan.phases.find(p => p.phase === "main")?.items.map(i => i.name).join(", ") || "—";
  const cooldown = plan.phases.find(p => p.phase === "cooldown")?.items.map(i => i.name).join(", ") || "—";
  
  return `Planned: ${title} (~${minutes} min).
Warm-up: ${warmup}
Main: ${main}
Cooldown: ${cooldown}`;
}

async function getPreferredDuration(userId: string | null): Promise<number | null> {
  if (!userId) return null;
  const { data, error } = await admin
    .from('profiles')
    .select('preferred_workout_duration')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return null;
  const n = Number(data.preferred_workout_duration);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function callPlannerLLM(
  userMessage: string,
  cues: {
    durationMin: number;
    equipmentList: string[];
    theme: "strength" | "hypertrophy" | "conditioning" | "balanced" | "hiit";
    exclusions: string[];
    vocab: string[];
  }
): Promise<string> {
  const eq = cues.equipmentList.length ? cues.equipmentList.join(", ") : "Dumbbells, Kettlebells, Battle Rope, Plyo Box, Medicine Ball, Slam Ball, Exercise Bike, Rings, Pull Up Bar";
  const style = /kettlebell|kb\b|ocho|joe\s*holder/i.test(userMessage) ? "kettlebell_ocho" : "coach_general";

  const prompt = `
Return ONLY JSON (no markdown or fences):
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
  "coach_message": string,
  "notes"?: { "style": "kettlebell_ocho"|"coach_general"|"hiit", "substitutions"?: string[] }
}

Hard rules:
- Target duration: ${cues.durationMin} minutes.
- Use ONLY equipment from this exact, case-sensitive vocabulary: ${JSON.stringify(cues.vocab)}.
  - If you would otherwise output "Air Bike", write exactly "Exercise Bike" when present in this vocabulary.
- EXCLUSIONS (do not include): ${cues.exclusions.join(", ") || "none"}.
- BANNED lifts: snatch/clean/jerk. If requested, SUBSTITUTE and list in notes.substitutions:
  - KB snatch → Kettlebell High Pull
  - KB clean & press / clean → Kettlebell Push Press
  - jerk → Kettlebell Push Press
- MAIN uses sets×reps; duration-only intervals belong in CONDITIONING.

HIIT-specific (theme="hiit"):
- Provide intervals as stations with clear work:rest (e.g., "40s work/20s rest" or "30s on/30s off").
- Prefer mixed implements from the vocabulary: Battle Rope, Kettlebells, Dumbbells (thrusters), Plyo Box (step-overs), Jump Rope, Medicine/Slam Ball, Exercise Bike.
- Return at least 3 distinct conditioning stations; if a bike exists in the vocabulary, one station may be "Exercise Bike Sprint".

Coach message (single narrative only; no duplicate Warm-up/Main/Cool-down lists):
- First line: acknowledge duration + style/equipment.
- Then time blocks with numbered items per block; each item must match an entry in plan.phases and include sets×reps or work:rest duration.
- End with a one-line substitutions note only if any were made.

Theme: ${cues.theme}.
User request: "${userMessage}"
`.trim();

  const resp = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    temperature: 0.2,
    max_tokens: 1900,
    messages: [{ role: "user", content: prompt }],
  });
  return extractAiText(resp);
}

/* ---------- types used internally ---------- */
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

/* ---------- helpers (no exports) ---------- */
function coerceToString(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  return String(v);
}

function normalizePlan(input: any): { plan: Plan | null; warnings: string[] } {
  const warnings: string[] = [];
  if (!input || typeof input !== "object") {
    return { plan: null, warnings: ["LLM returned empty or non-object JSON"] };
  }
  const allowed: PlanPhase["phase"][] = ["warmup", "main", "accessory", "conditioning", "cooldown"];
  const plan: Plan = {
    name: String(input.name ?? "Workout"),
    duration_min: input.duration_min ?? input.est_total_minutes,
    phases: Array.isArray(input.phases)
      ? input.phases.map((p: any) => {
          const rawPhase = String(p?.phase ?? "").toLowerCase();
          const phase = (allowed.includes(rawPhase as any) ? rawPhase : "main") as PlanPhase["phase"];
          if (rawPhase !== phase) warnings.push(`Unknown phase "${rawPhase}" → coerced to "main"`);
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
          return { phase, items };
        })
      : [],
    est_total_minutes: input.est_total_minutes ?? input.duration_min,
  };
  const ensure = (k: PlanPhase["phase"]) => {
    if (!plan.phases.some((ph) => ph.phase === k)) plan.phases.push({ phase: k, items: [] });
  };
  ensure("warmup");
  ensure("main");
  ensure("cooldown");
  return { plan, warnings };
}

function toLegacyWorkout(plan: Plan, opts?: { theme?: "hiit" | "strength" | "hypertrophy" | "conditioning" | "balanced" }) {
  const get = (k: PlanPhase["phase"]) => plan.phases.find(p => p.phase === k)?.items ?? [];

  const warmup = get("warmup").map(it => ({
    name: it.name, sets: it.sets ?? "1", reps: it.reps ?? "10-15", instruction: it.instruction ?? ""
  }));

  const PRIMARY_MAIN_COUNT = 2;
  const mainItems = get("main");
  const mainPrimaryAndSecondary = mainItems.map((it, idx) => ({
    name: it.name, sets: it.sets ?? "3", reps: it.reps ?? "8-12",
    instruction: it.instruction ?? "", isAccessory: idx >= PRIMARY_MAIN_COUNT
  }));

  const accessories = get("accessory").map(it => ({
    name: it.name, sets: it.sets ?? "3", reps: it.reps ?? "10-15",
    instruction: it.instruction ?? "", isAccessory: true
  }));

  const cooldown = get("cooldown").map(it => ({
    name: it.name, duration: it.duration ?? (it.reps ? String(it.reps) : "30-60s"),
    instruction: it.instruction ?? ""
  }));

  let mainOut = [...mainPrimaryAndSecondary, ...accessories];

  // ✅ HIIT fallback: if MAIN is empty, surface conditioning stations in the table
  if ((opts?.theme === "hiit" || mainOut.length === 0) && get("conditioning").length > 0 && mainItems.length === 0) {
    const stations = get("conditioning").map(it => ({
      name: it.name,
      sets: it.sets ?? "4-5 rounds",
      reps: it.reps ?? (it.duration ? String(it.duration) : "40s/20s"),
      instruction: it.instruction ?? "",
      isAccessory: true
    }));
    mainOut = stations; // show stations as the main list for table rendering
  }

  return { warmup, main: mainOut, cooldown };
}

function findJsonObject(s: string): string | null {
  let start = -1;
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "{") {
      if (start === -1) start = i;
      depth++;
    } else if (ch === "}") {
      if (depth > 0) depth--;
      if (depth === 0 && start !== -1) return s.slice(start, i + 1);
    }
  }
  return null;
}

function extractAiText(resp: any): string {
  if (resp?.content && Array.isArray(resp.content)) {
    return resp.content
      .map((b: any) => (b && typeof b === "object" && "text" in b ? b.text : ""))
      .join("\n")
      .trim();
  }
  if (typeof resp === "string") return resp.trim();
  return "";
}

function parseMinutesFromMessage(msg: string): number | null {
  const m = msg.match(/(\d{2,3}|\d{1,2})\s*(?:min|minutes?)\b/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

function dayCueFor(date = new Date()): { label: string; cue: string } {
  const day = date.toLocaleDateString(undefined, { weekday: "long" }).toLowerCase();
  if (day.startsWith("mon")) return { label: "Monday", cue: "legs day (core: barbell back squat)" };
  if (day.startsWith("tue")) return { label: "Tuesday", cue: "chest day (core: bench press)" };
  if (day.startsWith("thu")) return { label: "Thursday", cue: "HIIT day (no olympic lifts)" };
  if (day.startsWith("sat")) return { label: "Saturday", cue: "back day (core: deadlift or rows)" };
  return { label: day[0]?.toUpperCase() + day.slice(1), cue: "cardio / conditioning focus" };
}

/* ---------- handlers ---------- */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const probe = url.searchParams.get("probe");
  if (probe === "env") {
    return NextResponse.json({
      ok: true,
      version: VERSION,
      hasAnthropicKey: Boolean(process.env.ANTHROPIC_API_KEY),
    });
  }
  return NextResponse.json({ ok: true, version: VERSION });
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const debug = url.searchParams.get("debug") === "1";
  const userId = url.searchParams.get("user"); // optional
  const styleParam = url.searchParams.get("style") || url.searchParams.get("type"); // e.g., ?style=hiit

  const body = await req.json().catch(() => ({}));
  const message = typeof body?.message === "string" ? body.message : "";

  if (!message) {
    return NextResponse.json({ ok: false, error: "Missing message" }, { status: 400 });
  }

  // derive minutes (message > ?min= > default 45)
  const explicitMin = parseMinutesFromMessage(message);
  const queryMin = Number(url.searchParams.get("min") || "");
  const durationMin = (explicitMin && explicitMin > 0 ? explicitMin : Number.isFinite(queryMin) ? queryMin : 45);

  const { cue: dowCue } = dayCueFor();
  const equipmentList = await getEquipmentForUser(userId);
  const { vocab, renameMap } = buildEquipmentVocabulary(equipmentList);

  // Auto-detect theme from message
  const msg = message.toLowerCase();
  let theme: "strength" | "hypertrophy" | "conditioning" | "balanced" | "hiit" = "balanced";
  if (/strength|heavy|power|max/.test(msg)) theme = "strength";
  else if (/hypertrophy|pump|volume|muscle/.test(msg)) theme = "hypertrophy";
  else if (/conditioning|cardio|hiit|endurance|metcon/.test(msg)) theme = "conditioning";
  else if (/hiit|intervals|stations|work.*rest|on.*off/.test(msg)) theme = "hiit";

  // Force HIIT theme if style parameter indicates it
  if (styleParam && /hiit|interval|emom|amrap|tabata/i.test(styleParam)) theme = "hiit";

  // Extract equipment exclusions from message
  const exclusions: string[] = [];
  const exclusionPatterns = [
    /no\s+(barbell|trap\s*bar|machine|machines)/gi,
    /without\s+(barbell|trap\s*bar|machine|machines)/gi,
    /avoid\s+(barbell|trap\s*bar|machine|machines)/gi
  ];
  
  exclusionPatterns.forEach(pattern => {
    const matches = message.match(pattern);
    if (matches) {
      matches.forEach((match: string) => {
        const equipment = match.replace(/^(no|without|avoid)\s+/i, '').trim();
        if (equipment && !exclusions.includes(equipment)) {
          exclusions.push(equipment);
        }
      });
    }
  });

  let aiText = "";
  let parsePath: "as-is" | "fence" | "balanced" | "none" = "none";
  let rawJsonExtract: string | null = null;

  try {
    // If the client sends raw JSON (for testing), skip the LLM
    if (message.trim().startsWith("{")) {
      aiText = message.trim();
      parsePath = "as-is";
    } else {
      aiText = await callPlannerLLM(message, { durationMin, equipmentList, theme, exclusions, vocab });
    }

    // Parse JSON (as-is → fenced → balanced)
    let parsed: any = null;
    try {
      parsed = JSON.parse(aiText);
      parsePath = parsePath === "none" ? "as-is" : parsePath;
      rawJsonExtract = aiText;
    } catch {
      const fence = aiText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (fence?.[1]) {
        try {
          parsed = JSON.parse(fence[1]);
          parsePath = "fence";
          rawJsonExtract = fence[1];
        } catch {}
      }
      if (!parsed) {
        const chunk = findJsonObject(aiText);
        if (chunk) {
          try {
            parsed = JSON.parse(chunk);
            parsePath = "balanced";
            rawJsonExtract = chunk;
          } catch {}
        }
      }
    }

    // Support both new ({ plan, coach_message }) and legacy (just plan) shapes
    const rawPlan = parsed?.plan ?? parsed;
    const coachMessage = typeof parsed?.coach_message === "string" ? parsed.coach_message : null;

    const { plan, warnings } = normalizePlan(rawPlan);
    if (!plan) {
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to generate workout plan",
          details: "Planner JSON failed validation",
          debug: debug
            ? {
                version: VERSION,
                parsePath,
                hadJsonExtract: Boolean(rawJsonExtract),
                aiTextHead: aiText.slice(0, 400),
                warnings,
                durationMin,
                dowCue,
                equipmentList,
              }
            : undefined,
        },
        { status: 400 }
      );
    }

    // Final guardrail only (we asked model to substitute already)
    const banned = /snatch|power\s*clean|clean\s*&?\s*jerk|jerk/i;
    plan.phases.forEach((ph) => {
      ph.items = ph.items.filter((it) => !banned.test(it.name));
    });

    // (Optional) Minimal de-fluff that still leaves control to the model
    plan.phases.forEach(ph => {
      ph.items = ph.items.filter(it => {
        const n = String(it?.name ?? '').trim();
        return n.length > 0 && !/^rest$|^exercise$/i.test(n);
      });
    });

    // Harmonize names to your DB vocabulary
    harmonizePlanEquipmentNames(plan, renameMap);

    // Enforce availability / swaps if you kept that guard (optional)
    // enforceEquipmentGuard(plan, vocab, exclusions, renameMap);

    // Build legacy workout (now with HIIT fallback)
    const workout = toLegacyWorkout(plan, { theme });

    // Calculate final minutes for message
    const minutes = Number(plan.est_total_minutes ?? plan.duration_min ?? durationMin) || durationMin;

    // Coach message: prefer model's, then harmonize text too
    let messageOut = (typeof parsed?.coach_message === "string" ? parsed.coach_message : "").trim() || renderCoachMessage(plan, equipmentList, minutes);
    messageOut = harmonizeCoachMessage(messageOut, renameMap);

    // If the LLM's narrative doesn't explicitly mention at least the first two MAIN items,
    // rebuild a precise narrative from the plan.
    if (!messageOut || !looksSpecific(messageOut, plan)) {
      messageOut = renderSpecificCoachMessage(plan, minutes);
    }

    return NextResponse.json({
      ok: true,
      message: messageOut,
      plan,
      workout,
      debug: debug
        ? {
            version: VERSION,
            validation_ok: true,
            warnings,
            parsePath,
            rawJsonPreview: (rawJsonExtract ?? "").slice(0, 400),
            durationMin,
            dowCue,
            equipmentList,
          }
        : undefined,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unexpected server error",
        details: err?.message ?? String(err),
        debug: debug
          ? {
              version: VERSION,
            }
          : undefined,
      },
      { status: 500 }
    );
  }
}


