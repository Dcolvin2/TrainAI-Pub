// app/api/debug/equipment/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = (url.searchParams.get('userId') || url.searchParams.get('sessionId') || '').trim();

  if (!userId) {
    return NextResponse.json(
      { ok: false, error: 'Missing userId. Call /api/debug/equipment?userId=<auth.users.id>' },
      { status: 400 }
    );
  }

  // 1) Pull user_equipment rows
  const { data: ue, error: ueErr } = await supabase
    .from('user_equipment')
    .select('id, user_id, equipment_id, is_available, custom_name')
    .eq('user_id', userId);

  if (ueErr) {
    return NextResponse.json(
      { ok: false, error: `user_equipment error: ${ueErr.message}`, userId },
      { status: 500 }
    );
  }

  // 2) Fetch matching equipment names
  const ids = (ue ?? []).map((r: any) => r.equipment_id).filter(Boolean);
  let eqRows: any[] = [];
  if (ids.length) {
    const { data: eq, error: eqErr } = await supabase
      .from('equipment')
      .select('id, name')
      .in('id', ids);
    if (eqErr) {
      return NextResponse.json(
        { ok: false, error: `equipment error: ${eqErr.message}`, userId, user_equipment_rows: ue ?? [] },
        { status: 500 }
      );
    }
    eqRows = eq ?? [];
  }

  const nameById = new Map(eqRows.map((r: any) => [r.id, r.name]));
  const resolved = (ue ?? [])
    .filter((r: any) => r.is_available === undefined || r.is_available === null || r.is_available === true)
    .map((r: any) => nameById.get(r.equipment_id))
    .filter(Boolean) as string[];

  const warnings = [
    !(ue && ue.length) ? 'No rows in user_equipment for this user_id.' : null,
    (ue && ue.length && !resolved.length) ? 'All items may be is_available=false.' : null
  ].filter(Boolean);

  return NextResponse.json({
    ok: true,
    userId,
    counts: {
      user_equipment: ue?.length ?? 0,
      equipment_joined: eqRows.length,
      available_names: resolved.length
    },
    resolved_equipment_names: resolved,
    resolved_equipment_names_lower: resolved.map((n) => n.toLowerCase()),
    user_equipment_rows: ue ?? [],
    equipment_rows: eqRows,
    warnings
  });
}


