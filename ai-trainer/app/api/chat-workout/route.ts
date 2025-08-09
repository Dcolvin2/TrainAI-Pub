export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,   // private, server-only
  { auth: { persistSession: false } }
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

async function getAvailableEquipmentNames(userId: string) {
  // join user_equipment → equipment to get the canonical names
  const { data, error } = await admin
    .from('user_equipment')
    .select('is_available, equipment:equipment_id ( name )')
    .eq('user_id', userId)
    .eq('is_available', true);

  if (error) throw error;

  // map → names - handle the join result structure properly
  return (data ?? [])
    .map(r => {
      // Handle the join result structure properly
      const equipment = r.equipment as any; // Explicit cast to any for type safety workaround
      return equipment?.name;
    })
    .filter((n): n is string => !!n);
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const user = url.searchParams.get('user');
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Missing ?user=<uuid>' }, { status: 400 });
  }

  const { message = '' } = await req.json().catch(() => ({ message: '' }));

  try {
    // pull equipment with admin client
    const names = await getAvailableEquipmentNames(user);
    const has = (label: string) => names.some(n => n.toLowerCase() === label.toLowerCase());

    // simple routing example: kettlebell if you actually have Kettlebells
    if (/kettlebell/i.test(message) && has('Kettlebells')) {
      return NextResponse.json({
        ok: true,
        message: 'Planned: Kettlebell Strength & Conditioning (~45 min).',
        debug: { user, equipmentCount: names.length, usedServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY },
        // ...build the kettlebell plan here...
      });
    }

    // otherwise, show a helpful reason instead of silently defaulting
    if (/kettlebell/i.test(message) && !has('Kettlebells')) {
      return NextResponse.json({
        ok: true,
        message: "I don't see Kettlebells in your equipment list. Want me to plan a bodyweight session or use Dumbbells instead?",
        debug: { user, equipment: names },
      });
    }

    // final fallback
    return NextResponse.json({
      ok: true,
      message: 'Planned: Bodyweight Full Body Strength (~45 min).',
      debug: { user, equipmentCount: names.length },
    });
  } catch (err: any) {
    console.error('chat-workout error', err?.message ?? err);
    return NextResponse.json({ ok: false, error: 'Failed to generate workout' }, { status: 500 });
  }
}


