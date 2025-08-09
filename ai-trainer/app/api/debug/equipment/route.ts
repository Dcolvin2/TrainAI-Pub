export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('user');
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Missing ?user=<uuid>' }, { status: 400 });
  }

  const { data: ue, error } = await supabase
    .from('user_equipment')
    .select('equipment_id, custom_name, id')
    .eq('user_id', userId);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  let names: string[] = [];
  if (ue?.length) {
    const ids = ue.map(r => r.equipment_id).filter(Boolean);
    const { data: eq, error: eqErr } = await supabase
      .from('equipment')
      .select('id, name')
      .in('id', ids);

    if (eqErr) {
      return NextResponse.json({ ok: false, error: eqErr.message }, { status: 500 });
    }

    const byId = new Map((eq ?? []).map(e => [e.id, e.name]));
    names = ue
      .map(r => byId.get(r.equipment_id) || r.custom_name)
      .filter(Boolean) as string[];
  }

  return NextResponse.json({
    ok: true,
    userId,
    count: ue?.length ?? 0,
    names
  });
}


