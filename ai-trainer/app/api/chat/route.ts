// app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { claudeJSON } from '@/lib/llm';
import { ResponseOut, phasesFromWorkout, budget } from '@/lib/schema';
import { fetchCatalog, fetchUserEquipmentNames, Split } from '@/lib/catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Msg = { role: 'user'|'assistant'|'system'; content: string };
type Split = 'pull'|'push'|'legs'|'upper'|'full'|'hiit';

function J(status:number, body:any){ return NextResponse.json(body, { status }); }
const A = Array.isArray;

// Debug accumulator — returned only when body.debug === true or ?debug=1 is sent
type DebugLog = Record<string, any>;
function dpush(d: DebugLog, key: string, val: any) {
  try { d[key] = val; } catch {}
}
function wantDebug(req: Request, body: any) {
  try {
    // @ts-ignore
    const u = new URL(req.url);
    if (u.searchParams.get('debug') === '1') return true;
  } catch {}
  return !!body?.debug;
}

function synthCoach(raw: any, plan: any, workout: any, split: Split, minutes: number, style: 'default'|'ocho') {
  const s = String(raw || '').trim();
  if (s.length >= 20 && !/^trainai$/i.test(s)) return s;
  const main = plan?.main_lift || workout?.mainExercises?.[0]?.name || 'primary lift';
  const tag = style === 'ocho' ? ' (Ocho style)' : '';
  return `${split.toUpperCase()} day${tag}. Main lift: ${main}. Warm-up includes scap/shoulder prep and thoracic rotation/anti-rotation. We'll fill accessories within ${minutes} minutes and finish with a short cooldown.`;
}

function toStringRep(v: any) {
  if (v == null) return undefined;
  if (typeof v === 'number') return String(v);
  return String(v);
}

function normalizeDuration(x: any) {
  if (x?.duration) return x.duration;
  if (x?.duration_seconds) {
    const s = Number(x.duration_seconds);
    if (!isFinite(s)) return undefined;
    if (s % 60 === 0) return `${s/60} min`;
    return `${s}s`;
  }
  return undefined;
}

function normalizeItems(items: any[]): any[] {
  return (Array.isArray(items) ? items : []).map((it: any) => ({
    name: it?.name ?? it?.exercise ?? '',
    sets: it?.sets,
    reps: toStringRep(it?.reps),
    duration: normalizeDuration(it),
    instruction: it?.instruction,
    isAccessory: typeof it?.isAccessory === 'boolean' ? it.isAccessory : undefined,
    is_main: it?.is_main, // we'll convert below
  })).filter(x => x.name);
}

// Accepts any of: {workout:{main:[]}}, {workout:{mainExercises:[]}}, or {plan:{phases:[...]}}
function normalizeLLM(out: any) {
  // A) Phase-shaped JSON
  const phases = Array.isArray(out?.plan?.phases) ? out.plan.phases : [];
  const byPhase = (key: string) =>
    phases.find((p: any) => (p?.phase||'').toLowerCase() === key)?.items || [];

  // B) Workout-shaped JSON (various keys we've seen)
  const w = out?.workout || {};
  const mainA = w?.mainExercises ?? w?.main ?? w?.strength ?? [];
  const warmA = w?.warmup ?? w?.warm_up ?? [];
  const finA  = w?.finisher ?? w?.cooldown?.[0] ?? null;

  // Prefer explicit workout if it has main items; else derive from phases
  const warm = normalizeItems(
    Array.isArray(mainA) && mainA.length ? warmA : byPhase('warmup').length ? byPhase('warmup') : byPhase('prep')
  );
  const main = normalizeItems(
    Array.isArray(mainA) && mainA.length ? mainA : byPhase('main').concat(byPhase('strength'))
  );
  const fin  = finA ? normalizeItems([finA])[0] : (byPhase('carry_block')[0] || byPhase('conditioning')[0] || byPhase('cooldown')[0]);

  // First main is the anchor; others are accessories
  if (main.length) {
    main[0] = { ...main[0], isAccessory: false, is_main: undefined };
    for (let i=1;i<main.length;i++) main[i] = { ...main[i], isAccessory: true, is_main: undefined };
  }

  return { workout: { warmup: warm, mainExercises: main, finisher: fin } };
}



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
      style?: string | null; // e.g., "ocho"
      debug?: boolean;
    };

    const debug: DebugLog = {};
    const dbg = wantDebug(req, body);
    dpush(debug, 'incoming', {
      hasMessages: Array.isArray(body?.messages),
      minutes: body?.minutes,
      split: body?.split,
      style: body?.style,
      equipmentProvidedCount: Array.isArray(body?.equipment) ? body.equipment.length : 0,
    });

    // 1) ensure we know the user & equipment
    const userId = body.userId || req.headers.get('x-user-id') || '';
    const equipment =
      Array.isArray(body.equipment) && body.equipment.length
        ? body.equipment
        : (userId ? await fetchUserEquipmentNames(userId) : []);
    dpush(debug, 'equipment', { final: equipment, count: equipment.length });

    // 2) classify intent (you already do this); set split/minutes/style
    const classifierSystem =
