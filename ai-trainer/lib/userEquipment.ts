import { getSupabaseAdmin } from './supabaseAdmin';

export async function getUserEquipmentNames(userId: string) {
  const supabase = getSupabaseAdmin();

  // join to equipment table; only items marked available
  const { data, error } = await supabase
    .from('user_equipment')
    .select('is_available, equipment:equipment_id(name)')
    .eq('user_id', userId)
    .eq('is_available', true);

  if (error) throw error;

  return (data ?? [])
    .map((r: any) => r?.equipment?.name)
    .filter(Boolean)
    .sort();
}


