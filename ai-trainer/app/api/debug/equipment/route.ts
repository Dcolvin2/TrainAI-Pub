import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 1) user_equipment (tolerate no is_available)
  const { data: ue, error: ueErr } = await supabase
    .from('user_equipment')
    .select('equipment_id, is_available')
    .eq('user_id', user.id);

  if (ueErr) return NextResponse.json({ step: 'user_equipment', error: ueErr.message }, { status: 400 });

  const eqIds = (ue ?? [])
    .filter((r: any) => r?.equipment_id && (r.is_available === undefined || r.is_available === null || r.is_available === true))
    .map((r: any) => r.equipment_id);

  const { data: eq, error: eqErr } = await supabase
    .from('equipment')
    .select('id, name')
    .in('id', eqIds.length ? eqIds : ['00000000-0000-0000-0000-000000000000']); // prevent empty .in()

  if (eqErr) return NextResponse.json({ step: 'equipment', error: eqErr.message }, { status: 400 });

  // 2) peek at exercises columns to see which field exists
  const { data: ex, error: exErr } = await supabase.from('exercises').select('*').limit(1);
  if (exErr) return NextResponse.json({ step: 'exercises', error: exErr.message }, { status: 400 });

  const sample = ex?.[0] ?? {};
  const hasEquipmentRequired = 'equipment_required' in sample;
  const hasRequiredEquipment = 'required_equipment' in sample;

  return NextResponse.json({
    user_id: user.id,
    available_equipment_names: (eq ?? []).map((e: any) => e.name),
    exercises_field_detected: hasEquipmentRequired ? 'equipment_required' : hasRequiredEquipment ? 'required_equipment' : 'none',
  });
}


