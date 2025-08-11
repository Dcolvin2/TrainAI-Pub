import { NextResponse } from 'next/server';
import { quickParse } from '@/lib/intent';
import { getEquipmentNamesForUser } from '@/lib/equipment';
import { planWorkout } from '@/lib/planner';

export const runtime = 'nodejs';

// --- Normalization + legacy shaping ---

type PlanItem = {
  name: string;
  sets?: string | number;
  reps?: string | number;
  duration?: string;
  instruction?: string;
  isAccessory?: boolean;
};

type PlanPhase =
  | { phase: 'warmup' | 'main' | 'accessory' | 'conditioning' | 'cooldown'; items: PlanItem[] };

type Plan = {
  name: string;
  duration_min?: number | string;
  phases: PlanPhase[];
  est_total_minutes?: number | string;
};

function coerceToString(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  return typeof v === 'number' ? String(v) : String(v);
}

// Accept numbers or strings from the model and normalize to strings
function normalizePlan(input: any) {
  const warnings: string[] = [];
  if (!input || typeof input !== 'object') {
    return { plan: null, warnings: ['LLM returned empty or non-object JSON'] };
  }

  const plan: Plan = {
    name: String(input.name ?? 'Workout'),
    duration_min: input.duration_min ?? input.est_total_minutes,
    phases: Array.isArray(input.phases) ? input.phases.map((p: any) => {
      const phase = String(p?.phase ?? '').toLowerCase();
      const allowed: PlanPhase['phase'][] = ['warmup','main','accessory','conditioning','cooldown'];
      const normalizedPhase = allowed.includes(phase as any) ? (phase as PlanPhase['phase']) : 'main';
      if (phase !== normalizedPhase) warnings.push(`Unknown phase "${phase}" → coerced to "main"`);

      const items: PlanItem[] = Array.isArray(p?.items) ? p.items.map((it: any) => ({
        name: String(it?.name ?? 'Exercise'),
        sets: coerceToString(it?.sets),
        reps: coerceToString(it?.reps),
        duration: it?.duration ? String(it.duration) : undefined,
        instruction: it?.instruction ? String(it.instruction) : undefined,
        isAccessory: Boolean(it?.isAccessory),
      })) : [];

      return { phase: normalizedPhase, items };
    }) : [],
    est_total_minutes: input.est_total_minutes ?? input.duration_min
  };

  // Require at least warmup/main/cooldown buckets to keep UI happy
  const ensurePhase = (k: PlanPhase['phase']) => {
    if (!plan.phases.some(ph => ph.phase === k)) plan.phases.push({ phase: k, items: [] });
  };
  ensurePhase('warmup'); ensurePhase('main'); ensurePhase('cooldown');

  return { plan, warnings };
}

// Convert normalized Plan → legacy workout shape your UI already renders
function toLegacyWorkout(plan: Plan) {
  const get = (k: PlanPhase['phase']) => plan.phases.find(p => p.phase === k)?.items ?? [];

  const warmup = get('warmup').map(it => ({
    name: it.name,
    sets: it.sets ?? '1',
    reps: it.reps ?? '10-15',
    instruction: it.instruction ?? ''
  }));

  const mainCore = get('main').map(it => ({
    name: it.name,
    sets: it.sets ?? '3',
    reps: it.reps ?? '8-12',
    instruction: it.instruction ?? '',
    isAccessory: false
  }));

  const accessories = get('accessory').map(it => ({
    name: it.name,
    sets: it.sets ?? '3',
    reps: it.reps ?? '10-15',
    instruction: it.instruction ?? '',
    isAccessory: true
  }));

  const cooldown = get('cooldown').map(it => ({
    name: it.name,
    duration: it.duration ?? (it.reps ? String(it.reps) : '30-60s'),
    instruction: it.instruction ?? ''
  }));

  // Conditioning can be folded after main core (optional)
  const conditioning = get('conditioning').map(it => ({
    name: it.name,
    sets: it.sets ?? '3',
    reps: it.reps ?? (it.duration ?? '30s'),
    instruction: it.instruction ?? '',
    isAccessory: true
  }));

  return {
    warmup,
    main: [...mainCore, ...accessories, ...conditioning],
    cooldown
  };
}