`Extract intent for workout planning. Output strict JSON:
{"split":"pull|push|legs|upper|full|hiit","minutes":number,"style":"default|ocho"}.
Default: {"split":"pull","minutes":45,"style":"default"} if unclear.`;

    const lastUser = [...(body.messages||[])].reverse().find(m => m.role==='user')?.content || '';
    const intents = await claudeJSON(classifierSystem, { text: lastUser, provided: { split: body.split, minutes: body.minutes, style: body.style }});

    const split: Split = (body.split || intents?.split || 'pull') as Split;
    const minutes = Number(body.minutes || intents?.minutes || 45);
    const style = (body.style || intents?.style || 'default') as 'default'|'ocho';
    const time = budget(minutes);
    dpush(debug, 'classified', { split, minutes, style });

    // 3) pull the catalog grounded to YOUR SCHEMA + YOUR EQUIPMENT
    const catalog = await fetchCatalog(split, equipment);
    dpush(debug, 'catalog', { count: catalog.length, sample: catalog.slice(0, 8).map(r => r.name) });

    // Optional: fallback if catalog too small
    if (catalog.length < 10) {
      dpush(debug, 'catalogFallback', 'split filter too narrow; using equipment-only catalog');
      // For now, we'll keep the current catalog but log the fallback
      // In the future, you could modify getCatalog to accept a flag for equipment-only filtering
    }

    // 4) Ask the LLM to PLAN everything using only your catalog/equipment
    const system =
`You are TrainAI, a strength coach. Compose a complete ${split.toUpperCase()} workout as strict JSON only.

Constraints
- Use ONLY exercises present in the provided "catalog" (by name) and that are possible with the provided "equipment". If an exercise needs unavailable equipment, pick another from the catalog.
- Warm-up must be ${time.warmup} minutes (5–10 min window) and MUST include scap/shoulder prep AND thoracic rotation or anti-rotation.
- Choose ONE main lift that suits the split and equipment; make it the first item of "workout.mainExercises" with {"isAccessory":false}. All other main items are accessories with {"isAccessory":true}.
- Fit within minutes: warmup ${time.warmup}, main ${time.main}, accessories ${time.accessories}, cooldown ${time.cooldown}.
- Style: ${style === 'ocho'
    ? 'Joe Holder Ocho style — include crawling/ground-based core, tempo OR isometric cues on at least one accessory, pair accessories with breath/mobility resets when helpful, and prefer carries or sled work if equipment allows.'
    : 'Evidence-based general strength style.'}
- Keep instructions concise.

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

    const user = {
      minutes, split, style, budget: time,
      equipment,
      catalog,            // ← your DB exercises
      history: body.messages || [],
    };

    let out = await claudeJSON(system, user);

    // Normalize whatever the LLM returns into the ONE shape your UI expects
    let { workout } = normalizeLLM(out);

    dpush(debug, 'firstPass', {
      warm: Array.isArray(workout?.warmup) ? workout.warmup.length : 0,
      main: Array.isArray(workout?.mainExercises) ? workout.mainExercises.length : 0,
      coachLen: (out?.coach || '').length,
    });

    // If main is still empty -> ask the model to repair its own JSON (no hardcoded moves)
    if (!Array.isArray(workout.mainExercises) || workout.mainExercises.length === 0) {
      dpush(debug, 'repairIssues', ['mainExercises is empty']);
      out = await claudeJSON(
        system + '\nYour previous JSON omitted "workout.mainExercises". Repair it using only names from "catalog".',
        { previous: out, equipment, catalog, split, minutes, style }
      );
      ({ workout } = normalizeLLM(out));
      dpush(debug, 'secondPass', {
        warm: Array.isArray(workout?.warmup) ? workout.warmup.length : 0,
        main: Array.isArray(workout?.mainExercises) ? workout.mainExercises.length : 0,
      });
    }

    // Derive plan & phases for your UI
    const mainLift = workout?.mainExercises?.[0]?.name || '';
    const plan = {
      split,
      duration: minutes,
      name: out?.name || `${split[0].toUpperCase()+split.slice(1)} (~${minutes} min)`,
      main_lift: out?.plan?.main_lift || mainLift,
      phases: [
        { phase:'prep', items: workout.warmup },
        { phase:'strength', items: workout.mainExercises },
        { phase:'activation', items: [] },
        { phase:'carry', items: workout.finisher ? [workout.finisher] : [] },
      ],
    };

    // Coach line (never "TrainAI")
    const coach = ((): string => {
      const raw = String(out?.coach || '').trim();
      if (raw && raw.length > 20 && !/^trainai$/i.test(raw)) return raw;
      return `${split.toUpperCase()} day. Main lift: ${mainLift || '—'}. Warm-up includes scap/shoulder prep and thoracic rotation/anti-rotation.`;
    })();

    // Final payload
    const payload = {
      ok: true,
      name: out?.name || plan.name,
      message: out?.message || plan.name,
      coach,
      plan,
      workout,
    };
    if (dbg) (payload as any).debug = debug;
    return NextResponse.json(payload, { status: 200 });
  } catch (err:any) {
    console.error('api/chat fatal', err?.stack || err);
    return J(200, { ok:false, error: err?.message || 'Internal server error' });
  }
}
