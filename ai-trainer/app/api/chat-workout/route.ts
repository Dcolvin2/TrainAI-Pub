// app/api/chat-workout/route.ts
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const VERSION = "chat-workout:v3-normalizer-inline-2025-08-11";

/* ---------- helpers (no exports!) ---------- */
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

  // Ensure buckets your UI expects
  const ensurePhase = (k: PlanPhase["phase"]) => {
    if (!plan.phases.some((ph) => ph.phase === k)) plan.phases.push({ phase: k, items: [] });
  };
  ensurePhase("warmup");
  ensurePhase("main");
  ensurePhase("cooldown");

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

  return {
    warmup,
    main: [...mainCore, ...accessories, ...conditioning],
    cooldown,
  };
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

async function callPlannerLLM(userMessage: string): Promise<string> {
  const prompt = `
Return ONLY JSON (no markdown or fences) that matches:
{
  "name": string,
  "duration_min": number,
  "phases": [
    { "phase": "warmup"|"main"|"accessory"|"conditioning"|"cooldown",
      "items": [ { "name": string, "sets"?: number|string, "reps"?: number|string, "duration"?: string, "instruction"?: string, "isAccessory"?: boolean } ]
    }
  ],
  "est_total_minutes"?: number
}

Constraints:
- Use only equipment the user has (if specified elsewhere).
- Do not include snatch/clean/jerk variants.
- Sets and reps can be numbers or strings.

User request: "${userMessage}"
`.trim();

  const resp = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    temperature: 0.2,
    max_tokens: 1600,
    messages: [{ role: "user", content: prompt }],
  });

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

  const body = await req.json().catch(() => ({}));
  const message = typeof body?.message === "string" ? body.message : "";

  if (!message) {
    return NextResponse.json({ ok: false, error: "Missing message" }, { status: 400 });
  }

  let aiText = "";
  let parsePath: "direct-json" | "as-is" | "fence" | "balanced" | "none" = "none";
  let rawJsonExtract: string | null = null;

  try {
    // TEST BYPASS: If the client pastes the JSON itself, skip the model entirely
    if (message.trim().startsWith("{")) {
      aiText = message.trim();
      parsePath = "as-is";
    } else {
      aiText = await callPlannerLLM(message);
    }

    // Try to parse as-is
    let parsed: any = null;
    try {
      parsed = JSON.parse(aiText);
      parsePath = parsePath === "none" ? "as-is" : parsePath;
      rawJsonExtract = aiText;
    } catch {
      // Try fenced ```json blocks
      const fence = aiText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (fence?.[1]) {
        try {
          parsed = JSON.parse(fence[1]);
          parsePath = "fence";
          rawJsonExtract = fence[1];
        } catch {
          // fall through
        }
      }
      // Try first balanced { ... }
      if (!parsed) {
        const chunk = findJsonObject(aiText);
        if (chunk) {
          try {
            parsed = JSON.parse(chunk);
            parsePath = "balanced";
            rawJsonExtract = chunk;
          } catch {
            // fall through
          }
        }
      }
    }

    const { plan, warnings } = normalizePlan(parsed);
    if (!plan) {
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to generate workout plan",
          details: "Planner JSON failed validation",
          debug: {
            version: VERSION,
            parsePath,
            hadJsonExtract: Boolean(rawJsonExtract),
            aiTextHead: aiText.slice(0, 400),
            warnings,
          },
        },
        { status: 400 }
      );
    }

    // Remove oly lifts just in case
    const banned = /snatch|power\s*clean|clean\s*&?\s*jerk|jerk/i;
    plan.phases.forEach((ph) => {
      ph.items = ph.items.filter((it) => !banned.test(it.name));
    });

    const workout = toLegacyWorkout(plan);
    const title = plan.name || "Planned Session";
    const minutes = String(plan.est_total_minutes ?? plan.duration_min ?? "").trim();

    return NextResponse.json({
      ok: true,
      message: `Planned: ${title}${minutes ? ` (~${minutes} min)` : ""}.`,
      plan,
      workout,
      debug: debug
        ? {
            version: VERSION,
            validation_ok: true,
            warnings,
            parsePath,
            rawJsonPreview: (rawJsonExtract ?? "").slice(0, 400),
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
              aiTextHead: (aiText || "").slice(0, 400),
            }
          : undefined,
      },
      { status: 500 }
    );
  }
}


