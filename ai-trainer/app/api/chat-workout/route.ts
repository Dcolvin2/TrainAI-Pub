import { NextResponse } from 'next/server';
import { anthropic } from '@/lib/anthropicClient';
import { tryParseJson } from '@/lib/safeJson';
import { getUserEquipmentNames } from '@/lib/userEquipment';

export const runtime = 'nodejs';

type WorkoutShape = {
  warmup: { name: string; sets?: string; reps?: string; duration?: string; instruction?: string }[];
  main:   { name: string; sets?: string; reps?: string; duration?: string; instruction?: string; isAccessory?: boolean }[];
  cooldown:{ name: string; sets?: string; reps?: string; duration?: string; instruction?: string }[];
};

function looksLikeUuid(s?: string | null) {
  return !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function resolveUserIdSync(req: Request) {
  const url = new URL(req.url);
  const qs = url.searchParams.get('user') || undefined;
  const segs = url.pathname.split('/').filter(Boolean);
  const lastSeg = segs[segs.length - 1];
  const header = req.headers.get('x-user-id') || undefined;

  const user =
    (looksLikeUuid(qs) && qs) ||
    (looksLikeUuid(lastSeg) && lastSeg) ||
    (looksLikeUuid(header) && header) ||
    undefined;

  return user;
}

export async function POST(req: Request) {
  try {
    const user = resolveUserIdSync(req);
    const { message } = (await req.json().catch(() => ({}))) as { message?: string };
    if (!message) {
      return NextResponse.json({ ok: false, error: 'Missing { "message": "<text>" }' }, { status: 400 });
    }

    const equip = user ? (await getUserEquipmentNames(user)).names : [];
    const equipList = equip.length ? equip.join(', ') : 'Bodyweight only';

    const hardNike = /\bnike\s*(?:training club|workout|wod|#?\s*\d+)/i.test(message);
    if (hardNike) {
      return NextResponse.json({ ok: true, intent: 'nike', message });
    }

    const prompt = `
Return ONLY valid JSON. No markdown. Shape exactly:

{
  "warmup": [ { "name": string, "sets": string, "reps": string, "instruction": string } ],
  "main":   [ 
    { "name": string, "sets": string, "reps": string, "instruction": string, "isAccessory": false }, 
    { "name": string, "sets": string, "reps": string, "instruction": string, "isAccessory": true } 
  ],
  "cooldown": [ { "name": string, "duration": string, "instruction": string } ]
}

Rules:
- Use ONLY exercises possible with this equipment: ${equipList}.
- If the message asks for "kettlebell", all main and accessories must be kettlebell-compatible.
- Include exactly 3 warmups, 1 main lift (isAccessory=false), then 3–4 accessories (isAccessory=true), and 3 cooldowns.
- Prefer compound main lift; accessories target complementary muscles or weaknesses.
- If equipment list is "Bodyweight only", create a bodyweight-only plan.
- Be specific in "instruction" fields.

USER MESSAGE:
"${message}"
`;

    const ai = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1600,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = (ai.content.find((b: any) => b.type === 'text') as any)?.text ?? '';
    const workout = tryParseJson<WorkoutShape>(text);

    if (!workout || !Array.isArray(workout.main)) {
      return NextResponse.json({ ok: false, error: 'AI did not return valid JSON', raw: text }, { status: 502 });
    }

    if (/kettlebell/i.test(message)) {
      const names = [...workout.warmup, ...workout.main, ...workout.cooldown].map(x => x.name.toLowerCase());
      const mentionsKB = names.some(n => n.includes('kettlebell') || n.includes('kb'));
      if (!mentionsKB) {
        workout.main = [
          { name: 'Kettlebell Dead Clean', sets: '4', reps: '5-6/side', instruction: 'Explosive hinge; crisp rack; brace hard', isAccessory: false },
          ...(workout.main || []).map((x, i) => i === 0 ? { ...x, isAccessory: true } : x),
        ];
      }
    }

    const headline = `Planned ${equip.length ? `with: ${equip.join(', ')}` : '(bodyweight only)'}.`;

    return NextResponse.json({
      ok: true,
      message: headline,
      workout,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? 'Server error' }, { status: 500 });
  }
}


