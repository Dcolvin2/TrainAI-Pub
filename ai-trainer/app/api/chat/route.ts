// app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
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

    // 1) ensure we know the user & equipment
    const equipment =
      Array.isArray(body.equipment) && body.equipment.length
        ? body.equipment
        : (userId ? await fetchUserEquipmentNames(userId) : []);
    dpush(debug, 'equipment', { final: equipment, count: equipment.length });

    // 1a) Get user preferences and learn from messages
    const prefs = await getUserPrefs(userId);
    
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
    ].join('\n');

    const user = {
      minutes, split, style, budget: time,
      equipment,
      catalog,            // ← your DB exercises
      history: body.messages || [],
    };

    // Build messages
    const messages = [
      { role: 'system', content: systemCoach },
      { role: 'user', content: JSON.stringify(user) }
    ];

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
    async function buildCooldownPhase(out: any, req: Request) {
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
        sampleLimit: 150,
        recentDays: 14,
      });

      // --- diagnostics (server logs) ---
      const peek = (arr: { name: string }[], n = 8) => arr.slice(0, n).map((x) => x.name).join(', ');
      console.log('[cooldown] focusHints=', focusHints);
      console.log('[cooldown] rankedCandidates=', rankedCandidates.length, 'eg:', peek(rankedCandidates));
      console.log('[cooldown] allCandidates=', allCandidates.length, 'eg:', peek(allCandidates));
      console.log('[cooldown] recentNames size=', recentNames.size);

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
      const raw = await claudeJSON(sys, user);

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
      const exclude = new Set<string>([...sessionNames, ...recentNames]);
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

      console.log('[cooldown] final picks=', outItems.map((x) => x.name));

      // Write into phases (place this near the END of your route so nothing overwrites it later)
      const cdIdx = phases.findIndex((p) => (p.phase ?? '').toLowerCase() === 'cooldown');
      if (cdIdx >= 0) phases[cdIdx].items = outItems;
      else phases.push({ phase: 'cooldown', items: outItems });

      out.plan.phases = phases;
    }

    // --- In your main handler, AFTER you build the rest of the plan, call:
    await buildCooldownPhase(out, req);

    // debug so you can confirm in DevTools
    debug.cooldown = {
      targets,
      focusHints: focusFromSplit(out?.plan?.split),
      finalCooldown: out?.plan?.phases?.find((p: any) => p?.phase?.toLowerCase() === 'cooldown')?.items?.map((i: any) => i?.name).filter(Boolean) || [],
    };

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

    // compose a smart coach message
    const smartCoach = buildCoachNote({
      split: splitOut,
      minutes: minutesOut,
      mainLift: mainLiftName,
      history: hist,
      equipment: Array.isArray(body?.equipment) ? body.equipment : [],
      prefs,
    });

    // attach/override coach text (return this field)
    if (plan) (plan as any).coach = smartCoach;
    const coach = smartCoach;

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
    }
  } catch (err:any) {
    console.error('api/chat fatal', err?.stack || err);
    return J(200, { ok:false, error: err?.message || 'Internal server error' });
  }
}
