// app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** ---------- utilities ---------- */

function J(status: number, body: any) { return NextResponse.json(body, { status }); }
const isArray = Array.isArray;

type Split = 'pull'|'push'|'legs'|'upper'|'full'|'hiit';
type Msg = { role: 'user'|'assistant'|'system'; content: string };

function minutesToBudget(total: number) {
  const warmup = Math.min(10, Math.max(5, Math.round(total * 0.18)));
  const main = Math.round(total * 0.42);
  const cooldown = Math.max(3, Math.round(total * 0.1));
  const accessories = Math.max(6, total - warmup - main - cooldown);
  return { warmup, main, accessories, cooldown };
}

function phasesFromWorkout(w: any) {
  const warm = isArray(w?.warmup) ? w.warmup : [];
  const main = isArray(w?.mainExercises) ? w.mainExercises : [];
  const fin  = w?.finisher ? [w.finisher] : [];
  return [
    { phase: 'prep',       items: warm },
    { phase: 'strength',   items: main },
    { phase: 'activation', items: [] },
    { phase: 'carry',      items: fin },
  ];
}

function ensureArray<T>(v: any): T[] { return isArray(v) ? v : v ? [v] : []; }

/** ---------- Supabase helpers (server) ---------- */

function makeServerSupabase() {
  // Use service role if available (bypasses RLS during server actions), else anon (requires read RLS)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

async function getUserEquipmentFromDB(userId?: string) {
  const supabase = makeServerSupabase();

  // Try a couple of common shapes; pick whatever exists in your DB.
  // 1) user_equipment (user_id, equipment_name)
  if (userId) {
    const { data: ue, error: e1 } = await supabase
      .from('user_equipment')
      .select('equipment_name')
      .eq('user_id', userId)
      .limit(200);
    if (!e1 && ue && ue.length) return ue.map(x => String(x.equipment_name));
  }

  // 2) profiles_equipment (id -> array text column "equipment")
  if (userId) {
    const { data: pe, error: e2 } = await supabase
      .from('profiles_equipment')
      .select('equipment')
      .eq('user_id', userId)
      .maybeSingle();
    if (!e2 && pe?.equipment && Array.isArray(pe.equipment)) return pe.equipment.map(String);
  }

  // 3) fallback empty
  return [] as string[];
}

type CatalogRow = { name: string; category?: string|null; movement_pattern?: string|null; target_muscles?: string[]|string|null; equipment_required?: string[]|string|null };

async function getExerciseCatalogFiltered(split: Split, equipment: string[], limit = 120): Promise<CatalogRow[]> {
  const supabase = makeServerSupabase();

  const rows: CatalogRow[] = [];

  // prefer exercises_final
  const { data: ef } = await supabase
    .from('exercises_final')
    .select('name,category,movement_pattern,target_muscles,equipment_required')
    .limit(limit);
  if (ef) rows.push(...ef as any);

  // fallback to exercises if needed
  if (rows.length < 10) {
    const { data: ex } = await supabase
      .from('exercises')
      .select('name,category,movement_pattern,target_muscles,equipment_required')
      .limit(limit);
    if (ex) rows.push(...ex as any);
  }

  // Filter to user equipment only
  const eq = equipment.map(e => e.toLowerCase());
  const useRow = (r: CatalogRow) => {
    const joined = [
      r.name, r.category, r.movement_pattern,
      Array.isArray(r.target_muscles) ? r.target_muscles.join(' ') : r.target_muscles,
      Array.isArray(r.equipment_required) ? r.equipment_required.join(' ') : r.equipment_required,
    ].filter(Boolean).join(' ').toLowerCase();

    // allow bodyweight/bands/TRX always
    const okEquip = eq.length === 0 || eq.some(k => joined.includes(k)) || /bodyweight|band|mini-?band|trx/.test(joined);
    return okEquip;
  };

  // Light split relevance (keywords; still leaves choice to LLM)
  const splitHints = {
    pull: /(row|pull[-\s]?down|pull[-\s]?up|hinge|deadlift|face pull|rear delt|trap|lat|scap|carry)/i,
    push: /(press|push[-\s]?up|dip|bench|incline|overhead|triceps)/i,
    legs: /(squat|hinge|deadlift|lunge|step[-\s]?up|posterior|hamstring|quad|calf)/i,
    upper: /(press|row|pull[-\s]?down|pull[-\s]?up|rear delt|face pull|overhead|push[-\s]?up)/i,
    full: /(squat|press|row|hinge|carry|clean|snatch|burpee|thruster)/i,
    hiit: /(interval|bike|row|ski|kettlebell swing|slam|burpee|battle rope|sled)/i,
  }[split];

  const filtered = rows.filter(r => useRow(r) && (splitHints ? splitHints.test(`${r.name} ${r.category} ${r.movement_pattern}`) : true));

  // Dedup by name
  const seen = new Set<string>();
  return filtered.filter(r => {
    const key = (r.name || '').toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, limit);
}

/** ---------- Anthropic ---------- */

async function callClaude(system: string, user: unknown) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('Missing ANTHROPIC_API_KEY');
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model: 'claude-3-5-sonnet-20240620', max_tokens: 1400, system, messages: [{ role: 'user', content: JSON.stringify(user) }]}),
  });
  const ct = resp.headers.get('content-type') || '';
  const raw = await resp.text();
  if (!ct.includes('application/json')) throw new Error(`Claude non-JSON ${resp.status}: ${raw.slice(0,160)}`);
  const data = JSON.parse(raw);
  const text = data?.content?.[0]?.text ?? '';
  try { return JSON.parse(text); } catch { return { text }; }
}

