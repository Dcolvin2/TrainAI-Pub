// app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { claudeJSON } from '@/lib/llm';
import { focusFromSplit, fetchCooldownContext, mapLLMToPlanItems, shuffleInPlace } from '@/lib/cooldown';
import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Intent detection types
type Intent = 'start_program' | 'continue_program' | 'ad_hoc';
type IntentPayload = { intent: Intent; programName?: string; durationMin?: number };

// Program management types
type ProgramRow = { id: string; program_name: string; status: string; current_week: number; current_day: number };
type PastWorkout = { id: string; date: string; main_lift: string | null; workout_type: string | null; cooldown: unknown; accessory_lifts: unknown; duration_minutes: number | null };
type Profile = { preferred_workout_duration: number; fitness_level: string | null; injuries: unknown; equipment: string | null; training_goal: string | null };

// LLM crafted workout type
type LLMCrafted = {
  name: string;
  duration: number;
  phases: { phase: string; items: any[] }[];
  coach: string;
};

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

// Intent detection function
async function detectIntent(userMsg: string): Promise<IntentPayload> {
  const sys =
    'Classify the user message.\n' +
    '- start_program: starting a named training program (infer concise programName like "Ski Prep").\n' +
    '- continue_program: user wants next day of a previously named program (infer same programName).\n' +
    '- ad_hoc: not a multi-day program; just generate a single workout.\n' +
    'Return STRICT JSON: {"intent":"start_program|continue_program|ad_hoc","programName":string|undefined,"durationMin":number|undefined}.';
  const usr = `MESSAGE=${JSON.stringify(userMsg)}\nProvide only the JSON.`;

  // @ts-ignore replace with your JSON helper
  const raw = await claudeJSON(sys, usr);
  const o = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {};
  return {
    intent: (o.intent === 'start_program' || o.intent === 'continue_program' || o.intent === 'ad_hoc') ? o.intent : 'ad_hoc',
    programName: typeof o.programName === 'string' && o.programName.trim() ? o.programName.trim() : undefined,
    durationMin: typeof o.durationMin === 'number' ? o.durationMin : undefined,
  };
}

// Program management helpers
async function getOrCreateProgram(userId: string, programName: string): Promise<ProgramRow> {
  const { data: existing } = await supabase
    .from('training_programs')
    .select('id, program_name, status, current_week, current_day')
    .eq('user_id', userId)
    .eq('program_name', programName)
    .limit(1)
    .maybeSingle();

  if (existing) return existing as ProgramRow;

  const { data, error } = await supabase
    .from('training_programs')
    .insert([{ user_id: userId, program_name: programName, status: 'active' }])
    .select('id, program_name, status, current_week, current_day')
    .single();
  if (error) throw error;
  return data as ProgramRow;
}

async function getRecentProgramWorkouts(userId: string, programName: string, limit = 3): Promise<PastWorkout[]> {
  const { data, error } = await supabase
    .from('workouts')
    .select('id, date, main_lift, workout_type, cooldown, accessory_lifts, duration_minutes')
    .eq('user_id', userId)
    .eq('program_name', programName)
    .order('date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as PastWorkout[];
}

async function getProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('preferred_workout_duration, fitness_level, injuries, equipment, training_goal')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? { preferred_workout_duration: 45 }) as Profile;
}

// LLM-first workout generation
async function generateProgrammedWorkout({
  userMsg, programName, durationMin, profile, equipmentList, recent
}: {
  userMsg: string;
  programName: string;
  durationMin?: number;
  profile: { preferred_workout_duration?: number; fitness_level?: string | null; injuries?: unknown; equipment?: string | null; training_goal?: string | null };
  equipmentList: string[];
  recent: any[];
}): Promise<LLMCrafted> {
  const d = durationMin ?? profile.preferred_workout_duration ?? 45;

  const system =
    'You are a world-class strength coach.\n' +
    `Program focus: ${programName}. Design TODAY's session end-to-end in JSON.\n` +
    'Rules:\n' +
    '- Do NOT default to generic splits (push/pull/legs/upper) unless the user asked specifically.\n' +
    '- Use the user profile, injuries, equipment, and recent program days to progress intelligently.\n' +
    '- Respect available equipment only.\n' +
    '- Output STRICT JSON only; no commentary, no code fences.';

  const user =
    `PROGRAM_NAME=${JSON.stringify(programName)}\n` +
    `TODAY_MINUTES=${d}\n` +
    `PROFILE=${JSON.stringify(profile)}\n` +
    `EQUIPMENT=${JSON.stringify(equipmentList)}\n` +
    `RECENT_PROGRAM_WORKOUTS=${JSON.stringify(recent)}\n` +
    `USER_MESSAGE=${JSON.stringify(userMsg)}\n\n` +
    `Respond exactly as:\n` +
    `{\n` +
    `  "name": "${programName} — Day X",\n` +
    `  "duration": ${d},\n` +
    `  "phases": [\n` +
    `    {"phase":"warmup","items":[{"name":"...", "duration":"...","instruction":"..."}]},\n` +
    `    {"phase":"strength","items":[{"name":"...", "sets":"...", "reps":"...", "instruction":"..."}]},\n` +
    `    {"phase":"accessory","items":[{"name":"...", "sets":"...", "reps":"..."}]},\n` +
    `    {"phase":"cooldown","items":[{"name":"...", "duration":"30–60s"}]}\n` +
    `  ],\n` +
    `  "coach":"One-paragraph coaching cues tailored to ${programName} and today's plan."\n` +
    `}`;

  // @ts-ignore replace with your JSON helper
  const raw = await claudeJSON(system, user);

  // minimal shape-check
  const plan = (raw && typeof raw === 'object') ? raw as LLMCrafted : { name: `${programName} — Day`, duration: d, phases: [], coach: '' };
  plan.duration = typeof plan.duration === 'number' ? plan.duration : d;
  plan.name = typeof plan.name === 'string' && plan.name ? plan.name : `${programName} — Day`;
  plan.phases = Array.isArray(plan.phases) ? plan.phases : [];
  return plan;
}