function pickUserId(req: Request): string | null {
  // Try query param first
  const url = new URL(req.url);
  const qs = url.searchParams.get('user');
  if (qs) return qs;

  // Try header
  const header = req.headers.get('x-user-id');
  if (header) return header;

  // Try body (for POST)
  try {
    const body = JSON.parse(req.body?.toString() || '{}');
    if (body.user) return body.user;
  } catch {}

  return null;
}

export async function POST(req: Request) {
  const userId = pickUserId(req);
  if (!userId) {
    return NextResponse.json({ 
      ok: false, 
      error: 'Missing ?user=<uuid> or x-user-id header or {user: "uuid"} in body' 
    }, { status: 400 });
  }

  try {
    const body = await req.json();
    const userMessage = body.q || body.message || '';

    // Parse user intent
    const intent = quickParse(userMessage);
    
    // Get user's equipment
    const equipment = await getEquipmentNamesForUser(userId);
    
    // Generate workout plan
    const { raw } = await planWorkout({
      userMsg: userMessage,
      equipment,
      duration: intent.duration_min || 45,
      modalityHints: intent.modality || 'mixed',
      styleHint: intent.athleteName ? `inspired by ${intent.athleteName}` : undefined
    });

    const aiText = String(raw ?? '');
    const debugOn = new URL(req.url).searchParams.get("debug") === "1";

    // Parse and normalize the LLM output
    let parsed: any;
    try {
      parsed = JSON.parse(aiText);
    } catch {
      // (Optional) attempt to extract the first {...} block if the model added chatter
      const m = aiText.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          parsed = JSON.parse(m[0]);
        } catch {
          parsed = null;
        }
      }
    }

    const { plan, warnings } = normalizePlan(parsed);
    if (!plan) {
      return NextResponse.json({
        ok: false,
        error: 'Planner JSON failed validation',
        details: warnings.join('; ') || 'could not normalize plan'
      }, { status: 400 });
    }

    // (Optional) enforce your "no oly lifts" rule at this layer too:
    const banned = /snatch|power\s*clean|clean\s*&?\s*jerk|jerk/i;
    plan.phases.forEach(ph => {
      ph.items = ph.items.filter(it => !banned.test(it.name));
    });

    // bridge to your existing UI shape
    const workout = toLegacyWorkout(plan);

    // Generate narrative if requested
    let narrative = '';
    const url = new URL(req.url);
    if (url.searchParams.get('narrate') === '1') {
      try {
        const { Anthropic } = await import('@anthropic-ai/sdk');
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        
        const response = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 300,
          messages: [{
            role: 'user',
            content: `Write a brief, motivating narrative for this workout plan. Keep it under 3 sentences and focus on the user's goals and the workout structure:\n\n${JSON.stringify(plan, null, 2)}`
          }]
        });
        
        narrative = response.content[0].type === 'text' ? response.content[0].text : '';
      } catch (narrateErr) {
        console.warn('Narrative generation failed:', narrateErr);
        // Continue without narrative
      }
    }

    // richer chat string:
    const title = plan.name || 'Planned Session';
    const minutes = String(plan.est_total_minutes ?? plan.duration_min ?? '').trim();
    const summary = `Planned: ${title}${minutes ? ` (~${minutes} min)` : ''}.
Warm-up: ${workout.warmup.map(i => i.name).join(', ') || '—'}
Main: ${workout.main.map(i => i.name).join(', ') || '—'}
Cooldown: ${workout.cooldown.map(i => i.name).join(', ') || '—'}`;

    // return both shapes to future-proof UI
    return NextResponse.json({
      ok: true,
      message: narrative || summary,
      plan,
      workout,
      narrative: narrative || undefined,
      debug: debugOn ? {
        validation_ok: true,
        warnings,
        raw_model_text: aiText
      } : undefined
    });

  } catch (error) {
    console.error('Workout generation error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: 'Failed to generate workout plan',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  
  if (url.searchParams.get('health') === '1') {
    return NextResponse.json({ 
      ok: true, 
      status: 'healthy',
      timestamp: new Date().toISOString()
    });
  }

  return NextResponse.json({ 
    ok: false, 
    error: 'Use POST with workout request or GET ?health=1 for status' 
  }, { status: 405 });
}


