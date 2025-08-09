import { getSupabaseAdmin } from './supabaseAdmin';

export async function getUserEquipmentNames(userId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data: userRows, error: ueErr } = await supabaseAdmin
    .from('user_equipment')
    .select('equipment_id, custom_name, is_available')
    .eq('user_id', userId);

  if (ueErr) return { names: [], rows: [], warn: [`user_equipment error: ${ueErr.message}`] } as const;
  if (!userRows || userRows.length === 0) return { names: [], rows: [], warn: ['no user_equipment rows'] } as const;

  const filtered = userRows.filter((r: any) => (r.is_available ?? true) !== false);

  const ids = filtered.map((r: any) => r.equipment_id).filter(Boolean);
  if (ids.length === 0) return { names: [], rows: filtered, warn: ['user_equipment had no equipment_id'] } as const;

  const { data: eqRows, error: eqErr } = await supabaseAdmin
    .from('equipment')
    .select('id,name')
    .in('id', ids);

  if (eqErr) return { names: [], rows: filtered, warn: [`equipment error: ${eqErr.message}`] } as const;

  const byId = new Map(eqRows.map((e: any) => [e.id, e.name]));
  const names = filtered
    .map((r: any) => byId.get(r.equipment_id))
    .filter(Boolean) as string[];

  return { names, rows: filtered, warn: [] as string[] } as const;
}


