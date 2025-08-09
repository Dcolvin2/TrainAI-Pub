// app/api/chat-workout/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

import { shouldUseNike } from '@/lib/intent';
import { tryParseJson } from '@/lib/safeJson';
import { getUserEquipmentNames } from '@/lib/equipment';
import { buildWorkoutPrompt } from '@/lib/workoutPrompt';
import type { StrictPlan } from '@/lib/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// Simple profile for duration default (non-breaking if absent)
async function getUserMinutes(userId: string): Promise<number> {
  const { data } = await supabase
    .from('profiles')
    .select('preferred_workout_duration')
    .eq('user_id', userId)
    .maybeSingle();
  return Number(data?.preferred_workout_duration ?? 45);
}

// Derive optional style hint from message (coach/persona name if present)
function detectStyleHint(m: string): string | null {
  const lower = m.toLowerCase();
  // silly heuristic: any two-word capitalized in message can be a name; keep simple
  const known = ['joe holder', 'chris hemsworth', 'david goggins', 'rob gronkowski'];
  const hit = known.find(k => lower.includes(k));
  return hit ?? null;
}

// Fallback tiny bodyweight plan if AI fails (keeps UI alive)
function fallbackPlan(minutes: number): StrictPlan {
  return {
    name: 'Bodyweight Strength Focus',
    duration_min: Math.min(minutes, 45),
    est_total_minutes: Math.min(minutes, 45),
    phases: [
      { phase: 'warmup', items: [
        { name: 'Arm Circles', sets: '1', reps: '10 each direction', instruction: 'Large, smooth circles' },
        { name: 'Hip Openers', sets: '1', reps: '10/side', instruction: 'Controlled range' }
      ]},
      { phase: 'main', items: [
        { name: 'Bodyweight Squat', sets: '3', reps: '12–15', instruction: 'Chest tall' },
        { name: 'Push-Up', sets: '3', reps: '8–12', instruction: 'Full range' }
      ]},
      { phase: 'accessory', items: [
        { name: 'Walking Lunge', sets: '2', reps: '10/side', instruction: 'Knee under hip', isAccessory: true },
        { name: 'Side Plank', sets: '2', reps: '20–30s/side', instruction: 'Ribs down', isAccessory: true }
      ]},
      { phase: 'cooldown', items: [
        { name: 'Child\'s Pose', sets: '1', reps: '45–60s', instruction: 'Easy breathing' }
      ]}
    ]
  };
}

export async function POST(req: Request) {
  try {
    const { message, sessionId, currentWorkout } = await req.json();
    if (!message) return NextResponse.json({ ok: false, error: 'Missing message' }, { status: 400 });

    // Resolve user (use sessionId you pass today)
    const userId = sessionId as string | undefined;
    if (!userId) return NextResponse.json({ ok: false, error: 'Missing user id (sessionId)' }, { status: 400 });

    // 1) Nike guard
    if (shouldUseNike(String(message))) {
      // Your existing Nike path — return a soft redirect so UI can handle as before
      return NextResponse.json({ ok: true, route: 'nike', message: String(message) });
    }

    // 2) Context: equipment + duration
    const [minutes, availableNames] = await Promise.all([
      getUserMinutes(userId),
      getUserEquipmentNames(userId)
    ]);

    const availableLower = new Set(availableNames.map(n => n.toLowerCase()));
    
    // simple KB detection that tolerates plural/singular
    const hasKB = availableLower.has('kettlebell') || availableLower.has('kettlebells');

    // 3) Build prompt for Anthropic
    const styleHint = detectStyleHint(String(message));
    const prompt = buildWorkoutPrompt({
      userMessage: String(message),
      minutes,
      availableEquipment: availableNames,
      styleHint
    });

    // 4) Call Anthropic
    const ai = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1600,
      temperature: 0.4,
      system: 'You are a meticulous strength coach. Always obey equipment limits; avoid Olympic lifts (snatch/clean/jerk). Return JSON only.',
      messages: [{ role: 'user', content: prompt }]
    });

    const firstText = (Array.isArray(ai.content) ? ai.content.find(b => (b as any).type === 'text') : null) as any;
    const raw = String(firstText?.text ?? '');
    let plan = tryParseJson<StrictPlan>(raw);

    // 5) If parse failed or phases missing, use fallback
    if (!plan || !Array.isArray(plan.phases)) {
      plan = fallbackPlan(minutes);
    }

    // 6) Compose a friendly message (not one word)
    const equipLine = availableNames.length
      ? `Using: ${availableNames.join(', ')}.`
      : `No equipment on file — defaulting to bodyweight.`;
    const headline = `Planned: ${plan.name} (~${plan.est_total_minutes ?? plan.duration_min} min). ${equipLine}`;

    // 7) (Optional) If you want: we do NOT auto-save to workouts here.
    //    Your UI can save after completion, like before.

    return NextResponse.json({ ok: true, message: headline, plan });
  } catch (err: any) {
    console.error('chat-workout error', err?.message ?? err);
    return NextResponse.json({ ok: false, error: 'Failed to generate workout' }, { status: 500 });
  }
}


