// app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';          // do NOT run on Edge (process.env)
export const dynamic = 'force-dynamic';   // no caching; always compute

type Msg = { role: 'user' | 'assistant' | 'system'; content: string };

function json(status: number, body: any) {
  return NextResponse.json(body, { status });
}

async function callClaude(system: string, user: unknown) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('Server not configured (ANTHROPIC_API_KEY missing)');
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20240620',
      max_tokens: 1200,
      system,
      messages: [{ role: 'user', content: JSON.stringify(user) }],
    }),
  });

  const ct = resp.headers.get('content-type') || '';
  const raw = await resp.text();
  if (!ct.includes('application/json')) {
    console.error('Claude non-JSON', resp.status, raw.slice(0, 200));
    throw new Error(`Claude error ${resp.status}`);
  }
  const data = JSON.parse(raw);
  const text: string = data?.content?.[0]?.text || '';
  try {
    return JSON.parse(text);
  } catch {
    return { text }; // tolerate non-JSON; upstream normalizer will handle
  }
}

export async function POST(req: NextRequest) {
  const reqId = Math.random().toString(36).slice(2, 8);
  try {
    const ct = req.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      return json(200, { ok: false, error: 'content-type must be application/json' });
    }

    const body = (await req.json()) as { messages?: Msg[]; minutes?: number; split?: string; equipment?: string[] };
    const messages = Array.isArray(body?.messages) ? body!.messages : [];
    if (messages.length === 0) {
      return json(200, { ok: false, error: 'messages[] required' });
    }
    const lastUser = [...messages].reverse().find(m => m.role === 'user')?.content?.trim() || '';

    // Special-case shortcut (e.g., "joe holder ocho style")
    const isJoeHolder = /^joe\s+holder/i.test(lastUser);

    const minutes = Number(body?.minutes || 45);
    const split = (body?.split || (/\bpull\b/i.test(lastUser) ? 'pull' : 'push')) as 'pull' | 'push' | 'legs' | 'upper' | 'full' | 'hiit';
    const equipment = Array.isArray(body?.equipment) ? body!.equipment : [];

    // MAIN lift anchor logic (only main repeats)
    const MAIN_LIFTS: Record<string, string[]> = {
      pull: ['Trap Bar Deadlift', 'Conventional Deadlift', 'Dumbbell Romanian Deadlift'],
      push: ['Barbell Bench Press', 'Dumbbell Bench Press', 'Incline Bench Press'],
      legs: ['Back Squat', 'Front Squat', 'Belt Squat'],
      upper: ['Standing Overhead Press', 'Seated DB Shoulder Press'],
      full: ['Trap Bar Deadlift', 'Back Squat', 'Bench Press'],
      hiit: [],
    };

    const have = (needle: string) => equipment.some(e => e.toLowerCase().includes(needle));
    const pickMainLift = (s: string): string => {
      const anchors = MAIN_LIFTS[s] || [];
      for (const lift of anchors) {
        const n = lift.toLowerCase();
        if (n.includes('trap bar') && have('trap bar')) return lift;
        if (n.includes('deadlift') && (have('barbell') || have('trap bar'))) return lift;
        if (n.includes('romanian') && have('dumbbell')) return lift;
        if (n.includes('bench') && have('bench')) return lift;
        if (n.includes('squat') && (have('rack') || have('belt squat') || have('barbell'))) return lift;
        if (n.includes('press') && (have('barbell') || have('dumbbell'))) return lift;
      }
      return anchors[0] ?? 'Dumbbell Romanian Deadlift';
    };

    const mainLift = pickMainLift(split);

    // Time budget (warm-up must include rotation/anti-rotation)
    const budget = {
      warmup: Math.min(10, Math.max(5, Math.round(minutes * 0.18))),
      main: Math.round(minutes * 0.42),
      accessories: Math.max(8, minutes - Math.round(minutes * 0.18) - Math.round(minutes * 0.42) - 4),
      cooldown: 4,
    };

    const system = [
      'You are TrainAI, a strength coach. Output JSON only.',
      'Keys: plan, workout.warmup[], workout.mainExercises[], workout.finisher',
      'Warm-up MUST be 5–10 minutes and include scap prep AND thoracic rotation or anti-rotation.',
      'Anchor the MAIN lift as first item of mainExercises exactly once; mark all other main items isAccessory:true.',
      'Prefer high-quality pulls (rows, pulldown/pull-up), posterior chain, and grip carries on PULL days.',
      'Fit work into minutes: use provided budget as guidance; keep text concise.',
    ].join('\n');

    const user = {
      intent: isJoeHolder ? 'ocho_style' : 'free',
      split,
      minutes,
      budget,
      equipment,
      anchors: { mainLift },
    };

    const llm = await callClaude(system, user);

    const warm = Array.isArray(llm?.workout?.warmup) ? llm.workout.warmup : [
      { name: 'Bike or Row Erg (easy)', duration: '3 min', instruction: 'RPE 4–5' },
      { name: 'Quadruped T-Spine Rotations', sets: 1, reps: '8/side' },
      { name: 'Banded Face Pulls', sets: 2, reps: '15' },
      { name: 'Half-Kneeling Pallof Press', sets: 2, reps: '10/side' },
    ];

    const rest = Array.isArray(llm?.workout?.mainExercises) ? llm.workout.mainExercises : [
      { name: 'One-Arm Cable Row (slight rotation)', sets: 3, reps: '10/side', isAccessory: true },
      { name: 'Lat Pulldown / Assisted Pull-Up', sets: 3, reps: '8–10', isAccessory: true },
      { name: 'Face Pull', sets: 2, reps: '12–15', isAccessory: true },
      { name: 'High-to-Low Cable Chop', sets: 2, reps: '10/side', isAccessory: true },
    ];

    const mainExercises = [
      { name: mainLift, sets: 4, reps: '5', instruction: 'Build to working sets @ RPE 7–8', isAccessory: false },
      ...rest.map((x: any) => ({ ...x, isAccessory: true })),
    ];

    const payload = {
      ok: true,
      name: `${split[0].toUpperCase() + split.slice(1)} (~${minutes} min)`,
      message: `${split[0].toUpperCase() + split.slice(1)} (~${minutes} min)`,
      coach: `${split.toUpperCase()} day locked. Main lift: ${mainLift}. We'll include rotation/anti-rotation in warm-up, then rows/pulldown and grip work. Tell me if time is tight and I'll trim accessories.`,
      plan: { split, duration: minutes, main_lift: mainLift, name: `${split[0].toUpperCase() + split.slice(1)} (~${minutes} min)` },
      workout: { warmup: warm, mainExercises, finisher: llm?.workout?.finisher },
    };

    return json(200, payload);
  } catch (err: any) {
    console.error('api/chat', reqId, err?.stack || err);
    return json(200, { ok: false, error: err?.message || 'Internal server error' });
  }
}
