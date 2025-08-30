import { createClient } from '@supabase/supabase-js';
import type { UserPrefs } from './prefs';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const sb = createClient(url, key);

// Never in cooldown
const STRENGTH_OR_HI = new RegExp(
  [
    'burpee','sprint','thruster','box\\s*jump','mountain\\s*climber','high\\s*knees','jump(ing)?\\s*jacks?',
    'swing','clean','snatch','press','raise','curl','row','pull\\s*-?down','fly','extension','pullover',
    'deadlift','squat','lunge'
  ].join('|'),
  'i'
);

// Must look like stretch/mobility
const STRETCH = /(stretch|mobility|pose|pigeon|child'?s|hamstring|quad|quadriceps|calf|gastroc|soleus|lat|pec|chest|hip\s*flexor|psoas|thoracic|t-?spine|breathing|openers|thread\s*the\s*needle|world'?s\s*greatest)/i;

function esc(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function buildTargetRegex(targets: string[] = []) {
  const words = (targets||[]).flatMap(t => {
    switch (t.toLowerCase()) {
      case 'lat': return ['lat','lats','latissimus'];
      case 'upper back': return ['upper back','t-spine','thoracic'];
      case 'thoracic': return ['thoracic','t-spine'];
      case 'hip flexor': return ['hip flexor','psoas','hip'];
      case 'pec': return ['pec','chest'];
      case 'shoulder': return ['shoulder','delt','deltoid'];
      case 'quad': return ['quad','quadriceps'];
      case 'hamstring': return ['hamstring','posterior chain'];
      case 'calf': return ['calf','gastroc','soleus'];
      case 'glute': return ['glute','piriformis'];
      case 'triceps': return ['triceps','tricep'];
      case 'biceps': return ['biceps','bicep'];
      default: return [t];
    }
  }).map(esc);
  return words.length ? new RegExp(words.join('|'), 'i') : null;
}

export async function sanitizeCooldown(
  holder: { cooldown: any[] },
  _userId: string,
  prefs: UserPrefs,
  targets: string[] = []       // <<< NEW
) {
  const targetRe = buildTargetRegex(targets);
  const desired = (prefs?.cooldown ?? 'stretch_only') as 'stretch_only'|'stretch_priority'|'any';
  const banned = (prefs?.banned_exercises || []).map(x => x.toLowerCase());

  const src = Array.isArray(holder?.cooldown) ? holder.cooldown : [];
  const keep: any[] = [];

  for (const it of src) {
    const n = String(it?.name || '').trim();
    if (!n) continue;
    if (banned.some(b => n.toLowerCase().includes(b))) continue;
    if (STRENGTH_OR_HI.test(n)) continue;
    if (desired !== 'any' && !STRETCH.test(n)) continue;
    // must match targets unless it's general breathing/ t-spine work
    if (targetRe && !/breath|diaphragm|thoracic|t-?spine/i.test(n) && !targetRe.test(n)) continue;
    keep.push({ ...it, duration: it?.duration || '45–60s' });
  }

  if (keep.length >= 2) { holder.cooldown = keep.slice(0, 3); return holder; }

  // Backfill from catalog
  const { data } = await sb.from('exercises').select('name').limit(150);
  const pool = (data || [])
    .map(r => String(r?.name || ''))
    .filter(n =>
      STRETCH.test(n) &&
      !STRENGTH_OR_HI.test(n) &&
      (!targetRe || targetRe.test(n) || /breath|diaphragm|thoracic|t-?spine/i.test(n))
    );

  const fills: any[] = [];
  for (const n of pool) {
    if (fills.length >= 3) break;
    if (!keep.some(k => k.name.toLowerCase() === n.toLowerCase()))
      fills.push({ name: n, duration: '45–60s' });
  }

  // Target-aware safe fallbacks
  const generics = [
    { name: "Seated Hamstring Stretch", duration: '45–60s' },
    { name: "Hip Flexor Stretch", duration: '45–60s' },
    { name: "Calf Wall Stretch", duration: '45–60s' },
    { name: "Figure-4 Glute Stretch", duration: '45–60s' },
    { name: "Lat Stretch Against Wall", duration: '45–60s' },
    { name: "Doorway Pec Stretch", duration: '45–60s' },
    { name: "Child's Pose", duration: '45–60s' },
    { name: "Thread the Needle", duration: '45–60s' },
  ];
  for (const g of generics) {
    if (fills.length >= 3) break;
    if (targetRe && !/breath|thoracic|t-?spine/i.test(g.name) && !targetRe.test(g.name)) continue;
    if (!fills.some(f => f.name.toLowerCase() === g.name.toLowerCase()))
      fills.push(g);
  }

  holder.cooldown = [...keep, ...fills].slice(0, 3);
  return holder;
}
