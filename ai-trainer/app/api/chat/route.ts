// app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { claudeJSON } from '@/lib/llm';
import { ResponseOut, phasesFromWorkout, budget } from '@/lib/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Msg = { role: 'user'|'assistant'|'system'; content: string };
type Split = 'pull'|'push'|'legs'|'upper'|'full'|'hiit';

function J(status:number, body:any){ return NextResponse.json(body, { status }); }
const A = Array.isArray;

function makeCoachText(opts: { split: Split; minutes: number; mainLift: string; style: 'default'|'ocho' }) {
  const tag = opts.style === 'ocho' ? ' (Ocho style)' : '';
  return `${opts.split.toUpperCase()} day${tag}. Main lift: ${opts.mainLift}. Warm-up includes scap/shoulder prep and thoracic rotation/anti-rotation. We'll fill accessories smartly within ${opts.minutes} minutes and finish with a short cooldown.`;
}

function normalizeCoach(raw: any, plan: any, workout: any, split: Split, minutes: number, style: 'default'|'ocho') {
  const s = (raw ?? '').toString().trim();
  const tooShort = s.length < 20 || /^trainai$/i.test(s);
  const mainLift = plan?.main_lift || workout?.mainExercises?.[0]?.name || 'primary lift';
  return tooShort ? makeCoachText({ split, minutes, mainLift, style }) : s;
}

async function getUserEquipment(userId?: string) {
  const sb = supabaseServer();
  // Try common shapes; keep whichever exists in your DB.
  if (userId) {
    const { data: ue } = await sb.from('user_equipment').select('equipment_name').eq('user_id', userId).limit(200);
    if (ue?.length) return ue.map(x => String(x.equipment_name));
    const { data: pe } = await sb.from('profiles_equipment').select('equipment').eq('user_id', userId).maybeSingle();
    if (pe?.equipment && Array.isArray(pe.equipment)) return pe.equipment.map(String);
  }
  return [];
}

type CatalogRow = { name: string; category?: string|null; movement_pattern?: string|null; target_muscles?: string[]|string|null; equipment_required?: string[]|string|null };