/** ---------- JSON validation & repair ---------- */

function validateShape(obj: any) {
  const errors: string[] = [];
  if (!obj || typeof obj !== 'object') errors.push('root not object');

  const w = obj?.workout;
  if (!w || typeof w !== 'object') errors.push('workout missing');

  const warm = ensureArray<any>(w?.warmup);
  const main = ensureArray<any>(w?.mainExercises);
  if (main.length === 0) errors.push('mainExercises empty');

  const checkItem = (x: any, path: string) => {
    if (!x || typeof x !== 'object') errors.push(`${path} not object`);
    const name = x?.name ?? x?.exercise;
    if (!name || typeof name !== 'string') errors.push(`${path}.name missing`);
  };
  warm.forEach((x, i) => checkItem(x, `workout.warmup[${i}]`));
  main.forEach((x, i) => checkItem(x, `workout.mainExercises[${i}]`));

  return { ok: errors.length === 0, errors };
}

async function repairWithClaude(broken: any, errors: string[], systemBase: string) {
  const sys = systemBase + '\nYou returned invalid JSON. Fix it to satisfy the schema and errors listed.';
  const user = { broken, errors };
  return callClaude(sys, user);
}

/** ---------- main route ---------- */

export async function POST(req: NextRequest) {
  try {
    if (!((req.headers.get('content-type')||'').includes('application/json'))) {
      return J(200, { ok:false, error:'content-type must be application/json' });
    }

    const body = await req.json() as {
      messages?: Msg[];
      minutes?: number;
      split?: Split;
      equipment?: string[];
      userId?: string;
      style?: string | null;
    };

    // 1) equipment: prefer explicit in body, else DB lookup
    let equipment: string[] = isArray(body?.equipment) ? (body!.equipment as string[]) : [];
    if (equipment.length === 0) {
      equipment = await getUserEquipmentFromDB(body?.userId);
    }
    const equipmentClean = [...new Set(equipment.map(x => String(x).trim()))];

    // 2) classify intent (LLM) — split, minutes, style from free text (if not provided)
    const classifierSystem =
`You extract intent for workout planning. Output strict JSON: {"split":"pull|push|legs|upper|full|hiit","minutes":number,"style":"default|ocho"}.
Rules: default to {"split":"pull","minutes":45,"style":"default"} if uncertain.`;
    const lastUserText = [...(body.messages||[])].reverse().find(m => m.role==='user')?.content || '';
    const classResult = await callClaude(classifierSystem, { text: lastUserText, provided: { split: body.split, minutes: body.minutes, style: body.style }});
    const split: Split = (body.split || classResult?.split || 'pull') as Split;
    const minutes = Number(body.minutes || classResult?.minutes || 45);
    const style = (body.style || classResult?.style || 'default') as 'default'|'ocho';

    // 3) catalog — ground the LLM in your exercises, filtered by your equipment
    const catalog = await getExerciseCatalogFiltered(split, equipmentClean);

    // 4) generation system prompt — constraints, no hardcoding of exercises
    const budget = minutesToBudget(minutes);
    const system =
`You are TrainAI, a world-class strength coach. Compose a complete ${split.toUpperCase()} workout as strict JSON.

Constraints:
- Use ONLY exercises that can be done with the provided equipment list and the catalog items given (by name).
- Warm-up must be ${budget.warmup} minutes (5–10 min window) and MUST include scap/shoulder prep AND thoracic rotation or anti-rotation.
- Choose ONE main lift that suits the split and available equipment; this is the only thing that repeats across weeks. Place it first in "workout.mainExercises" with {"isAccessory":false}. All others are accessories with {"isAccessory":true}.
- Fit the total time: warmup ${budget.warmup} min, main ${budget.main} min, accessories ${budget.accessories} min, cooldown ${budget.cooldown} min.
- Keep instructions concise. Prefer patterns, not machines, unless catalog shows only machines for that pattern.
- Style: ${style === 'ocho'
      ? 'Joe Holder Ocho style — include crawling/ground-based core, tempo or isometric cues on at least one accessory, pair accessories with breath/mobility resets where sensible, and include a carry or sled if equipment allows.'
      : 'General evidence-based strength style.'}

Schema (strict):
{
  "ok": true,
  "name": string,
  "message": string,
  "coach": string,
  "plan": { "split": "${split}", "duration": ${minutes}, "name": string, "main_lift": string },
  "workout": {
    "warmup": [{ "name": string, "sets"?: number|string, "reps"?: string, "duration"?: string, "instruction"?: string }],
    "mainExercises": [{ "name": string, "sets"?: number|string, "reps"?: string, "duration"?: string, "instruction"?: string, "isAccessory": boolean }],
    "finisher"?: { "name": string, "sets"?: number|string, "reps"?: string, "duration"?: string, "instruction"?: string }
  }
}`;

    // 5) user payload to the LLM
    const user = {
      minutes, split, style, budget,
      equipment: equipmentClean,
      catalog,           // <— your database rows; the model must choose from these
      history: body.messages || []
    };

    // 6) first pass
    let out = await callClaude(system, user);

    // 7) validate & repair if needed
    let { ok, errors } = validateShape(out);
    if (!ok) {
      const repaired = await repairWithClaude(out, errors, system);
      const v2 = validateShape(repaired);
      if (v2.ok) out = repaired; else return J(200, { ok:false, error: 'LLM returned invalid JSON', details: v2.errors });
    }

    // 8) attach phases for your UI and return
    const workout = out.workout || {};
    const plan = { ...(out.plan || {}), split, duration: minutes, name: out?.name || `${split[0].toUpperCase()+split.slice(1)} (~${minutes} min)` };
    const payload = {
      ok: true,
      name: out?.name || plan.name,
      message: out?.message || plan.name,
      coach: out?.coach || `${split.toUpperCase()} day. Main lift: ${String(plan.main_lift || workout?.mainExercises?.[0]?.name || '')}.`,
      plan: { ...plan, phases: phasesFromWorkout(workout) },
      workout
    };

    return J(200, payload);
  } catch (err: any) {
    console.error('api/chat fatal', err?.stack || err);
    return J(200, { ok:false, error: err?.message || 'Internal server error' });
  }
}
