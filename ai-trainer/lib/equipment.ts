// lib/equipment.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Returns equipment names for a user, only where is_available = true (or null)
export async function getUserEquipmentNames(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('user_equipment')
    .select('equipment:equipment_id(name), is_available')
    .eq('user_id', userId)
    .or('is_available.is.null,is_available.eq.true'); // keeps rows where flag is missing or true

  if (error) throw error;

  return (data ?? [])
    .map(r => {
      // Handle the join result structure properly
      const equipment = r.equipment as any;
      return equipment?.name?.trim();
    })
    .filter((n): n is string => Boolean(n));
}
