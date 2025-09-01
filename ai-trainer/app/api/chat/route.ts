// app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { supabase } from '@/lib/supabase';
import { claudeJSON } from '@/lib/llm';
import { ResponseOut, phasesFromWorkout, budget } from '@/lib/schema';
import { fetchCatalog, fetchUserEquipmentNames, fetchMobilityByTargets } from '@/lib/catalog';
import { getUserPrefs, mergeUserPrefs } from '@/lib/prefs';
import { sanitizeCooldown } from '@/lib/cooldownPolicy';
import { fetchRecentSetsForExercise, summarizeHistory } from '@/lib/history';
import { buildCoachNote } from '@/lib/coach';
import { focusFromSplit, fetchCooldownContext, mapLLMToPlanItems, shuffleInPlace } from '@/lib/cooldown';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PROGRAMS_ENABLED = process.env.NEXT_PUBLIC_ENABLE_PROGRAMS === '1';
const HYBRID_SPLIT_ENABLED = process.env.NEXT_PUBLIC_HYBRID_SPLIT_ENABLED === '1';

type Msg = { role: 'user'|'assistant'|'system'; content: string };
type Split = 'pull'|'push'|'legs'|'upper'|'full'|'hiit';

type PlanItem = {
  name: string;
  sets?: string | number;
  reps?: string | number;
  duration?: string | number;
  instruction?: string;
  isAccessory?: boolean;
};
type PlanPhase = { phase?: string; items: PlanItem[] };

function J(status:number, body:any){ return NextResponse.json(body, { status }); }
const A = Array.isArray;

// Extract the most recent assistant QA block (our TL;DR format) to guide a follow-up workout
function extractQAHints(messages?: Msg[]): string | null {
  if (!Array.isArray(messages)) return null;
  
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role !== 'assistant') continue;
    
    const t = String(m.content || '').trim();
    if (t.startsWith('TL;DR:')) {
      // Keep it compact; help the LLM but avoid token bloat
      return t.split('\n').slice(0, 6).join('\n');
    }
  }
  
  return null;
}

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

// Helper: strict JSON parse that only accepts the shape we expect
function parseCooldownJSON(payload: unknown): { items: { name: string; duration?: string; reps?: string; instruction?: string }[] } | null {
  if (!payload || typeof payload !== 'object') return null;
  const obj = payload as Record<string, unknown>;
  const items = Array.isArray(obj.items) ? obj.items : null;
  if (!items) return null;
  const cleaned = items
    .map((x) => (x && typeof x === 'object' ? x : null))
    .filter(Boolean)
    .map((x) => {
      const it = x as Record<string, unknown>;
      const name = typeof it.name === 'string' ? it.name : '';
      const duration = typeof it.duration === 'string' ? it.duration : undefined;
      const reps = typeof it.reps === 'string' ? it.reps : undefined;
      const instruction = typeof it.instruction === 'string' ? it.instruction : undefined;
      return name ? { name, duration, reps, instruction } : null;
    })
    .filter(Boolean) as { name: string; duration?: string; reps?: string; instruction?: string }[];
  return { items: cleaned };
}

