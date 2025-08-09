export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get('user') || req.headers.get('x-user-id') || '';

  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Provide ?user=<uuid> or x-user-id' }, { status: 400 });
  }

  const { data: ue, error: e1 } = await supabase
    .from('user_equipment')
    .select('equipment_id, is_available')
    .eq('user_id', userId);

  if (e1) return NextResponse.json({ ok: false, error: e1.message }, { status: 500 });

  const ids = (ue ?? []).map(r => r.equipment_id).filter(Boolean);
  const { data: eq, error: e2 } = await supabase
    .from('equipment')
    .select('id, name')
    .in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);

  if (e2) return NextResponse.json({ ok: false, error: e2.message }, { status: 500 });

  const idToName = new Map((eq ?? []).map(r => [String(r.id), String(r.name)]));
  const resolved = (ue ?? [])
    .filter(r => r.is_available !== false)
    .map(r => idToName.get(String(r.equipment_id)))
    .filter(Boolean) as string[];

  return NextResponse.json({
    ok: true,
    userId,
    counts: {
      user_equipment: ue?.length ?? 0,
      equipment_joined: eq?.length ?? 0,
      available_names: resolved.length
    },
    resolved_equipment_names: resolved,
    resolved_equipment_names_lower: resolved.map(s => s.toLowerCase()),
    user_equipment_rows: ue ?? [],
    equipment_rows: eq ?? []
  });
}


