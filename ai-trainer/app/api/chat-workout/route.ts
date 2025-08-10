import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // server-only key
  { auth: { persistSession: false } }
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// simple types for plan JSON
type PhaseItem = {
  name: string;
  sets?: number | string;
  reps?: string;
  duration?: string;
  instruction?: string;
  isAccessory?: boolean;
};
type Phase = { phase: 'warmup'|'main'|'accessory'|'conditioning'|'cooldown'; items: PhaseItem[] };
type Plan = { name: string; duration_min: number; phases: Phase[] };

async function getUserEquipmentNames(userId: string): Promise<string[]> {
  // read user_equipment join equipment where is_available = true
  const { data, error } = await admin
    .from('user_equipment')
    .select('is_available, equipment:equipment_id ( name )')
    .eq('user_id', userId);

  if (error) return [];
  return (data ?? [])
    .filter(r => r.is_available !== false) // treat null as available
    .map(r => {
      // Handle the join result structure properly
      const equipment = r.equipment as any; // Explicit cast to any for type safety workaround
      return equipment?.name;
    })
    .filter(Boolean) as string[];
}

function hasAny(names: string[], lookup: string[]) {
  const set = new Set(names.map(n => n.toLowerCase()));
  return lookup.some(x => set.has(x.toLowerCase()));
}

function buildBodyweightPlan(): Plan {
  return {
    name: 'Bodyweight Full Body Strength',
    duration_min: 45,
    phases: [
      { phase: 'warmup', items: [
        { name: 'Arm Circles', sets: 1, reps: '10 each direction', instruction: 'Large forward/backward circles' },
        { name: 'Jumping Jacks', sets: 1, reps: '20', instruction: 'Full range of motion' },
        { name: 'World\'s Greatest Stretch', sets: 1, reps: '5/side', instruction: 'Lunge + T-spine reach' },
      ]},
      { phase: 'main', items: [
        { name: 'Push-Ups', sets: 4, reps: '10–12', instruction: 'Full ROM, ribs down' },
        { name: 'Bodyweight Squats', sets: 4, reps: '12–20', instruction: 'Chest up, knees track toes' },
      ]},
      { phase: 'accessory', items: [
        { name: 'Split Squats', sets: 3, reps: '10–12/leg', instruction: 'Knee under hip', isAccessory: true },
        { name: 'Plank', sets: 3, reps: '30–45s', instruction: 'Glutes on, neutral spine', isAccessory: true },
      ]},
      { phase: 'cooldown', items: [
        { name: 'Standing Forward Fold', duration: '30–45s', instruction: 'Gentle hamstring stretch' },
        { name: 'Child\'s Pose', duration: '45–60s', instruction: 'Slow breaths' },
      ]},
    ],
  };
}

function buildKettlebellStrengthCondPlan(): Plan {
  // No Olympic lifts on purpose (no snatches/cleans). Swings, goblet squat, rows, press.
  return {
    name: 'Kettlebell Strength & Conditioning',
    duration_min: 45,
    phases: [
      { phase: 'warmup', items: [
        { name: 'Hip Hinge Drill (PVC or BW)', sets: 1, reps: '10', instruction: 'Push hips back, neutral spine' },
        { name: 'KB Halo (light)', sets: 1, reps: '8/dir', instruction: 'Around head, elbows tucked' },
        { name: 'World\'s Greatest Stretch', sets: 1, reps: '5/side', instruction: 'Lunge + T-spine reach' },
      ]},
      { phase: 'main', items: [
        { name: 'Kettlebell Swings', sets: 4, reps: '12–15', instruction: 'Hinge, snap hips; bell to chest height' },
        { name: 'Goblet Squat', sets: 4, reps: '8–12', instruction: 'Torso tall, sit between hips' },
      ]},
      { phase: 'accessory', items: [
        { name: 'Single-Arm KB Row', sets: 3, reps: '10–12/side', instruction: 'Row to ribcage', isAccessory: true },
        { name: 'Half-Kneeling KB Press', sets: 3, reps: '8–10/side', instruction: 'Ribs down, glute on', isAccessory: true },
        { name: 'KB Dead Bug Pullover', sets: 3, reps: '8–10', instruction: 'Core brace, slow control', isAccessory: true },
      ]},
      { phase: 'conditioning', items: [
        { name: 'EMOM 10: 1) 10 Swings  2) 6 Goblet Reverse Lunges (alt)', sets: 1, reps: '10 min', instruction: 'Alternate minute-to-minute' },
      ]},
      { phase: 'cooldown', items: [
        { name: 'Half-Kneeling Hip Flexor Stretch', duration: '45s/side', instruction: 'Posterior pelvic tilt' },
        { name: 'Child\'s Pose', duration: '45–60s', instruction: 'Slow nasal breathing' },
      ]},
    ],
  };
}

