import { NextResponse } from 'next/server';
import { getEquipmentNamesForUser } from '@/lib/equipment';
import { quickParse } from '@/lib/intent';
import { planWorkout } from '@/lib/planner';
import { sanitize } from '@/lib/safety';

export const runtime = 'nodejs';

function pickUserId(req: Request, body?: any) {
  const url = new URL(req.url);
  const fromQS = url.searchParams.get('user') || url.searchParams.get('uid');
  const fromHeader = req.headers.get('x-user-id') || req.headers.get('x-supabase-user-id');
  const fromBody = body?.user;
  return fromQS || fromHeader || fromBody || null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = pickUserId(req, body);
    const q: string = body.q || body.message || body.text || '';
    const narrate = String(new URL(req.url).searchParams.get('narrate') || body.narrate || '') === '1';

    if (!userId) return NextResponse.json({ ok: false, error: 'Missing ?user=<uuid>' }, { status: 400 });
    if (!q) return NextResponse.json({ ok: false, error: 'Missing chat message "q"' }, { status: 400 });

    const parsed = quickParse(q);
    const equipment = await getEquipmentNamesForUser(userId);

    // modality hints
    const hasKB = equipment.some(e => e.toLowerCase().includes('kettlebell'));
    const hasBB = equipment.some(e => e.toLowerCase().includes('barbell'));
    const hasDB = equipment.some(e => e.toLowerCase().includes('dumbbell'));
    const modalityHints =
      [parsed.modality, hasKB && 'kettlebell', hasBB && 'barbell', hasDB && 'dumbbell']
        .filter(Boolean)
        .join(', ') || 'any';

    // celebrity → style hint
    const styleMap: Record<string,string> = {
      'rob gronkowski': 'athletic power, heavy basics, explosive accessories',
      'gronk': 'athletic power, heavy basics, explosive accessories',
      'joe holder': 'movement quality, tempo work, circuits, mobility',
    };
    const styleHint = parsed.athleteName ? styleMap[parsed.athleteName] : undefined;

    const duration = parsed.duration_min || 45;

    const { plan } = await planWorkout({
      userMsg: q,
      equipment,
      duration,
      modalityHints,
      styleHint,
    });

    const { plan: cleanPlan, blocked } = sanitize(plan);

    // optional short narrative
    let narrative: string | undefined;
    if (narrate) {
      narrative = `Today's plan: ${cleanPlan.name}. Expect about ${cleanPlan.duration_min} minutes with a warmup, a main strength block, accessories, and a cooldown. Keep rests ~90s on accessories and 2–3 min on heavy sets. Progress next time by following: ${cleanPlan.progression_tip || 'Add 1–2 reps or small weight if sets felt ≤7 RPE.'}`;
    }

    return NextResponse.json({
      ok: true,
      message: `${parsed.athleteName ? 'Inspired by ' + parsed.athleteName + '. ' : ''}Planned: ${cleanPlan.name}.`,
      plan: cleanPlan,
      narrative,
      debug: {
        user: userId,
        intent: parsed.intent,
        equipmentCount: equipment.length,
        modalityHints,
        styleHint,
        blockedExercises: blocked,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}