// Intent detection function



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

    // 2) Detect intent and handle program-based or ad-hoc requests
    const userMsg = Array.isArray(body.messages) ? [...body.messages].reverse().find(m => m.role === 'user')?.content || '' : '';
    const intent = await detectIntent(userMsg);
    
    dpush(debug, 'intent', { intent: intent.intent, programName: intent.programName, durationMin: intent.durationMin });

    // 3) Fetch profile, equipment, and program history
    const profile = await getProfile(userId);
    const equipmentList = (profile.equipment ? profile.equipment.split(',') : []).map(s => s.trim()).filter(Boolean);
    const programName = intent.programName ?? (intent.intent === 'ad_hoc' ? 'Ad Hoc' : 'General Program');
    const recent = await getRecentProgramWorkouts(userId, programName, 3);

    dpush(debug, 'context', { 
      programName, 
      equipmentCount: equipmentList.length, 
      recentWorkouts: recent.length,
      profileDuration: profile.preferred_workout_duration 
    });

    // 4) Generate workout using LLM-first approach
    const plan = await generateProgrammedWorkout({ 
      userMsg, 
      programName, 
      durationMin: intent.durationMin, 
      profile, 
      equipmentList, 
      recent 
    });

    // 5) Build output structure
    const out: any = { ok: true };
    out.plan = { 
      split: programName.toLowerCase(), 
      duration: plan.duration, 
      phases: plan.phases 
    };
    out.message = plan.name;
    out.coach = plan.coach;

    // 6) Optional: cooldown top-up if needed (using existing guardrails)
    const phases = Array.isArray(out?.plan?.phases) ? out.plan.phases : [];
    const cdIdx = phases.findIndex((p: any) => (p?.phase ?? '').toLowerCase() === 'cooldown');
    const cooldownItems = cdIdx >= 0 ? (phases[cdIdx].items ?? []) : [];

    if (cooldownItems.length < 3) {
      // Fallback: use existing cooldown system to top-up
      const focusHints = focusFromSplit(out?.plan?.split);
      const { rankedCandidates, recentNames } = await fetchCooldownContext({
        focusHints,
        sampleLimit: 150,
        recentDays: 14,
      });

      // Names already in session (avoid dupes)
      const sessionNames = new Set<string>();
      for (const ph of phases) {
        for (const it of ph.items ?? []) {
          if (it?.name) sessionNames.add(norm(it.name));
        }
      }

      // Top-up from ranked candidates
      const exclude = new Set<string>([...sessionNames, ...recentNames]);
      const seen = new Set<string>();
      const outItems: any[] = [...cooldownItems]; // Keep existing items

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

      // Top-up from ranked if needed
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

      // Update cooldown phase
      if (cdIdx >= 0) phases[cdIdx].items = outItems;
      else phases.push({ phase: 'cooldown', items: outItems });

      out.plan.phases = phases;
    }

    // 7) Save to workouts table
    const { data: saved } = await supabase
      .from('workouts')
      .insert([{
        user_id: userId,
        program_name: programName,
        workout_type: programName.toLowerCase().replace(/\s+/g, '_'),
        duration_minutes: out?.plan?.duration ?? 45,
        warmup: out?.plan?.phases?.find((p: any) => p.phase?.toLowerCase() === 'warmup')?.items ?? [],
        main_lifts: out?.plan?.phases?.find((p: any) => p.phase?.toLowerCase() === 'strength')?.items ?? [],
        accessory_lifts: out?.plan?.phases?.find((p: any) => p.phase?.toLowerCase() === 'accessory')?.items ?? [],
        cooldown: out?.plan?.phases?.find((p: any) => p.phase?.toLowerCase() === 'cooldown')?.items ?? [],
        notes: out?.coach ?? null,
        generated_by: 'claude',
      }])
      .select('id')
      .single();

    // 8) Build final response
    const payload = {
      ok: true,
      name: out?.message || plan.name,
      message: out?.message || plan.name,
      coach: out?.coach || plan.coach,
      plan: out?.plan,
      workout_id: saved?.id ?? null,
    };

    if (dbg) (payload as any).debug = debug;
    return NextResponse.json(payload, { status: 200 });
  } catch (err:any) {
    console.error('api/chat fatal', err?.stack || err);
    return J(200, { ok:false, error: err?.message || 'Internal server error' });
  }
}