function norm(s: unknown) {
  return String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function mainLiftForSplit(split: string, equipment: string[]): string | null {
  const equipmentSet = new Set(equipment.map(e => e.toLowerCase()));
  
  switch (split.toLowerCase()) {
    case 'push':
      if (equipmentSet.has('barbell') && equipmentSet.has('bench')) return 'Barbell Bench Press';
      if (equipmentSet.has('barbell') && equipmentSet.has('incline bench')) return 'Barbell Incline Press';
      if (equipmentSet.has('dumbbell')) return 'Dumbbell Bench Press';
      if (equipmentSet.has('dumbbell') && equipmentSet.has('incline bench')) return 'Dumbbell Incline Press';
      return 'Barbell Bench Press'; // fallback
      
    case 'pull':
      if (equipmentSet.has('trap bar')) return 'Trap Bar Deadlift';
      if (equipmentSet.has('barbell')) return 'Barbell Deadlift';
      return 'Trap Bar Deadlift'; // fallback
      
    case 'legs':
      if (equipmentSet.has('belt squat machine')) return 'Belt Squat';
      if (equipmentSet.has('barbell') && equipmentSet.has('rack')) return 'Back Squat';
      if (equipmentSet.has('barbell')) return 'Front Squat';
      return 'Back Squat'; // fallback
      
    case 'upper':
      if (equipmentSet.has('barbell')) return 'Overhead Press';
      if (equipmentSet.has('dumbbell')) return 'Dumbbell Shoulder Press';
      return 'Overhead Press'; // fallback
      
    case 'hiit':
      return null; // no main lift for HIIT
      
    default:
      return 'Trap Bar Deadlift'; // default fallback
  }
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

// ---------------- Hybrid helpers (local scope) ----------------
function _norm(s: unknown): string { return typeof s === 'string' ? s.trim().toLowerCase() : ''; }
function _has(equip: string[], needle: string): boolean {
  const n = needle.toLowerCase();
  return equip.some(e => e.toLowerCase().includes(n));
}
function _label(split: string): string {
  const s = _norm(split);
  if (s === 'upper') return 'Upper Body';
  if (s === 'full') return 'Full Body';
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function pickMainLift(split: string, equipment: string[]): string | null {
  const s = _norm(split);
  switch (s) {
    case 'push':
      if (_has(equipment, 'barbell') && _has(equipment, 'bench')) return 'Barbell Bench Press';
      if (_has(equipment, 'barbell') && _has(equipment, 'incline')) return 'Barbell Incline Bench Press';
      if (_has(equipment, 'dumbbell')) return 'Dumbbell Bench Press';
      if (_has(equipment, 'dumbbell')) return 'Dumbbell Incline Bench Press';
      return 'Push-Up';
    case 'pull':
      if (_has(equipment, 'trap')) return 'Trap Bar Deadlift';
      if (_has(equipment, 'barbell')) return 'Barbell Deadlift';
      return 'Romanian Deadlift (DB)';
    case 'legs':
      if (_has(equipment, 'belt')) return 'Belt Squat';
      if (_has(equipment, 'safety') && _has(equipment, 'bar')) return 'Safety Bar Squat';
      if (_has(equipment, 'barbell')) return 'Back Squat';
      if (_has(equipment, 'barbell')) return 'Front Squat';
      return 'Goblet Squat';
    case 'upper':
      return _has(equipment, 'barbell') ? 'Overhead Press' : 'Dumbbell Shoulder Press';
    case 'full':
      if (_has(equipment, 'trap')) return 'Trap Bar Deadlift';
      if (_has(equipment, 'barbell')) return 'Back Squat';
      if (_has(equipment, 'barbell')) return 'Barbell Deadlift';
      return 'Dumbbell Clean to Front Squat';
    case 'hiit':
      return null;
    default:
      return null;
  }
}

function clampCoach(s: unknown): string {
  const txt = typeof s === 'string' ? s.trim() : '';
  if (!txt) return 'Move crisply, leave 1–2 reps in reserve on main sets, and prioritize quality over load.';
  return txt.length > 240 ? `${txt.slice(0, 237)}…` : txt;
}

function uniqByName<T extends { name?: string }>(arr: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of arr) {
    const n = _norm(it?.name);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(it);
  }
  return out;
}

async function fetchAccessoryPoolBySplit(userId: string, split: string, equipment: string[], limit = 24) {
  // Pull accessories; prefer those matching split focus & available equipment
  const { data, error } = await supabase
    .from('exercises')
    .select('name, primary_muscle, target_muscles, equipment_required, exercise_phase')
    .eq('exercise_phase', 'accessory')
    .limit(limit);
  if (error) return [];
  const focus = (() => {
    const s = _norm(split);
    if (s === 'push') return ['chest', 'shoulders', 'triceps'];
    if (s === 'pull') return ['back', 'lats', 'biceps'];
    if (s === 'legs') return ['quads', 'glutes', 'hamstrings', 'hips'];
    if (s === 'upper') return ['shoulders', 'chest', 'back', 'triceps', 'biceps'];
    if (s === 'full') return ['full', 'hips', 'back', 'core', 'glutes', 'quads'];
    if (s === 'hiit') return ['full', 'cardio', 'core'];
    return [];
  })();
  const hasEquip = (req: any) => {
    const raw = typeof req === 'string' ? req : JSON.stringify(req ?? '');
    const lower = raw.toLowerCase();
    // Any mention of an owned item is acceptable
    return equipment.length === 0 || equipment.some(e => lower.includes(e.toLowerCase()));
  };
  const score = (row: any) => {
    const pm = _norm(row?.primary_muscle);
    const tm = typeof row?.target_muscles === 'string' ? row.target_muscles.toLowerCase() : JSON.stringify(row?.target_muscles ?? '').toLowerCase();
    let s = 0;
    for (const f of focus) {
      if (pm.includes(f)) s += 2;
      if (tm.includes(f)) s += 1;
    }
    if (hasEquip(row?.equipment_required)) s += 1;
    return s;
  };
  const deduped = uniqByName((data ?? []).map(r => ({ name: r.name, row: r })));
  deduped.sort((a, b) => score(b.row) - score(a.row));
  return deduped.map(x => ({ name: x.name }));
}

async function fetchRecentExerciseNames(userId: string, days = 14): Promise<Set<string>> {
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const { data, error } = await supabase
    .from('workout_log_entries')
    .select('exercise_name, created_at')
    .gte('created_at', since)
    .eq('user_id', userId)
    .limit(500);
  if (error) return new Set();
  const s = new Set<string>();
  for (const r of data ?? []) {
    const n = _norm((r as any)?.exercise_name);
    if (n) s.add(n);
  }
  return s;
}

// Pull cooldown names from the user's recent saved workouts (since cooldowns aren't in log entries)
async function fetchRecentCooldownNamesFromWorkouts(userId: string, days = 28): Promise<Set<string>> {
  if (!userId) return new Set();

  const since = new Date(Date.now() - days * 864e5).toISOString();

  const { data, error } = await supabase
    .from('workouts')
    .select('cooldown, created_at')
    .eq('user_id', userId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return new Set();

  const names = new Set<string>();
  const add = (nm: unknown) => {
    const k = _norm(nm);
    if (k) names.add(k);
  };

  for (const row of data ?? []) {
    const cd = (row as any)?.cooldown;
    // common shapes: array of items; or {items:[...]} ; or phase-shaped {phase:"cooldown", items:[...]}
    if (Array.isArray(cd)) {
      for (const it of cd) add((it as any)?.name);
    } else if (cd && typeof cd === 'object') {
      const items = Array.isArray((cd as any).items) ? (cd as any).items : undefined;
      if (items) {
        for (const it of items) add((it as any)?.name);
      } else if (Array.isArray((cd as any)?.cooldown)) {
        for (const it of (cd as any).cooldown) add((it as any)?.name);
      }
    }
  }

  return names;
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

    // identify user once for the whole handler
    const userId = (body?.userId ?? req.headers.get('x-user-id') ?? '') as string;

    const debug: DebugLog = {};
    const dbg = wantDebug(req, body);
    dpush(debug, 'incoming', {
      hasMessages: Array.isArray(body?.messages),
      minutes: body?.minutes,
      split: body?.split,
      style: body?.style,
      equipmentProvidedCount: Array.isArray(body?.equipment) ? body.equipment.length : 0,
    });

    // If the prior turn was a QA answer (TL;DR format), capture it to bias the next workout
    const qaHintsText = extractQAHints(body?.messages);
    if (qaHintsText) dpush(debug, 'hints', { qa: qaHintsText.slice(0, 240) });

    const splitInput = typeof body?.split === 'string' ? body.split.trim().toLowerCase() : undefined;

    // Mark which path we take
    const branch = (HYBRID_SPLIT_ENABLED && !!splitInput) ? 'HYBRID' : 'LEGACY';
    if (dbg) dpush(debug, 'branch', branch);

    // Helper: time + record any LLM call
    async function timedClaudeJSON(tag: string, system: string, user: unknown, opts?: { temperature?: number; max_tokens?: number }) {
      const t0 = Date.now();
      try {
        const res = await claudeJSON(system, user, opts);
        if (dbg) {
          debug.llm = debug.llm || {};
          debug.llm[tag] = { ms: Date.now() - t0, ok: true };
        }
        return res;
      } catch (e: any) {
        if (dbg) {
          debug.llm = debug.llm || {};
          debug.llm[tag] = { ms: Date.now() - t0, ok: false, err: String(e?.message || e) };
        }
        throw e;
      }
    }

    // ---------- HYBRID SPLIT v2 (gated) ----------
    if (HYBRID_SPLIT_ENABLED && splitInput) {
      // 1) Profile & equipment
      const profile = await getUserPrefs(userId);
      const equipmentList = Array.isArray(body?.equipment) && body.equipment.length
        ? body.equipment
        : (userId ? await fetchUserEquipmentNames(userId) : []);
      const duration = Number(body?.minutes ?? 45);

      // 2) Main lift
      const main = pickMainLift(splitInput, equipmentList);

      // 3) Seed plan (LLM fills warmup/accessory/cooldownDraft; may not change main)
      const seed = {
        split: splitInput,
        duration,
        phases: [
          { phase: 'warmup', items: [
            { name: 'Easy Cardio', duration: '3–5 min', instruction: 'Bike/row/jog to raise core temp' },
            { name: 'Dynamic Mobility', duration: '2–3 min', instruction: 'Joint circles, band work' },
          ]},
          { phase: 'strength', items: [
            ...(main ? [{ name: main, sets: '4', reps: '5–8', instruction: 'Build to a moderate-heavy top set; 1–2 RIR' }] : []),
          ]},
          { phase: 'accessory', items: [] },
          { phase: 'cooldown', items: [] },
        ],
      };

      // 4) LLM fill (STRICT JSON only)
      const sys =
        'You are a world-class strength coach. STRICT JSON ONLY. No code fences. No extra text.\n' +
        'Fill ONLY: warmup, accessory, cooldownDraft, coach. Do NOT change the main lift already present.\n' +
        'Limits: warmup 1–4 total items; accessory 2–5 items; cooldownDraft 2–4 items; coach ≤ 240 chars.';
      const usr = JSON.stringify({
        split: _label(splitInput),
        duration_min: duration,
        equipment: equipmentList,
        user_message: body?.messages?.[body.messages.length - 1]?.content || '',
        main_lift_locked: main ?? null,
        want: {
          warmup: 'array of {name, duration?, instruction?}',
          accessory: 'array of {name, sets?, reps?, instruction?}',
          cooldownDraft: 'array of {name, duration?}',
          coach: 'string (<=240 chars)',
        },
        rules: [
          'Do not change main_lift_locked.',
          'Use only available equipment.',
          'Match accessory choices to split focus.',
          'Return JSON object: { warmup:[], accessory:[], cooldownDraft:[], coach:"..." }',
        ],
      });
      // @ts-ignore existing helper returns parsed JSON
      const llm = await timedClaudeJSON('hybrid_fill', sys, usr, { temperature: 0.5, max_tokens: 700 });

      // 5) Map + safety clamps (no accessory wipe)
      const warmupItems = Array.isArray(llm?.warmup)
        ? uniqByName(llm.warmup.map((w: any) => ({
            name: typeof w?.name === 'string' ? w.name : 'Light Cardio',
            duration: typeof w?.duration === 'string' ? w.duration : undefined,
            instruction: typeof w?.instruction === 'string' ? w.instruction : undefined,
          }))).slice(0, 4)
        : seed.phases[0].items;

      let accessoryItems: any[] = Array.isArray(llm?.accessory)
        ? uniqByName(llm.accessory.map((a: any) => ({
            name: typeof a?.name === 'string' ? a.name : '',
            sets: typeof a?.sets === 'string' || typeof a?.sets === 'number' ? String(a.sets) : undefined,
            reps: typeof a?.reps === 'string' || typeof a?.reps === 'number' ? String(a.reps) : undefined,
            instruction: typeof a?.instruction === 'string' ? a.instruction : undefined,
          }))).filter(a => a.name).slice(0, 5)
        : [];

      // If LLM under-returns, top-up from DB pool to ensure >=2 accessories (cap 4)
      if (accessoryItems.length < 2) {
        const pool = await fetchAccessoryPoolBySplit(userId, splitInput, equipmentList, 40);
        const already = new Set<string>([...accessoryItems.map(i => _norm(i.name)), ...(main ? [_norm(main)] : [])]);
        const topups: any[] = [];
        for (const p of pool) {
          const n = _norm(p.name);
          if (!n || already.has(n)) continue;
          already.add(n);
          topups.push({ name: p.name, sets: '3', reps: '8–12' });
          if (accessoryItems.length + topups.length >= 4) break;
        }
        accessoryItems = [...accessoryItems, ...topups];
        // final guard: if still <2, add safe bodyweight moves
        while (accessoryItems.length < 2) {
          accessoryItems.push({ name: 'Plank', sets: '2', reps: '30–45s' });
        }
      }

      let cooldownDraft: any[] = Array.isArray(llm?.cooldownDraft)
        ? uniqByName(llm.cooldownDraft.map((c: any) => ({
            name: typeof c?.name === 'string' ? c.name : '',
            duration: typeof c?.duration === 'string' ? c.duration : undefined,
          }))).filter(c => c.name).slice(0, 4)
        : [];

      // 6) Cooldown guardrails: dedupe vs session + recent, top-up to 3–6
      const sessionNames = new Set<string>([
        ...seed.phases.flatMap(p => p.items.map((i: any) => _norm(i?.name))),
        ...warmupItems.map(i => _norm(i.name)),
        ...accessoryItems.map(i => _norm(i.name)),
      ].filter(Boolean));
      const recentNames = await fetchRecentExerciseNames(userId, 14);
      const isDup = (n: string) => sessionNames.has(_norm(n)) || recentNames.has(_norm(n));

      cooldownDraft = cooldownDraft.filter(c => c?.name && !isDup(c.name));

      if (cooldownDraft.length < 3) {
        // DB pool for cooldown/warmup
        const { data } = await supabase
          .from('exercises')
          .select('name, primary_muscle, target_muscles, exercise_phase')
          .in('exercise_phase', ['cooldown', 'warmup'])
          .limit(80);
        const focusHints = (() => {
          const s = _norm(splitInput);
          if (s === 'push') return ['chest', 'shoulders', 'triceps'];
          if (s === 'pull') return ['back', 'lats', 'biceps'];
          if (s === 'legs') return ['quads', 'glutes', 'hamstrings', 'hips'];
          if (s === 'upper') return ['shoulders', 'chest', 'back'];
          if (s === 'full') return ['full', 'hips', 'back', 'core'];
          if (s === 'hiit') return ['full', 'hips', 'back', 'core', 'hamstrings', 'quads'];
          return [];
        })();
        const score = (row: any) => {
          const pm = _norm(row?.primary_muscle);
          const tm = typeof row?.target_muscles === 'string' ? row.target_muscles.toLowerCase() : JSON.stringify(row?.target_muscles ?? '').toLowerCase();
          let s = 0;
          for (const f of focusHints) {
            if (pm.includes(f)) s += 2;
            if (tm.includes(f)) s += 1;
          }
          return s;
        };
        const pool = uniqByName((data ?? []).map(r => ({ name: r.name, row: r })))
          .filter(r => !isDup(r.name));
        pool.sort((a, b) => score(b.row) - score(a.row));
        shuffleInPlace(pool);
        for (const p of pool) {
          cooldownDraft.push({ name: p.name, duration: '30–60s' });
          if (cooldownDraft.length >= 6) break;
        }
        cooldownDraft = uniqByName(cooldownDraft).slice(0, 6);
        // ensure at least 3
        while (cooldownDraft.length < 3) {
          const fillers = ['Breathing — 90/90', 'Child\'s Pose', 'Couch Stretch'];
          const pick = fillers.find(f => !isDup(f) && !cooldownDraft.some(c => _norm(c.name) === _norm(f)));
          if (!pick) break;
          cooldownDraft.push({ name: pick, duration: '30–60s' });
        }
      }

      // 7) Build final plan
      const plan = {
        split: seed.split,
        duration: seed.duration,
        phases: [
          { phase: 'warmup', items: warmupItems },
          seed.phases[1], // strength with locked main
          { phase: 'accessory', items: accessoryItems },
          { phase: 'cooldown', items: cooldownDraft },
        ],
      };

      // Also expose cooldown to workout payload so UI can render it directly
      const workout = {
        warmup: warmupItems,
        mainExercises: seed.phases[1].items,
        finisher: null as any,
        cooldown: cooldownDraft,
      };

      const out = {
        ok: true,
        message: `${_label(splitInput)} — Day`,
        plan,
        workout,
        coach: clampCoach(llm?.coach),
      };
      return NextResponse.json(out, { status: 200 });
    }
    // ---------- end HYBRID SPLIT v2 ----------
    const equipment =
      Array.isArray(body.equipment) && body.equipment.length
        ? body.equipment
        : (userId ? await fetchUserEquipmentNames(userId) : []);
    dpush(debug, 'equipment', { final: equipment, count: equipment.length });

    // 1a) Get user preferences and learn from messages
    const prefs = await getUserPrefs(userId);

    // --- QA guard: equipment/gear question -> concise TL;DR + bullets + verdict, early return ---
    const latestMsg = [...(body.messages||[])].reverse().find(m => m.role==='user')?.content || '';
    const looksLikeGearQA =
      /\?/.test(latestMsg) &&
      /\b(attachment|worth|buy|purchase|recommend|upgrade|brand|model|equipment|barbell|dumbbell|kettlebell|rack|bench|machine|landmine|t[-\s]?bar|row\s*attachment|t[-\s]?bar\s*row|lat\s*pulldown|cable\s*attachment)\b/i.test(latestMsg);
    if (looksLikeGearQA) {
      const qaSys =
        'You are a concise strength coach. Return STRICT JSON ONLY in this schema:\n' +
        '{ "tldr": string, "bullets": [string, string], "verdict": string }\n' +
        'Rules: tldr ≤ 140 chars. Each bullet ≤ 120 chars. verdict ≤ 120 chars and MUST start with "Verdict: ". No extra fields, no prose.';
      const qaUser = { question: latestMsg, equipment: Array.isArray(body?.equipment) ? body.equipment : [] };
      const qa = await claudeJSON(qaSys, qaUser);

      const clamp = (s: string, max = 140) => {
        const t = (s || '').trim().replace(/\s+/g, ' ');
        return t.length > max ? `${t.slice(0, max - 1)}…` : t;
      };

      const tldr =
        typeof (qa as any)?.tldr === 'string' && (qa as any).tldr.trim()
          ? clamp((qa as any).tldr.trim(), 140)
          : 'You can mimic T-bar rows with a landmine/barbell; the attachment mainly adds comfort and a fixed path.';

      const rawBullets = Array.isArray((qa as any)?.bullets) ? (qa as any).bullets : [];
      const b1 = typeof rawBullets[0] === 'string' && rawBullets[0].trim()
        ? clamp(rawBullets[0].trim(), 120)
        : 'Pros: stable arc for heavy rows; feels good on wrists/low back for many lifters.';
      const b2 = typeof rawBullets[1] === 'string' && rawBullets[1].trim()
        ? clamp(rawBullets[1].trim(), 120)
        : 'Cons: single-purpose; similar stimulus with landmine/barbell you likely already own.';

      const verdictRaw =
        typeof (qa as any)?.verdict === 'string' && (qa as any).verdict.trim()
          ? (qa as any).verdict.trim()
          : 'Verdict: Buy if you row often and want the comfort; otherwise skip—your current setup covers it.';
      const verdict = verdictRaw.startsWith('Verdict:') ? clamp(verdictRaw, 120) : clamp(`Verdict: ${verdictRaw}`, 120);

      const answer = `TL;DR: ${tldr}\n• ${b1}\n• ${b2}\n${verdict}`;

      const payload: any = {
        ok: true,
        name: 'Coach Q&A',
        message: answer,           // keep UI text concise & formatted
        coach: answer,             // mirror in coach so nothing overwrites it
        plan: { split: 'qa', duration: 0, name: 'Coach Q&A', main_lift: '', phases: [] }, // no phases for QA
        workout: { warmup: [], mainExercises: [], finisher: null },                        // empty workout
      };
      if (wantDebug(req, body)) {
        payload.debug = {
          ...(payload.debug || {}),
          qa: { asked: latestMsg, tldrLen: tldr.length, bullets: [b1, b2], verdict, answerLen: answer.length }
        };
      }
      return NextResponse.json(payload, { status: 200 });
    }
    
    // Quick preference extraction from the last user message
    const lastUserMsg = Array.isArray(body.messages) ? [...body.messages].reverse().find(m => m.role === 'user')?.content || '' : '';
    if (/\b(no|don't|never)\b.*cool[-\s]?down.*\b(burpee|hiit|sprint|jump|thruster|climber)\b/i.test(lastUserMsg)) {
      await mergeUserPrefs(userId, { cooldown: 'stretch_only', banned_exercises: ['burpee'] });
      prefs.cooldown = 'stretch_only';
      prefs.banned_exercises = Array.from(new Set([...(prefs.banned_exercises || []), 'burpee']));
    }
    if (/\b(prefer|want).*(stretch|mobility).*(cool[-\s]?down)/i.test(lastUserMsg)) {
      await mergeUserPrefs(userId, { cooldown: 'stretch_priority' });
      prefs.cooldown = 'stretch_priority';
    }

    // 2) classify intent (you already do this); set split/minutes/style
    const classifierSystem =
`Extract intent for workout planning. Return STRICT JSON only:
{"split":"pull|push|legs|upper|full|hiit","minutes":number,"style":"default|ocho"}.
If "hints" are provided (from a prior TL;DR answer), choose the split that best matches them (e.g., ski -> legs/full bias with quad/core/balance).
If unclear, default to {"split":"pull","minutes":45,"style":"default"}.`;

    const lastUser = [...(body.messages||[])].reverse().find(m => m.role==='user')?.content || '';
    if (!lastUser || lastUser.trim().length < 2) {
      if (dbg) dpush(debug, 'lastUser', lastUser);
      return NextResponse.json(
        { ok: false, error: 'Missing user message in body.messages[]. Provide messages:[{role:"user",content:"..."}].', ...(dbg ? { debug } : {}) },
        { status: 400 }
      );
    }
    const intents = await timedClaudeJSON('classifier', classifierSystem, { 
      text: lastUser, 
      provided: { split: body.split, minutes: body.minutes, style: body.style },
      hints: qaHintsText || ''
    }, { temperature: 0.2, max_tokens: 120 });

    const split: Split = (body.split || intents?.split || 'pull') as Split;
    const minutes = Number(body.minutes || intents?.minutes || 45);
    const style = (body.style || intents?.style || 'default') as 'default'|'ocho';
    const time = budget(minutes);
    dpush(debug, 'classified', { split, minutes, style });

    if (PROGRAMS_ENABLED) {
      // TODO: Implement program/intent routing when enabled
      // detectIntent, getOrCreateProgram, generateProgrammedWorkout
    } else {
      // --- OLD SPLIT FLOW ---
    const catalog = await fetchCatalog(split, equipment);
    dpush(debug, 'catalog', { count: catalog.length, sample: catalog.slice(0, 8).map(r => r.name) });

    // Optional: fallback if catalog too small
    if (catalog.length < 10) {
      dpush(debug, 'catalogFallback', 'split filter too narrow; using equipment-only catalog');
      // For now, we'll keep the current catalog but log the fallback
      // In the future, you could modify getCatalog to accept a flag for equipment-only filtering
    }

    // 4) Fetch user history for the main lift (if we can predict it)
    const predictedMainLift = split === 'pull' ? 'Trap Bar Deadlift' : 
                              split === 'push' ? 'Barbell Bench Press' : 
                              split === 'legs' ? 'Back Squat' : 
                              split === 'upper' ? 'Shoulder Press' : 
                              'Trap Bar Deadlift';
    
    const recentSets = await fetchRecentSetsForExercise(userId, predictedMainLift, 6);
    const history = summarizeHistory(recentSets);
    
    const historyForPrompt = recentSets.slice(0, 6).map(s => ({
      date: s.date?.slice(0,10),
      exercise: s.exercise_name,
      weight: s.actual_weight,
      reps: s.reps,
      rpe: s.rpe,
    }));

    // 5) Ask the LLM to PLAN everything using only your catalog/equipment
    const policy = `
Rules for cooldown:
- Use 2–4 low-intensity stretches or mobility positions ONLY (static or dynamic).
- Absolutely do NOT include high-intensity movements (no burpees, sprints, thrusters, box jumps, mountain climbers, jumping jacks).
- Prefer stretches that target the muscles used in the session.
${prefs.cooldown === 'stretch_only' ? '- Cooldown must be stretches/mobility exclusively.' : ''}
`;

    const system =
`You are TrainAI, a concise strength coach.
User equipment: ${(body?.equipment || []).join(', ') || 'bodyweight only'}.
Focus on progressive overload with excellent form. Keep cooldown low-intensity mobility (no HIIT).
Recent main-lift history for context (most recent first): ${JSON.stringify(historyForPrompt)}

Compose a complete ${split.toUpperCase()} workout as STRICT JSON only—no commentary.

Constraints
- Use ONLY exercises present in the provided "catalog" (by name) and that are possible with the provided "equipment". If an exercise needs unavailable equipment, pick another from the catalog.
- Warm-up must be ${time.warmup} minutes (5–10 min window) and MUST include scap/shoulder prep AND thoracic rotation or anti-rotation.
- Choose ONE main lift that suits the split and equipment; make it the first item of "workout.mainExercises" with {"isAccessory":false}. All other main items are accessories with {"isAccessory":true}.
- Fit within minutes: warmup ${time.warmup}, main ${time.main}, accessories ${time.accessories}, cooldown ${time.cooldown}.
- Style: ${style === 'ocho'
    ? 'Joe Holder Ocho style — include crawling/ground-based core, tempo OR isometric cues on at least one accessory, pair accessories with breath/mobility resets when helpful, and prefer carries or sled work if equipment allows.'
    : 'Evidence-based general strength style.'}
- Keep instructions concise.
${/\bski|skiing|snow(board|)\b/i.test(lastUser) ? `
- Since the latest message mentions skiing/snow sports, bias accessories toward: eccentric quads (e.g., step-downs, tempo squats), glute power, core stability/balance, and knee-friendly patterns. Minimize heavy hip-hinge volume today.` : ''}

${policy}

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

    // Infer targets from split and user message for cooldown targeting
    function inferTargetsFromSplit(split: string, userMessage: string): string[] {
      const splitKey = String(split).toLowerCase();
      const splitTargets: Record<string,string[]> = {
        legs: ['hamstring','quad','glute','calf','hip flexor','thoracic'],
        pull: ['lat','upper back','biceps','thoracic'],
        push: ['pec','shoulder','triceps','thoracic'],
        upper:['pec','shoulder','triceps','lat','upper back','biceps','thoracic'],
        full: ['hamstring','quad','glute','hip flexor','lat','upper back','pec','shoulder','triceps','biceps','thoracic'],
        hiit: ['hip flexor','hamstring','quad','calf','thoracic'],
      };
      
      const baseTargets = splitTargets[splitKey] || ['thoracic'];
      
      // Also infer from user message if they mention specific exercises
      const messageTargets: string[] = [];
      const msg = userMessage.toLowerCase();
      if (/(rdl|hamstring|leg\s*curl|good\s*morning)/i.test(msg)) messageTargets.push('hamstring');
      if (/(quad|squat|split\s*squat|front\s*squat|lunge|leg\s*press)/i.test(msg)) messageTargets.push('quad');
      if (/(glute|hip\s*thrust|bridge|hip\s*extension|step-?up)/i.test(msg)) messageTargets.push('glute');
      if (/(calf|gastroc|soleus)/i.test(msg)) messageTargets.push('calf');
      if (/(hip\s*flex|psoas|adductor|abductor|groin)/i.test(msg)) messageTargets.push('hip flexor');
      if (/(lat|pull-?down|row|pull-?up|chin-?up|rack\s*pull|deadlift|trap\s*bar)/i.test(msg)) messageTargets.push('lat', 'upper back');
      if (/(rear\s*delt|face\s*pull|band\s*pull-?apart|shrug|trap)/i.test(msg)) messageTargets.push('upper back');
      if (/(bench|press|push-?up|fly|dip|pec)/i.test(msg)) messageTargets.push('pec', 'shoulder');
      if (/(ohp|overhead|military|shoulder\s*press|lateral|front\s*raise)/i.test(msg)) messageTargets.push('shoulder');
      if (/(tricep|pushdown|skull-?crusher|dip)/i.test(msg)) messageTargets.push('triceps');
      if (/(bicep|curl|chin-?up)/i.test(msg)) messageTargets.push('biceps');
      
      return Array.from(new Set([...baseTargets, ...messageTargets]));
    }

    const targets = inferTargetsFromSplit(split, lastUser);
    
    // Fetch mobility options for cooldown targeting
    const { byTarget, all: allMobility } = await fetchMobilityByTargets(targets);

    // Build a compact options block the LLM can choose from
    const TARGET_OPTIONS = targets.map(t => {
      const list = (byTarget[t.toLowerCase()] || []).slice(0, 12); // keep prompt short
      return `- ${t}: ${list.join(', ')}`;
    }).join('\n');

    const systemCoach = [
      'You are a strength coach. Return strict JSON for the workout.',
      'Cooldown rules:',
      '• Choose 2–3 items.',
      '• Only stretching/mobility/breathing—not strength or cardio.',
      '• Must match the day\'s target muscles (see TARGETS below).',
      '• Prefer options listed under each target. If empty, pick general t-spine/breathing.',
      '• Each cooldown item has { name, duration: "45–60s" }, no reps/sets.',
      '• Do NOT include pec/chest stretches on legs day, or non-target muscles.',
      '',
      `Hints (use these to bias priorities, exercise choices, and energy systems; do NOT echo them back):`,
      `${qaHintsText ? qaHintsText : '(none)'}`,
    ].join('\n');

    const user = {
      minutes, split, style, budget: time,
      equipment,
      catalog,            // ← your DB exercises
      history: body.messages || [],
      hints: qaHintsText || '',
    };

    // Build messages
    const messages = [
      { role: 'system', content: systemCoach },
      { role: 'user', content: JSON.stringify(user) }
    ];

    let out = await timedClaudeJSON('plan', system, user, { temperature: 0.6, max_tokens: 1200 });

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
      out = await timedClaudeJSON(
        'repair',
        system + '\nYour previous JSON omitted "workout.mainExercises". Repair it using only names from "catalog".',
        { previous: out, equipment, catalog, split, minutes, style },
        { temperature: 0.3, max_tokens: 600 }
      );
      ({ workout } = normalizeLLM(out));
      dpush(debug, 'secondPass', {
        warm: Array.isArray(workout?.warmup) ? workout.warmup.length : 0,
        main: Array.isArray(workout?.mainExercises) ? workout.mainExercises.length : 0,
      });
    }

    // Derive plan & phases for your UI with proper main lift and naming
    const mainLift = mainLiftForSplit(split, equipment) || workout?.mainExercises?.[0]?.name || '';
    
    // Ensure the main lift is the first item in strength phase
    if (mainLift && (!workout.mainExercises?.[0] || workout.mainExercises[0].name !== mainLift)) {
      const mainLiftItem = {
        name: mainLift,
        sets: 3,
        reps: '5-8',
        isAccessory: false,
        instruction: 'Focus on form and progressive overload'
      };
      workout.mainExercises = [mainLiftItem, ...(workout.mainExercises || [])];
    }

    // Ensure ≥ 2 accessories (1 main + 2 accessories minimum)
    try {
      const desiredMinTotal = 3;
      if (!Array.isArray(workout.mainExercises)) workout.mainExercises = [];
      const existingNames = new Set<string>(workout.mainExercises.map((i:any) => norm(i?.name)));
      if (workout.mainExercises.length < desiredMinTotal) {
        const pool = await fetchAccessoryPoolBySplit(userId, split, equipment, 40);
        for (const p of pool) {
          const n = norm(p.name);
          if (!n || existingNames.has(n) || (mainLift && n === norm(mainLift))) continue;
          workout.mainExercises.push({ name: p.name, sets: '3', reps: '8–12', isAccessory: true });
          existingNames.add(n);
          if (workout.mainExercises.length >= desiredMinTotal) break;
        }
      }
    } catch {
      // last resort bodyweight
      while (Array.isArray(workout.mainExercises) && workout.mainExercises.length < 3) {
        workout.mainExercises.push({ name: 'Plank', sets: '2', reps: '30–45s', isAccessory: true });
      }
    }

    // Generate proper plan name with day counter
    const dayCounter = Math.floor(Math.random() * 100) + 1; // Simple random day number
    const planName = `${split.charAt(0).toUpperCase() + split.slice(1)} — Day ${dayCounter}`;
    
    const plan = {
      split,
      duration: minutes,
      name: planName,
      main_lift: mainLift,
      phases: [
        { phase:'prep', items: workout.warmup },
        { phase:'strength', items: workout.mainExercises },
        { phase:'activation', items: [] },
        { phase:'carry', items: workout.finisher ? [workout.finisher] : [] },
      ],
    };

    // --- Cooldown builder with diagnostics ---
    async function buildCooldownPhase(out: any, req: Request, userId: string, prefs: any, targets: any) {
    const phases = (Array.isArray(out?.plan?.phases) ? out.plan.phases : []) as PlanPhase[];

      // Names already in session (avoid dupes)
    const sessionNames = new Set<string>();
    for (const ph of phases) {
      for (const it of ph.items ?? []) {
          if (it?.name) sessionNames.add(norm(it.name));
        }
      }

      const focusHints = focusFromSplit(out?.plan?.split);
      const { rankedCandidates, allCandidates, recentNames } = await fetchCooldownContext({
        focusHints,
        sampleLimit: 250,
        recentDays: 7,
        userId,
      });

      // Also exclude cooldowns actually used in the user's recent saved workouts
      const recentCooldownFromWorkouts = await fetchRecentCooldownNamesFromWorkouts(userId, 7);

      // --- diagnostics (server logs) ---
      const peek = (arr: { name: string }[], n = 8) => arr.slice(0, n).map((x) => x.name).join(', ');
      console.log('[cooldown] focusHints=', focusHints);
      console.log('[cooldown] rankedCandidates=', rankedCandidates.length, 'eg:', peek(rankedCandidates));
      console.log('[cooldown] allCandidates=', allCandidates.length, 'eg:', peek(allCandidates));
      console.log('[cooldown] recentNames size=', recentNames.size, 'recentCooldownFromWorkouts size=', recentCooldownFromWorkouts.size);

      // Ask LLM (your helper) for suggestions
      const sys =
        'You are a strength coach. Propose varied, safe cooldown stretches/mobility matching today\'s focus. ' +
        'Use the DB list as inspiration BUT you may also propose new items from your knowledge. ' +
        'Avoid RECENT_COOLDOWNS and avoid duplicates with existing session items. Prefer 3–6 items. STRICT JSON only.';
      const user =
        `FOCUS_HINTS=${JSON.stringify(focusHints)}\n` +
        `DB_CANDIDATES=${JSON.stringify(rankedCandidates)}\n` +
        `RECENT_COOLDOWNS=${JSON.stringify(Array.from(recentNames))}\n\n` +
        `Respond as:\n` +
        `{"items":[{"name":"...", "duration":"30–60s", "reps":"optional", "instruction":"optional"}]}`;

      // @ts-ignore replace with your real JSON chat helper
      const raw = await timedClaudeJSON('cooldown', sys, user, { temperature: 0.7, max_tokens: 600 });

      const parsed = ((): { items: { name: string; duration?: string; reps?: string; instruction?: string }[] } | null => {
        if (!raw || typeof raw !== 'object') return null;
        const r = raw as Record<string, unknown>;
        const items = Array.isArray(r.items) ? r.items : null;
        if (!items) return null;
        const clean = items
          .map((x) => (x && typeof x === 'object' ? x : null))
          .filter(Boolean)
          .map((x) => {
            const it = x as Record<string, unknown>;
            const name = typeof it.name === 'string' ? it.name.trim() : '';
            if (!name) return null;
            return {
              name,
              duration: typeof it.duration === 'string' ? it.duration : '30–60s',
              reps: typeof it.reps === 'string' ? it.reps : undefined,
              instruction: typeof it.instruction === 'string' ? it.instruction : '',
            };
          })
          .filter(Boolean) as { name: string; duration?: string; reps?: string; instruction?: string }[];
        return { items: clean };
      })();

      let picks = mapLLMToPlanItems(parsed?.items ?? []);

      // --- guardrail: no repeats (session + recent), then top-up from ranked, then from all ---
      const exclude = new Set<string>([
        ...sessionNames,
        ...recentNames,
        ...recentCooldownFromWorkouts,
      ]);
      const seen = new Set<string>();
      const outItems: PlanItem[] = [];

      const pushIfOk = (it: { name: string; duration?: string; reps?: string; instruction?: string }) => {
        const k = norm(it.name);
        if (!k || exclude.has(k) || seen.has(k)) return;
        seen.add(k);
        outItems.push({
          name: it.name,
          duration: it.duration ?? '30–60s',
          reps: it.reps,
          instruction: it.instruction ?? '',
        });
      };

      // 1) keep valid LLM picks
      for (const p of picks) pushIfOk(p);

      // 2) top-up from ranked if needed
      if (outItems.length < 3) {
        const fillers = rankedCandidates.filter((c) => {
          const k = norm(c.name);
          return k && !exclude.has(k) && !seen.has(k);
        });
        shuffleInPlace(fillers);
        for (const f of fillers) {
          pushIfOk({ name: f.name, duration: '30–60s' });
          if (outItems.length >= 3) break;
        }
      }

      // 3) last-resort top-up from all candidates
      if (outItems.length < 3) {
        const any = allCandidates.filter((c) => {
          const k = norm(c.name);
          return k && !exclude.has(k) && !seen.has(k);
        });
        shuffleInPlace(any);
        for (const f of any) {
          pushIfOk({ name: f.name, duration: '30–60s' });
          if (outItems.length >= 3) break;
        }
      }

      // Trim to max 6
      if (outItems.length > 6) outItems.length = 6;

      // 4) Guarantee at least 3 with safe general mobility if still short
      if (outItems.length < 3) {
        const safeFillers = [
          "Breathing — 90/90",
          "Thread the Needle",
          "Child's Pose", 
          "T-Spine Openers",
          "Couch Stretch",
          "Lat Stretch Against Wall",
          "Figure-4 Glute Stretch",
          "Seated Hamstring Stretch",
          "Hip Flexor Stretch",
          "Calf Wall Stretch",
          "Doorway Pec Stretch",
          "World's Greatest Stretch",
          "Pigeon Pose",
          "Butterfly Stretch",
          "Cat-Cow Stretch",
          "Downward Dog",
          "Cobra Stretch",
          "Bridge Pose",
          "Happy Baby Pose",
          "Reclined Twist",
          "Standing Forward Fold",
          "Warrior I Stretch",
          "Triangle Pose",
          "Side Angle Stretch",
          "Eagle Arms",
          "Shoulder Rolls",
          "Neck Stretches",
          "Wrist Stretches",
          "Ankle Circles",
          "Hip Circles"
        ];
        // Randomize the order to prevent same sequence
        shuffleInPlace(safeFillers);
        for (const name of safeFillers) {
          if (outItems.length >= 3) break;
          const k = norm(name);
          if (!k || exclude.has(k) || seen.has(k)) continue;
          seen.add(k);
          outItems.push({ name, duration: '30–60s' });
        }
      }

      // 4) Sanitize with prefs/targets — clamp only; keep variety if valid
      const holder = { cooldown: outItems };
      try {
        await sanitizeCooldown(holder, userId || '', prefs, targets || []);
      } catch (e) {
        console.warn('[cooldown] sanitize failed; using pre-sanitize items', e);
      }
      const finalItems = Array.isArray(holder.cooldown) && holder.cooldown.length ? holder.cooldown : outItems;

      console.log('[cooldown] final picks=', finalItems.map((x) => x.name));

      // Write into phases (place this near the END of your route so nothing overwrites it later)
      const cdIdx = phases.findIndex((p) => (p.phase ?? '').toLowerCase() === 'cooldown');
      if (cdIdx >= 0) phases[cdIdx].items = finalItems;
      else phases.push({ phase: 'cooldown', items: finalItems });

      out.plan.phases = phases;
      
      // Also surface to workout for UI consumers that ignore plan.phases
      if (!out.workout) out.workout = {};
      (out.workout as any).cooldown = finalItems;
    }

    // --- In your main handler, AFTER you build the rest of the plan, call:
    // Important: pass a holder that references the REAL plan object so mutations land in the response.
    await buildCooldownPhase({ plan }, req, userId, prefs, targets);

    // Mirror cooldown into workout.cooldown for legacy UI readers
    {
      const cd = plan.phases.find((p: any) => (p?.phase || '').toLowerCase() === 'cooldown');
      if (cd) (workout as any).cooldown = cd.items;
    }

    // debug so you can confirm in DevTools (read from plan, not out.plan)
    {
      const cd = plan.phases.find((p: any) => (p?.phase || '').toLowerCase() === 'cooldown');
      debug.cooldown = {
        targets,
        focusHints: focusFromSplit(plan?.split),
        finalCooldown: (cd?.items || []).map((i: any) => i?.name).filter(Boolean),
      };
    }

    // which split/minutes & main lift did we end up with?
    const splitOut: string =
      (plan as any)?.split || body?.split || 'full';
    const minutesOut: number =
      Number((plan as any)?.duration ?? body?.minutes ?? 45);

    // prefer explicit field, else first main exercise
    const mainLiftName: string =
      (plan as any)?.main_lift ||
      workout?.mainExercises?.[0]?.name ||
      (workout as any)?.main?.[0]?.name ||
      'Main Lift';

    // fetch recent history for that lift (avoid name collision)
    const recentMainSets = mainLiftName ? await fetchRecentSetsForExercise(userId, mainLiftName, 12) : [];
    const hist = summarizeHistory(recentMainSets);

    // compose a smart coach message (workout mode)
    const smartCoach = buildCoachNote({
      split: splitOut,
      minutes: minutesOut,
      mainLift: mainLiftName,
      history: hist,
      equipment: Array.isArray(body?.equipment) ? body.equipment : [],
      prefs,
    });
    if (plan) (plan as any).coach = smartCoach;
    const coach = smartCoach;

    // Final payload
    const payload = {
      ok: true,
      name: plan.name,            // keep steady, avoid hype names from LLM
      message: plan.name,         // short, deterministic
      coach,                      // already concise via buildCoachNote
      plan,
      workout,
    };
    if (dbg) (payload as any).debug = debug;
    return NextResponse.json(payload, { status: 200 });
    }
  } catch (err:any) {
    console.error('api/chat fatal', err?.stack || err);
    return J(200, { ok:false, error: err?.message || 'Internal server error' });
  }
}
