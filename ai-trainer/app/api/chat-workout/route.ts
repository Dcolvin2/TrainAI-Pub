// app/api/chat-workout/route.ts
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from '@supabase/supabase-js';

export const runtime = "nodejs";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const VERSION = "chat-workout:v5-llm-narrative-2025-08-11";

// server-only client (service role) for reading user_equipment safely
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // ensure this env var is set in Vercel
  { auth: { persistSession: false } }
);

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

function toLegacyWorkout(plan: Plan) {
  const get = (k: PlanPhase["phase"]) => plan.phases.find((p) => p.phase === k)?.items ?? [];
  const warmup = get("warmup").map((it) => ({
    name: it.name,
    sets: it.sets ?? "1",
    reps: it.reps ?? "10-15",
    instruction: it.instruction ?? "",
  }));
  const mainCore = get("main").map((it) => ({
    name: it.name,
    sets: it.sets ?? "3",
    reps: it.reps ?? "8-12",
    instruction: it.instruction ?? "",
    isAccessory: false,
  }));
  const accessories = get("accessory").map((it) => ({
    name: it.name,
    sets: it.sets ?? "3",
    reps: it.reps ?? "10-15",
    instruction: it.instruction ?? "",
    isAccessory: true,
  }));
  const conditioning = get("conditioning").map((it) => ({
    name: it.name,
    sets: it.sets ?? "3",
    reps: it.reps ?? (it.duration ?? "30s"),
    instruction: it.instruction ?? "",
    isAccessory: true,
  }));
  const cooldown = get("cooldown").map((it) => ({
    name: it.name,
    duration: it.duration ?? (it.reps ? String(it.reps) : "30-60s"),
    instruction: it.instruction ?? "",
  }));
  return { warmup, main: [...mainCore, ...accessories], cooldown };
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

function canon(name: string) {
  const n = name.toLowerCase().trim();
  if (/^hex\s*bar|trap\s*bar/.test(n)) return 'trap bar';
  if (/^db$|dumbbells?/.test(n)) return 'dumbbells';
  if (/^kb$|kettlebells?/.test(n)) return 'kettlebell';
  if (/barbell/.test(n)) return 'barbell';
  if (/bench/.test(n)) return 'bench';
  if (/rack|power\s*rack|squat\s*rack/.test(n)) return 'rack';
  if (/rope/.test(n)) return 'battle ropes';
  if (/band/.test(n)) return 'resistance bands';
  if (/plyo|box/.test(n)) return 'plyo box';
  if (/bike|echo|airdyne/.test(n)) return 'air bike';
  return name.trim(); // keep custom names too
}

async function getEquipmentForUser(userId: string | null): Promise<string[]> {
  if (!userId) return [];

  // JOIN user_equipment -> equipment, prefer custom_name, respect is_available
  const { data, error } = await admin
    .from('user_equipment')
    .select('custom_name, is_available, equipment:equipment_id ( name )')
    .eq('user_id', userId);

  if (error || !data) return [];

  const names: string[] = [];
  for (const row of data as any[]) {
    if (row?.is_available === false) continue;
    const base = (row?.equipment?.name ?? '').toString();
    const custom = (row?.custom_name ?? '').toString();
    const chosen = (custom || base).trim();
    if (chosen) names.push(canon(chosen));
  }
  // Fallback to profiles.equipment if nothing found (legacy compatibility)
  if (names.length === 0) {
    const { data: prof } = await admin
      .from('profiles')
      .select('equipment')
      .eq('id', userId)
      .maybeSingle();
    const legacy = (prof?.equipment ?? '').toString();
    if (legacy) {
      legacy.split(',').map((s: string) => s.trim()).filter(Boolean).forEach((s: string) => names.push(canon(s)));
    }
  }
  // Dedup
  return Array.from(new Set(names));
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
    theme: "strength" | "hypertrophy" | "conditioning" | "balanced";
  }
): Promise<string> {
  const eq = cues.equipmentList.length
    ? cues.equipmentList.join(", ")
    : "kettlebell, dumbbells, barbell, trap bar, bench, bands, box, battle ropes, bodyweight";

  // Style auto-hint from user message (kettlebell/ocho → kettlebell_ocho)
  const m = userMessage.toLowerCase();
  const kettlebellStyle = /kettlebell|kb\b|ocho|joe\s*holder/.test(m) ? "kettlebell_ocho" : "coach_general";

  const prompt = `
Return ONLY JSON (no markdown or fences) that matches:
{
  "plan": {
    "name": string,
    "duration_min": number,
    "phases": [
      { "phase": "warmup"|"main"|"accessory"|"conditioning"|"cooldown",
        "items": [
          { "name": string,
            "sets"?: string|number,
            "reps"?: string|number,
            "duration"?: string,
            "instruction"?: string,
            "isAccessory"?: boolean
          }
        ]
      }
    ],
    "est_total_minutes"?: number
  },
  "coach_message": string,
  "notes"?: {
    "style": "kettlebell_ocho"|"coach_general",
    "substitutions"?: string[]
  }
}

Rules (strict):
- Target duration: ${cues.durationMin} minutes. Use time windows in the coach_message.
- Use only this equipment: ${eq}.
- If the user mentions kettlebell or Ocho, set notes.style="kettlebell_ocho" and keep MAIN phase kettlebell-forward.
  - In MAIN: avoid barbell/trap bar/machines unless explicitly asked; those may appear in ACCESSORY at most.
- BANNED: snatch, clean, jerk variants. If requested, SUBSTITUTE instead of removing:
  - kettlebell snatch → Kettlebell High Pull
  - (kb) clean & press / clean → Kettlebell Push Press
  - jerk → Kettlebell Push Press
  Add each substitution string to notes.substitutions.
- MAIN phase items must use sets+reps (strings ok). Duration-only work (EMOM, Tabata, carries) belongs in CONDITIONING or ACCESSORY, not MAIN.
- Name specificity: avoid placeholders like "Bodyweight Circuit", "Exercise", or "Rest". Use concrete exercise names.
- Keep names concise, e.g., "Kettlebell Swings", "Double Kettlebell Front Squat", "Front Rack Carry".
- COACH MESSAGE STYLE:
  - First line: acknowledge duration + style/equipment (one sentence).
  - Then timed blocks (Prep, Power & Strength A/B, Unilateral + Pull, Carries/Core, Finisher, Cooldown).
  - Bullet numbered lists within each block; include concise cues in parentheses.
  - If any substitutions were made, include a one-line note at the end.

Theme: ${cues.theme}. Align volume/intensity accordingly.

User request: "${userMessage}"
`.trim();

  const resp = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    temperature: 0.2,
    max_tokens: 1800,
    messages: [{ role: "user", content: prompt }],
  });

  // Return raw text (JSON string)
  return extractAiText(resp);
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

  const body = await req.json().catch(() => ({}));
  const message = typeof body?.message === "string" ? body.message : "";
  if (!message) {
    return NextResponse.json({ ok: false, error: "Missing message" }, { status: 400 });
  }

  // derive minutes: message > ?min= > profiles.preferred_workout_duration > 45
  const explicitMin = parseMinutesFromMessage(message);
  const minParam = url.searchParams.get("min");
  const queryMin = minParam ? Number(minParam) : NaN;
  let durationMin =
    (explicitMin && explicitMin > 0 ? explicitMin : (Number.isFinite(queryMin) && queryMin > 0) ? queryMin : NaN);

  if (!Number.isFinite(durationMin)) {
    const pref = await getPreferredDuration(userId);
    durationMin = pref ?? 45;
  }

  const { cue: dowCue } = dayCueFor();
  const equipmentList = await getEquipmentForUser(userId);

  // Auto-detect theme from message
  const msg = message.toLowerCase();
  let theme: "strength" | "hypertrophy" | "conditioning" | "balanced" = "balanced";
  if (/strength|heavy|power|max/.test(msg)) theme = "strength";
  else if (/hypertrophy|pump|volume|muscle/.test(msg)) theme = "hypertrophy";
  else if (/conditioning|cardio|hiit|endurance|metcon/.test(msg)) theme = "conditioning";

  let aiText = "";
  let parsePath: "as-is" | "fence" | "balanced" | "none" = "none";
  let rawJsonExtract: string | null = null;

  try {
    // If the client sends raw JSON (for testing), skip the LLM
    if (message.trim().startsWith("{")) {
      aiText = message.trim();
      parsePath = "as-is";
    } else {
      aiText = await callPlannerLLM(message, { durationMin, equipmentList, theme });
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

    // (Optional but UI-safe) Keep conditioning out of 'main' table shape
    const workout = toLegacyWorkout(plan);

    // Prefer model's coach message; fallback to your existing renderer if missing
    const minutes = Number(plan.est_total_minutes ?? plan.duration_min ?? durationMin) || durationMin;
    const messageOut = coachMessage && coachMessage.trim().length > 0
      ? coachMessage.trim()
      : renderCoachMessage(plan, equipmentList, minutes);

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


