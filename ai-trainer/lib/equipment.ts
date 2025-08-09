// lib/equipment.ts
import { SupabaseClient } from '@supabase/supabase-js';

export async function getAvailableEquipmentNames(
  supabase: SupabaseClient,
  userId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from('user_equipment')
    .select('is_available, equipment:equipment_id(name)')
    .eq('user_id', userId)
    .eq('is_available', true);

  if (error || !data) return [];
  
  // Handle the join result structure properly
  return data
    .map(row => {
      const equipment = row.equipment as any;
      return equipment?.name;
    })
    .filter((name): name is string => Boolean(name));
}
