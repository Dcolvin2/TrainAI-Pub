// lib/cooldownPolicy.ts
import { createClient } from '@supabase/supabase-js';
import type { UserPrefs } from './prefs';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const sb = createClient(url, key);

// loose matches
const HI_WORDS = /(burpee|sprint|thruster|box\s*jump|mountain\s*climber|high\s*knees|jumping\s*jacks)/i;
const STRETCH_WORDS = /(stretch|mobility|pose|pigeon|child'?s\s*pose|hamstring|quad|calf|lat|pec|hip\s*flexor|thoracic|breathing)/i;

const isHi = (name: string) => HI_WORDS.test(name || '');
const isStretchy = (name: string) => STRETCH_WORDS.test(name || '');

export async function sanitizeCooldown(workout: any, userId: string, prefs: UserPrefs) {
  const desired = prefs.cooldown || 'stretch_priority';
  const banned = (prefs.banned_exercises || []).map(x => x.toLowerCase());

  const src = Array.isArray(workout?.cooldown) ? workout.cooldown : [];
  const keep: any[] = [];

  for (const it of src) {
    const nm = String(it?.name || '');
    if (banned.some(b => nm.toLowerCase().includes(b))) continue;
    if (desired === 'stretch_only' && !isStretchy(nm)) continue;
    if (isHi(nm)) continue;
    keep.push(it);
  }

  // Enough good items? keep them.
  if (keep.length >= Math.min(src.length || 2, 3)) {
    workout.cooldown = keep;
    return workout;
  }

  // Fill with stretch/mobility options from your catalog
  const { data } = await sb
    .from('exercises')
    .select('name,category,movement_pattern')
    .limit(40);

  const pool = (data || [])
    .map(r => String(r.name || ''))
    .filter(n => isStretchy(n));

  const fills = pool
    .filter(n => !banned.some(b => n.toLowerCase().includes(b)))
    .slice(0, Math.max(2, src.length || 2))
    .map(n => ({ name: n, duration: '45–60s' }));

  workout.cooldown = [...keep, ...fills].slice(0, Math.max(2, src.length || 2));
  return workout;
}
