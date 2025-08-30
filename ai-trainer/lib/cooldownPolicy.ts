// lib/cooldownPolicy.ts
import { createClient } from '@supabase/supabase-js';
import type { UserPrefs } from './prefs';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const sb = createClient(url, key);

// drop HIIT/strength from cooldown
const HI = /(burpee|sprint|thruster|box\s*jump|mountain\s*climber|high\s*knees|jumping\s*jacks|swing|clean|snatch|press|raise|curl|row)/i;
// keep only stretches/mobility/breathing
const STRETCH = /(stretch|mobility|pose|pigeon|child'?s|hamstring|quad|calf|lat|pec|hip\s*flexor|thoracic|breathing|openers|thread\s*the\s*needle|world'?s\s*greatest)/i;

export async function sanitizeCooldown(
  holder: { cooldown: any[] },
  _userId: string,
  prefs: UserPrefs
) {
  const desired = (prefs?.cooldown ?? 'stretch_only') as 'stretch_only'|'stretch_priority'|'any';
  const banned = (prefs?.banned_exercises || []).map(x => x.toLowerCase());

  const src = Array.isArray(holder?.cooldown) ? holder.cooldown : [];
  const keep: any[] = [];

  for (const it of src) {
    const n = String(it?.name || '').trim();
    if (!n) continue;
    if (banned.some(b => n.toLowerCase().includes(b))) continue;
    if (HI.test(n)) continue;
    if (desired !== 'any' && !STRETCH.test(n)) continue; // require stretch/mobility by default
    keep.push({ ...it, duration: it?.duration || '45–60s' });
  }

  if (keep.length >= 2) {
    holder.cooldown = keep.slice(0, 3);
    return holder;
  }

  // Fill from catalog
  const { data } = await sb.from('exercises').select('name').limit(80);
  const pool = (data || [])
    .map(r => String(r.name || ''))
    .filter(n => STRETCH.test(n) && !banned.some(b => n.toLowerCase().includes(b)));

  const fills: any[] = [];
  for (const n of pool) {
    if (fills.length >= 3) break;
    if (!keep.some(k => k.name.toLowerCase() === n.toLowerCase()))
      fills.push({ name: n, duration: '45–60s' });
  }

  // Safe generic fallbacks
  const generics = [
    { name: "Child's Pose", duration: '45–60s' },
    { name: 'Doorway Pec Stretch', duration: '45–60s' },
    { name: 'Seated Hamstring Stretch', duration: '45–60s' },
    { name: 'Hip Flexor Stretch', duration: '45–60s' },
    { name: 'Lat Stretch Against Wall', duration: '45–60s' },
    { name: 'Thread the Needle', duration: '45–60s' },
  ];
  for (const g of generics) {
    if (fills.length >= 3) break;
    if (!fills.some(f => f.name.toLowerCase() === g.name.toLowerCase()))
      fills.push(g);
  }

  holder.cooldown = [...keep, ...fills].slice(0, 3);
  return holder;
}
