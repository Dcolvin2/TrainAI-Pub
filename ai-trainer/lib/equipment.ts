// lib/equipment.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function getUserEquipmentNames(userId: string): Promise<string[]> {
  // 1) pull user_equipment rows
  const { data: ue, error: ueErr } = await supabase
    .from('user_equipment')
    .select('equipment_id, is_available')
    .eq('user_id', userId)
    .eq('is_available', true);

  if (ueErr || !ue || ue.length === 0) return [];

  const ids = ue.map(r => r.equipment_id).filter(Boolean);
  if (!ids.length) return [];

  // 2) pull equipment names
  const { data: eq, error: eqErr } = await supabase
    .from('equipment')
    .select('id, name')
    .in('id', ids);

  if (eqErr || !eq) return [];

  // normalize names
  return eq.map(e => (e.name || '').trim()).filter(Boolean);
}