function buildBarbellUpperLowerPlan(hasBench: boolean): Plan {
  // stays away from power cleans/snatches
  return {
    name: 'Barbell Upper/Lower Strength',
    duration_min: 50,
    phases: [
      { phase: 'warmup', items: [
        { name: 'Band Pull-Aparts', sets: 1, reps: '20', instruction: 'Scaps back/down' },
        { name: 'Hip Hinge Drill', sets: 1, reps: '10', instruction: 'Maintain neutral spine' },
      ]},
      { phase: 'main', items: [
        hasBench
          ? { name: 'Barbell Bench Press', sets: 5, reps: '5', instruction: 'Grip set, leg drive, pause if needed' }
          : { name: 'Barbell Floor Press', sets: 5, reps: '5', instruction: 'Elbows 45°, brief pause' },
        { name: 'Barbell Back Squat', sets: 5, reps: '3–5', instruction: 'Brace, sit between hips' },
      ]},
      { phase: 'accessory', items: [
        { name: 'Barbell RDL', sets: 3, reps: '6–8', instruction: 'Hips back, lats on', isAccessory: true },
        { name: 'Cable Face Pulls', sets: 3, reps: '12–15', instruction: 'Elbows high, external rotate', isAccessory: true },
      ]},
      { phase: 'cooldown', items: [
        { name: 'Thoracic Open Book', duration: '6/side', instruction: 'Slow rotations' },
        { name: 'Couch Stretch', duration: '45s/side', instruction: 'Stay tall; posterior tilt' },
      ]},
    ],
  };
}

export async function POST(req: Request) {
  const url = new URL(req.url);

  // read user from query OR body
  let userId = url.searchParams.get('user') || undefined;
  let body: any = {};
  try { body = await req.json(); } catch {}
  if (!userId) userId = body?.user || body?.sessionId || body?.user_id;

  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Missing user (qs ?user=… or body { user })' }, { status: 400 });
  }

  const message: string = (body?.message ?? '').toString();
  const lower = message.toLowerCase();

  // resolve equipment
  const equipmentNames = await getUserEquipmentNames(userId);
  const hasKB = hasAny(equipmentNames, ['Kettlebells']);
  const hasBB = hasAny(equipmentNames, ['Barbells']);
  const hasBench = hasAny(equipmentNames, ['Bench', 'Adjustable Bench']);

  // choose plan
  let plan: Plan;
  if (hasKB && (lower.includes('kettlebell') || lower.includes('kb'))) {
    plan = buildKettlebellStrengthCondPlan();
  } else if (hasBB && (lower.includes('barbell') || lower.includes('strength'))) {
    plan = buildBarbellUpperLowerPlan(hasBench);
  } else {
    plan = buildBodyweightPlan();
  }

  // optional: generate a chatty paragraph with Claude when ?narrate=1
  let narrative: string | undefined;
  if (url.searchParams.get('narrate') === '1' && anthropic.apiKey) {
    try {
      const res = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 220,
        messages: [{
          role: 'user',
          content:
            `User equipment: ${equipmentNames.join(', ') || 'none'}.\n` +
            `User request: "${message}".\n` +
            `Write a short, upbeat coaching blurb (3–5 sentences) explaining the training focus and how to approach today's plan titled "${plan.name}". Avoid snatches/power cleans.`
        }]
      });
      narrative = (res.content[0] as any)?.text || undefined;
    } catch { /* keep it optional */ }
  }

  return NextResponse.json({
    ok: true,
    message: `Planned: ${plan.name} (~${plan.duration_min} min).`,
    plan,
    narrative, // only when ?narrate=1 and key present
    debug: {
      user: userId,
      equipmentCount: equipmentNames.length,
      hasKB, hasBB, hasBench,
      usedServiceKey: true
    }
  });
}


