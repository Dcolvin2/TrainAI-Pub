import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function getUserEquipment(userId: string): Promise<string[]> {
  try {
    console.log(`[getUserEquipment] Fetching equipment for user: ${userId}`);
    
    const { data, error } = await supabase
      .from('user_equipment')
      .select('equipment(name)')
      .eq('user_id', userId)
      .eq('is_available', true);

    if (error) {
      console.error('[getUserEquipment] Error fetching equipment:', error);
      throw error;
    }

    // -> ['Barbell', 'Bench', 'Dumbbells']
    const equipment = data?.map((row: any) => row.equipment.name.toLowerCase()) || [];
    
    console.log(`[getUserEquipment] Found equipment:`, equipment);
    return equipment;

  } catch (error) {
    console.error('[getUserEquipment] Error:', error);
    return [];
  }
} 