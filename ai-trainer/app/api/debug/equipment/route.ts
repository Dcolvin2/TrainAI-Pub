// app/api/debug/equipment/route.ts
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(req: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const url = new URL(req.url);
  const override = url.searchParams.get('userId') ?? undefined;

  // Auth (RLS-friendly)
  const { data: auth } = await supabase.auth.getUser();
  const authUserId = auth?.user?.id ?? null;
  const userId = override ?? authUserId;

  if (!userId) {
    return NextResponse.json(
      { ok: false, error: 'No user in auth and no ?userId= override provided.' },
      { status: 401 }
    );
  }

  // Pull user_equipment rows (don’t filter by availability yet)
  const { data: ue, error: ueErr } = await supabase
    .from('user_equipment')
    .select('id, user_id, equipment_id, custom_name, is_available')
    .eq('user_id', userId);

  const ids = (ue ?? []).map(r => r.equipment_id).filter(Boolean);

  // Join to equipment names
  const { data: eq, error: eqErr } = ids.length
    ? await supabase.from('equipment').select('id, name').in('id', ids as string[])
    : { data: [], error: null as any };

  const resolvedAvailable = (ue ?? [])
    .filter(r => r.is_available === true)
    .map(r => eq?.find(e => e.id === r.equipment_id)?.name)
    .filter((n): n is string => Boolean(n));

  return NextResponse.json(
    {
      ok: true,
      auth_user_id: authUserId,
      using_user_id: userId,
      counts: {
        user_equipment: ue?.length ?? 0,
        equipment_joined: eq?.length ?? 0,
        available_names: resolvedAvailable.length,
      },
      resolved_available: resolvedAvailable,
      user_equipment_rows: ue ?? [],
      equipment_rows: eq ?? [],
      warnings: [
        !authUserId && !override ? 'No auth; you are querying as anon. Use ?userId= to override.' : undefined,
        ueErr?.message ? `user_equipment error: ${ueErr.message}` : undefined,
        eqErr?.message ? `equipment join error: ${eqErr.message}` : undefined,
      ].filter(Boolean),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}