async function getCatalog(split: Split, equipment: string[], limit=200): Promise<CatalogRow[]> {
  const sb = supabaseServer();
  const rows: CatalogRow[] = [];
  const { data: ef } = await sb.from('exercises_final').select('name,category,movement_pattern,target_muscles,equipment_required').limit(limit);
  if (ef) rows.push(...ef as any);
  if (rows.length < 10) {
    const { data: ex } = await sb.from('exercises').select('name,category,movement_pattern,target_muscles,equipment_required').limit(limit);
    if (ex) rows.push(...ex as any);
  }

  const eq = equipment.map(e => e.toLowerCase());
  const passEquip = (r: CatalogRow) => {
    const joined = [
      r.name, r.category, r.movement_pattern,
      Array.isArray(r.target_muscles) ? r.target_muscles.join(' ') : r.target_muscles,
      Array.isArray(r.equipment_required) ? r.equipment_required.join(' ') : r.equipment_required,
    ].filter(Boolean).join(' ').toLowerCase();
    return eq.length === 0 || eq.some(k => joined.includes(k)) || /bodyweight|band|mini-?band|trx/.test(joined);
  };

  const hints = {
    pull: /(row|pull[-\s]?down|pull[-\s]?up|hinge|deadlift|face pull|rear delt|lat|scap|carry)/i,
    push: /(press|push[-\s]?up|dip|bench|incline|overhead|triceps)/i,
    legs: /(squat|hinge|deadlift|lunge|step[-\s]?up|posterior|hamstring|quad|calf)/i,
    upper: /(press|row|pull[-\s]?down|pull[-\s]?up|rear delt|face pull|overhead|push[-\s]?up)/i,
    full: /(squat|press|row|hinge|carry|clean|snatch|burpee|thruster)/i,
    hiit: /(interval|kettlebell swing|slam|burpee|battle rope|sled)/i,
  }[split];

  const filtered = rows.filter(r => passEquip(r) && (hints ? hints.test(`${r.name} ${r.category} ${r.movement_pattern}`) : true));

  const seen = new Set<string>();
  return filtered.filter(r => {
    const k = (r.name || '').toLowerCase();
    if (!k || seen.has(k)) return false;
    seen.add(k); return true;
  }).slice(0, limit);
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
    };

    // 1) Equipment: client > DB
    let equipment = A(body.equipment) ? body.equipment! : await getUserEquipment(body.userId);
    equipment = [...new Set(equipment.map(s => String(s).trim()))];

    // 2) Classify intent (LLM) — *no* hardcoded rules
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

    // 3) Grounding catalog from your DB
    const catalog = await getCatalog(split, equipment);

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

    // ---- Pattern sanity: main lift must match split semantics (LLM will repair) ----
    const splitMustMatch: Record<Split, RegExp> = {
      pull: /(deadlift|hinge|row|pull[-\s]?up|pull[-\s]?down|lat|rear delt|face pull|carry)/i,
      push: /(bench|press|push[-\s]?up|dip|overhead|triceps)/i,
      legs: /(squat|lunge|hinge|deadlift|step[-\s]?up|posterior|hamstring|quad|calf)/i,
      upper: /(press|row|pull[-\s]?down|pull[-\s]?up|rear delt|face pull|overhead|push[-\s]?up)/i,
      full: /(squat|press|row|hinge|carry)/i,
      hiit: /(interval|sled|battle rope|sprint|swing|circuit|emom|amrap)/i,
    };

    let workout = out.workout || {};
    let plan = { ...(out.plan || {}), split, duration: minutes, name: out?.name || `${split[0].toUpperCase()+split.slice(1)} (~${minutes} min)` };

    // minimal validation
    const issues: string[] = [];
    if (!Array.isArray(workout?.warmup)) issues.push('workout.warmup must be an array');
    if (!Array.isArray(workout?.mainExercises) || !workout.mainExercises.length) issues.push('workout.mainExercises must be a non-empty array');

    // split/movement mismatch? ask the LLM to repair
    const firstMain = workout?.mainExercises?.[0]?.name || '';
    if (firstMain && !splitMustMatch[split].test(firstMain)) {
      issues.push(`Main lift "${firstMain}" does not match split "${split}". Choose a suitable main lift from catalog for ${split}.`);
    }

    // any item not in catalog? (keeps choices grounded to your DB)
    const catalogNames = new Set((catalog||[]).map((r:any)=>String(r.name).toLowerCase()));
    const illegal: string[] = [];
    [...(workout?.warmup||[]), ...(workout?.mainExercises||[])].forEach((x:any) => {
      const n = String(x?.name||'').toLowerCase();
      if (n && !catalogNames.has(n)) illegal.push(x.name);
    });
    if (illegal.length) {
      issues.push(`Found exercises not in catalog: ${[...new Set(illegal)].join(', ')}`);
    }

    if (issues.length) {
      out = await claudeJSON(system + '\nRepair the plan to satisfy these issues and re-emit strict JSON:', {
        issues, previous: out, equipment, catalog, split, minutes, style
      });
      workout = out.workout || workout;
      plan = { ...(out.plan || plan), split, duration: minutes, name: out?.name || plan.name };
    }

    // ensure plan.main_lift exists
    if (!plan.main_lift && Array.isArray(workout?.mainExercises) && workout.mainExercises[0]?.name) {
      plan.main_lift = workout.mainExercises[0].name;
    }

    // always attach phases for the existing UI
    const phases = [
      { phase: 'prep',       items: Array.isArray(workout?.warmup) ? workout.warmup : [] },
      { phase: 'strength',   items: Array.isArray(workout?.mainExercises) ? workout.mainExercises : [] },
      { phase: 'activation', items: [] },
      { phase: 'carry',      items: workout?.finisher ? [workout.finisher] : [] },
    ];

    // synthesize a helpful coach paragraph if model gave "TrainAI" or too short
    const coach = normalizeCoach(out?.coach, plan, workout, split, minutes, style);

    const payload = {
      ok: true,
      name: out?.name || plan.name,
      message: out?.message || plan.name,
      coach,
      plan: { ...plan, phases },
      workout
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (err:any) {
    console.error('api/chat fatal', err?.stack || err);
    return J(200, { ok:false, error: err?.message || 'Internal server error' });
  }
}
