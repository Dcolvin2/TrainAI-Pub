export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const EQUIPMENT_ALIASES: Record<string, string[]> = {
  Kettlebells: ['kettlebell', 'kettlebells', 'kb'],
  Dumbbells: ['dumbbell', 'dumbbells', 'db'],
  Barbells: ['barbell', 'barbells', 'bb'],
  Superbands: ['band', 'resistance band', 'superband', 'superbands', 'mini band', 'minibands'],
  'Pull Up Bar': ['pull-up bar', 'pullup bar', 'pull up bar'],
  'Battle Rope': ['battle rope', 'battlerope', 'ropes'],
  'Plyo Box': ['plyo', 'box jump', 'plyo box'],
  TRX: ['trx', 'suspension'],
  Bench: ['bench', 'adjustable bench']
};

function detectRequestedEquipment(message: string): string[] {
  const m = message?.toLowerCase?.() ?? '';
  const hits: string[] = [];
  for (const [canon, aliases] of Object.entries(EQUIPMENT_ALIASES)) {
    if (aliases.some(a => m.includes(a))) hits.push(canon);
  }
  return hits;
}

function arrayify(x: any): string[] {
  if (!x) return [];
  if (Array.isArray(x)) return x.map(String);
  return [String(x)];
}

function filterByEquipment(exRows: any[], allowed: string[]): any[] {
  if (!allowed.length) return exRows;
  const allowedLower = allowed.map(s => s.toLowerCase());
  return exRows.filter(ex => {
    const req =
      arrayify(ex.equipment_required).concat(arrayify(ex.required_equipment)).filter(Boolean);
    if (!req.length) return true;
    return req.some((r: string) => allowedLower.includes(r.toLowerCase()));
  });
}

function pick<T>(arr: T[], n: number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, Math.max(0, Math.min(n, a.length)));
}

export async function POST(req: Request) {
  try {
    const { message, userId: bodyUser, duration = 45 } = await req.json();
    const headerUser = req.headers.get('x-user-id');
    const userId = bodyUser || headerUser;
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Missing userId (body.userId or x-user-id)' }, { status: 400 });
    }

    const { data: ue } = await supabase
      .from('user_equipment')
      .select('equipment_id, is_available')
      .eq('user_id', userId);

    const ids = (ue ?? []).map(r => r.equipment_id).filter(Boolean);
    const { data: eq } = await supabase
      .from('equipment')
      .select('id, name')
      .in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);

    const idToName = new Map((eq ?? []).map(r => [String(r.id), String(r.name)]));
    const available = (ue ?? [])
      .filter(r => r.is_available !== false)
      .map(r => idToName.get(String(r.equipment_id)))
      .filter(Boolean) as string[];

    const requested = detectRequestedEquipment(message || '');
    const allowed = requested.length ? requested : available;

    const { data: rawExercises } = await supabase
      .from('exercises')
      .select('id, name, exercise_phase, primary_muscle, is_compound, equipment_required, required_equipment, instruction, movement_pattern')
      .limit(1000);

    const rows = rawExercises ?? [];

    const warmups = filterByEquipment(rows.filter(r => r.exercise_phase === 'warmup'), allowed);
    const cooldowns = filterByEquipment(rows.filter(r => r.exercise_phase === 'cooldown'), allowed);

    const mainsAll = filterByEquipment(rows.filter(r => (r.exercise_phase ?? 'main') !== 'warmup' && (r.exercise_phase ?? 'main') !== 'cooldown'), allowed);
    const mainsCompound = mainsAll.filter(r => Boolean(r.is_compound));
    const mains = mainsCompound.length ? mainsCompound : mainsAll;

    const accessoriesAll = mainsAll.filter(r => !r.is_compound);

    const biasWord = requested[0]?.toLowerCase();
    const nameBiased = biasWord
      ? mains.filter(r => r.name.toLowerCase().includes(biasWord.slice(0, 6)))
      : [];

    const mainPick = (nameBiased.length ? nameBiased : mains);
    const main = pick(mainPick, 1);

    const accessories = pick(
      accessoriesAll.filter(a => !main.some(m => m.name === a.name)),
      3
    );

    const warm = pick(warmups, 3);
    const cool = pick(cooldowns, 3);

    const plan = {
      name: requested.length ? `${requested[0]} session` : 'Smart session',
      duration_min: Number(duration) || 45,
      est_total_minutes: Number(duration) || 45,
      phases: [
        {
          phase: 'warmup',
          items: warm.map((e, i) => ({
            exercise_id: String(e.id ?? e.name),
            display_name: e.name,
            sets: [{ set_number: 1, reps: '10-15', prescribed_weight: null, rest_seconds: 30 }],
            notes: e.instruction ?? null
          }))
        },
        {
          phase: 'main',
          items: main.map((e) => ({
            exercise_id: String(e.id ?? e.name),
            display_name: e.name,
            sets: [
              { set_number: 1, reps: '3-5', prescribed_weight: null, rest_seconds: 120 },
              { set_number: 2, reps: '3-5', prescribed_weight: null, rest_seconds: 120 },
              { set_number: 3, reps: '3-5', prescribed_weight: null, rest_seconds: 120 },
              { set_number: 4, reps: '3-5', prescribed_weight: null, rest_seconds: 120 }
            ],
            notes: 'Main lift - progressive overload'
          }))
        },
        {
          phase: 'accessory',
          items: accessories.map((e) => ({
            exercise_id: String(e.id ?? e.name),
            display_name: e.name,
            sets: [
              { set_number: 1, reps: '8-12', prescribed_weight: null, rest_seconds: 90 },
              { set_number: 2, reps: '8-12', prescribed_weight: null, rest_seconds: 90 },
              { set_number: 3, reps: '8-12', prescribed_weight: null, rest_seconds: 90 }
            ],
            notes: e.instruction ?? null
          }))
        },
        {
          phase: 'cooldown',
          items: cool.map((e) => ({
            exercise_id: String(e.id ?? e.name),
            display_name: e.name,
            sets: [{ set_number: 1, reps: '30-60s', prescribed_weight: null, rest_seconds: 0 }],
            notes: e.instruction ?? null
          }))
        }
      ]
    };

    const headline = requested.length
      ? `Planned: ${requested[0]} workout (~${plan.est_total_minutes} min).`
      : `Planned: equipment-aware workout (~${plan.est_total_minutes} min).`;

    return NextResponse.json({ ok: true, response: headline, plan, debug: { requested, allowed, available } });
  } catch (err: any) {
    console.error('smart-workout error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'Failed' }, { status: 500 });
  }
}


