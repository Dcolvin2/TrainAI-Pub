import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function getUserEquipment(userId: string): Promise<string[]> {
  try {
    console.log(`[getUserEquipment] Fetching equipment for user: ${userId}`);
    
    const { data: userEquipment, error } = await supabase
      .from('user_equipment')
      .select('equipment_id, custom_name, equipment!inner(name)')
      .eq('user_id', userId);

    if (error) {
      console.error('[getUserEquipment] Error fetching equipment:', error);
      return [];
    }

    const equipment = userEquipment?.map((eq: any) => eq.custom_name || eq.equipment.name) || [];
    
    console.log(`[getUserEquipment] Found equipment:`, equipment);
    return equipment;

  } catch (error) {
    console.error('[getUserEquipment] Error:', error);
    return [];
  }
} 