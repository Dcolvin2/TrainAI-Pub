// lib/prefs.ts
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const sb = createClient(url, key);

export type UserPrefs = {
  cooldown?: 'stretch_only' | 'stretch_priority' | 'any';
  banned_exercises?: string[]; // e.g., ["burpee"]
};

export async function getUserPrefs(userId: string): Promise<UserPrefs> {
  if (!userId) return { cooldown: 'stretch_priority', banned_exercises: [] };
  const { data } = await sb.from('user_preferences').select('prefs').eq('user_id', userId).single();
  return { cooldown: 'stretch_priority', banned_exercises: [], ...(data?.prefs || {}) };
}

export async function mergeUserPrefs(userId: string, patch: Partial<UserPrefs>) {
  if (!userId) return;
  const { data } = await sb
    .from('user_preferences')
    .upsert({ user_id: userId, prefs: patch, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    .select()
    .single();
  return data;
}
