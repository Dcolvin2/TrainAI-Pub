// app/api/chat-workout/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { getAvailableEquipmentNames } from '@/lib/equipment';
import { tryParseJson } from '@/lib/safeJson';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

type PlanSet = { set: number; reps: string | number; rest_seconds?: number; };
type PlanItem = { name: string; sets?: string | number; reps?: string | number; instruction?: string; isAccessory?: boolean; };
type WorkoutPlan = {
  name: string;
  duration_min?: number;
  phases?: { phase: 'warmup'|'main'|'accessory'|'conditioning'|'cooldown'; items: PlanItem[]; }[];
  warmup?: PlanItem[];
  main?: PlanItem[];
  cooldown?: PlanItem[];
  est_total_minutes?: number;
};

function looksLikePersonaQuery(m: string) {
  // If they named a person / coach / celeb, we'll go to the model
  return /\b(joe holder|chris hemsworth|rob gronkowski|goggins|holder|hem sworth|celebrity|coach|inspired by|in the style of)\b/i.test(m);
}

function wantsKettlebellOnly(m: string) {
  return /\bkettlebell(s)?\b/i.test(m);
}

function wantsNike(m: string) {
  // Explicit Nike only — no accidental routing
  return /\b(nike training club|nike app|nike workout|nike\s*#?\s*\d+)\b/i.test(m);
}

function buildStrictPrompt(opts: { msg: string; equipment: string[]; duration?: number }) {
  const { msg, equipment, duration = 45 } = opts;
  return `
Return ONLY valid JSON.

Schema:
{
  "name": string,
  "duration_min": number,
  "phases": [
    { "phase": "warmup"|"main"|"accessory"|"conditioning"|"cooldown",
      "items": [
        { "name": string, "sets": string|number, "reps": string|number, "instruction": string }
      ]
    }
  ],
  "est_total_minutes": number
}

Rules:
- duration_min <= ${duration}
- Use ONLY equipment from: ${equipment.join(', ') || 'Bodyweight'}
- If user implies kettlebells, every "main" and "accessory" item should be a kettlebell movement.
- Include warmup and cooldown.
- If the user names a person/coach, emulate their general style without trademarked program names.

User request: "${msg}"
`;
}

function simpleFallbackPlan(msg: string, forceKb: boolean): WorkoutPlan {
  const kb = (name: string, instruction: string): PlanItem => ({ name, sets: '3', reps: '8–12', instruction });
  const bw = (name: string, instruction: string): PlanItem => ({ name, sets: '3', reps: '12–15', instruction });

  const warmup: PlanItem[] = [
    { name: 'Arm Circles', sets: '1', reps: '10 each direction', instruction: 'Large forward/backward circles' },
    { name: 'Hip Openers', sets: '1', reps: '10 each side', instruction: 'Controlled hip rotations' },
    { name: 'World\'s Greatest Stretch', sets: '1', reps: '5 each side', instruction: 'Lunge + T-spine reach' },
  ];

  const main: PlanItem[] = forceKb
    ? [
        kb('Kettlebell Swings', 'Hinge; snap hips; neutral spine'),
        kb('Kettlebell Goblet Squat', 'Elbows inside knees, tall torso'),
        kb('Kettlebell Clean & Press', 'Clean to rack; press overhead strong'),
        kb('Kettlebell Row', 'Hinge, pull to hip/ribs'),
      ]
    : [
        bw('Bodyweight Squat', 'Sit between hips; keep chest proud'),
        bw('Push-Up', 'Brace; full range'),
        bw('Reverse Lunge', 'Knee under hip; tall posture'),
        bw('Plank', '30–45s; ribs down; glutes on'),
      ];

  const cooldown: PlanItem[] = [
    { name: 'Child\'s Pose', sets: '1', reps: '45–60s', instruction: 'Deep breaths' },
    { name: 'Hamstring Stretch', sets: '1', reps: '30–45s/side', instruction: 'Soft knee; long spine' },
    { name: 'Thoracic Rotation', sets: '1', reps: '6/side', instruction: 'Smooth rotations' },
  ];

  return {
    name: forceKb ? 'Kettlebell Total-Body' : 'Bodyweight Strength Focus',
    duration_min: 45,
    phases: [
      { phase: 'warmup', items: warmup },
      { phase: 'main', items: main },
      { phase: 'cooldown', items: cooldown },
    ],
    est_total_minutes: 45
  };
}

export async function POST(req: Request) {
  try {
    const { message, sessionId } = await req.json();
    if (!message) return NextResponse.json({ ok: false, error: 'Missing message' }, { status: 400 });

    // Pretend sessionId is the user (your current code does this)
    const userId = sessionId as string;
    if (!userId) return NextResponse.json({ ok: false, error: 'Missing user' }, { status: 401 });

    // 1) Equipment from DB (joined)
    const equipmentNames = await getAvailableEquipmentNames(supabase, userId);
    const lowerEquip = equipmentNames.map(e => e.toLowerCase());

    // 2) Routing: Nike only on explicit mention
    const m = String(message).toLowerCase();
    if (wantsNike(m)) {
      return NextResponse.json({ ok: true, route: 'nike', info: 'Explicit Nike request detected; keeping behavior unchanged.' });
    }

    // 3) Persona / Kettlebell intent
    const forceKb = wantsKettlebellOnly(m);
    const useModel = looksLikePersonaQuery(m) || forceKb; // use model for both

    // 4) Model path (strict JSON). If it fails, we fallback to algorithmic generator.
    let plan: WorkoutPlan | null = null;

    if (useModel) {
      const prompt = buildStrictPrompt({
        msg: message,
        equipment: equipmentNames.length ? equipmentNames : ['Bodyweight'],
        duration: 45
      });

      const resp = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1500,
        temperature: 0.4,
        messages: [{ role: 'user', content: prompt }]
      } as any);

      const firstBlock: any = resp?.content?.[0];
      const text = (firstBlock && firstBlock.type === 'text') ? firstBlock.text : String(firstBlock?.text ?? '');
      plan = tryParseJson<WorkoutPlan>(text);
    }

    // 5) Fallback if model didn't return valid JSON
    if (!plan || (!plan.phases && !plan.main)) {
      plan = simpleFallbackPlan(message, forceKb);
    }

    // 6) Save planned workout (no "save as workout" step needed)
    await supabase.from('workout_sessions').insert({
      user_id: userId,
      workout_source: 'chat',
      workout_name: plan.name,
      workout_type: forceKb ? 'kettlebell' : 'custom',
      planned_exercises: plan,
      date: new Date().toISOString()
    });

    // 7) Shape response for your existing UI
    //    If phases exist, keep them; if not, map to warmup/main/cooldown legacy keys.
    const legacy = plan.phases ? undefined : {
      warmup: plan.warmup ?? [],
      main: plan.main ?? [],
      cooldown: plan.cooldown ?? []
    };

    return NextResponse.json({
      ok: true,
      message: `Planned: ${plan.name}${equipmentNames.length ? ` (uses: ${equipmentNames.join(', ')})` : ' (bodyweight only)'}.`,
      plan,
      workout: legacy // your renderer can still read this if it expects warmup/main/cooldown
    });
  } catch (err) {
    console.error('chat-workout error:', err);
    return NextResponse.json({ ok: false, error: 'Chat failed' }, { status: 500 });
  }
}


