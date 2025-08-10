import { admin } from './supabaseAdmin';

export async function getEquipmentNamesForUser(userId: string): Promise<string[]> {
  // join user_equipment → equipment
  const { data, error } = await admin
    .from('user_equipment')
    .select('is_available, equipment:equipment_id ( name )')
    .eq('user_id', userId);

  if (error) {
    // Fallback: try without is_available column
    const res = await admin
      .from('user_equipment')
      .select('equipment:equipment_id ( name )')
      .eq('user_id', userId);
    if (res.error) throw res.error;
    return (res.data || [])
      .map((r: any) => r.equipment?.name)
      .filter(Boolean)
      .sort();
  }

  return (data || [])
    .filter((r: any) => r.is_available !== false) // treat null/true as available
    .map((r: any) => r.equipment?.name)
    .filter(Boolean)
    .sort();
}
