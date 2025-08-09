export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getUserEquipmentNames } from '@/lib/userEquipment';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const user = url.searchParams.get('user');
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Missing ?user=<uuid>' }, { status: 400 });
  }

  const { names, rows, warn } = await getUserEquipmentNames(user);

  return NextResponse.json({
    ok: true,
    user,
    counts: { user_equipment: rows.length, equipment_names: names.length },
    equipment_names: names,
    warnings: warn,
  });
}


