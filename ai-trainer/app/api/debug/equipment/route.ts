import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const overrideUser = url.searchParams.get('user');

  const supabase = createRouteHandlerClient({ cookies });

  const { data: auth } = await supabase.auth.getUser();
  const sessionUserId = auth?.user?.id ?? null;

  if (!sessionUserId && !overrideUser) {
    return NextResponse.json(
      { ok: false, error: 'No auth session. Open this URL in the same browser tab where you are logged in.' },
      { status: 401 }
    );
  }

  const userId = (sessionUserId ?? overrideUser)!;

  const { data: userEquipRows, error: userEquipErr } = await supabase
    .from('user_equipment')
    .select('id, user_id, equipment_id, custom_name, is_available')
    .eq('user_id', userId)
    .eq('is_available', true);

  let adminFallbackUsed = false;
  let rows = userEquipRows ?? [];
  let adminErr: string | null = null;

  if ((userEquipErr || !rows?.length) && overrideUser && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    adminFallbackUsed = true;
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
      );
      const { data: adminRows } = await admin
        .from('user_equipment')
        .select('id, user_id, equipment_id, custom_name, is_available')
        .eq('user_id', userId)
        .eq('is_available', true);
      rows = adminRows ?? [];
    } catch (e: any) {
      adminErr = e?.message ?? String(e);
    }
  }

  const equipmentIds = [...new Set(rows.map(r => r.equipment_id).filter(Boolean))] as string[];

  let equipmentRows: { id: string; name: string }[] = [];
  if (equipmentIds.length) {
    const { data: eqRows } = await supabase
      .from('equipment')
      .select('id, name')
      .in('id', equipmentIds);
    equipmentRows = eqRows ?? [];
  }

  const idToName = new Map(equipmentRows.map(r => [r.id, r.name]));
  const resolved = rows.map(r => ({
    user_equipment_id: r.id,
    equipment_id: r.equipment_id,
    name: idToName.get(r.equipment_id) ?? '(missing)',
    is_available: r.is_available,
    custom_name: (r as any).custom_name ?? null,
  }));

  const availableNames = resolved
    .filter(r => r.is_available)
    .map(r => r.name)
    .filter(Boolean) as string[];

  return NextResponse.json({
    ok: true,
    whoAmI: sessionUserId ? { type: 'session', userId: sessionUserId } : { type: 'override', userId },
    adminFallbackUsed,
    adminErr,
    counts: {
      user_equipment: rows.length,
      equipment_joined: equipmentRows.length,
      available_names: availableNames.length,
    },
    available_names: availableNames,
    resolved,
  });
}


