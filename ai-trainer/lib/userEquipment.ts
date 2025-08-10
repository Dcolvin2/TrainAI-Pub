// lib/userEquipment.ts
import { getSupabaseAdmin } from './supabaseAdmin';

type EquipObj = { name?: string };
type EquipRef = EquipObj | EquipObj[] | null;

type UserEquipmentRow = {
  id: string;
  user_id: string;
  is_available: boolean | null;
  // Supabase may surface the FK join as an object OR an array — handle both.
  equipment?: EquipRef;
};

function pickEquipmentName(eq: EquipRef): string | null {
  if (!eq) return null;
  if (Array.isArray(eq)) return eq[0]?.name ?? null;
  return eq.name ?? null;
}

/**
 * Detailed version used by /api/debug/equipment
 * Returns names + raw rows so you can inspect what came back.
 */
export async function getUserEquipmentNamesDetailed(userId: string) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('user_equipment')
    .select('id,user_id,is_available,equipment:equipment_id(name)')
    .eq('user_id', userId);

  if (error) throw error;

  const rows = (data ?? []) as unknown as UserEquipmentRow[];

  const names = rows
    // treat null as available; only filter out explicit false
    .filter(r => r.is_available !== false)
    .map(r => pickEquipmentName(r.equipment ?? null))
    .filter((n): n is string => !!n)
    // de-dupe
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort();

  return { names, rows, warn: [] as string[] };
}

/**
 * Simple helper used elsewhere — just the list of names.
 */
export async function getUserEquipmentNames(userId: string) {
  const { names } = await getUserEquipmentNamesDetailed(userId);
  return names;
}


