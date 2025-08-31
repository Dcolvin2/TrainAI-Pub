// lib/catalog.ts
import { createClient } from '@supabase/supabase-js';

function sb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

export type Split = 'pull'|'push'|'legs'|'upper'|'full'|'hiit';

type ExRow = {
  id: string;
  name: string;
  category?: string | null;
  primary_muscle?: string | null;
  movement_pattern?: string | null;
  target_muscles?: string | null;        // JSON string in DB
  equipment_required?: string | null;    // JSON string in DB
};

function parseArr(s?: string | null): string[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    if (Array.isArray(v)) return v.map((x) => String(x));
  } catch {}
  return [];
}

function compat(ex: ReturnType<typeof mapRow>, userEquip: string[]) {
  const have = new Set(userEquip.map((x) => x.toLowerCase()));
  const need = ex.equipment_required.map((x) => x.toLowerCase());

  // empty requirement → always compatible
  if (!need.length) return true;

  // treat bodyweight/band/TRX as broadly available if user has related gear
  const synonyms = {
    bodyweight: ['bodyweight'],
    band: ['band', 'minibands', 'superbands'],
    trx: ['trx', 'suspension'],
  };

  return need.every((req) => {
    if (have.has(req)) return true;
    if (req.includes('bodyweight')) return true;
    if (req.includes('band')) return [...synonyms.band].some((k) => have.has(k));
    if (req.includes('trx') || req.includes('suspension')) return [...synonyms.trx].some((k) => have.has(k));
    return false;
  });
}

function splitMatch(split: Split, ex: ReturnType<typeof mapRow>) {
  const text = `${ex.name} ${ex.movement_pattern ?? ''} ${ex.category ?? ''} ${ex.primary_muscle ?? ''}`.toLowerCase();
  const rx: Record<Split, RegExp> = {
    pull: /(deadlift|hinge|row|pull[\s-]?up|pull[\s-]?down|lat|rear delt|face pull|scap|shrug)/i,
    push: /(bench|press|push[\s-]?up|dip|overhead|triceps|chest)/i,
    legs: /(squat|lunge|hinge|deadlift|step[\s-]?up|hamstring|quad|posterior|calf)/i,
    upper: /(press|row|pull[\s-]?down|pull[\s-]?up|rear delt|face pull|overhead|push[\s-]?up)/i,
    full: /(squat|press|row|hinge|carry|thruster|clean|snatch|burpee|swing)/i,
    hiit: /(interval|sled|rope|swing|burpee|emom|amrap|circuit)/i,
  };
  return rx[split].test(text);
}

function mapRow(r: ExRow) {
  return {
    id: r.id,
    name: r.name,
    category: r.category || undefined,
    primary_muscle: r.primary_muscle || undefined,
    movement_pattern: r.movement_pattern || undefined,
    target_muscles: parseArr(r.target_muscles),
    equipment_required: parseArr(r.equipment_required),
  };
}

export async function fetchCatalog(split: Split, userEquip: string[], limit = 400) {
  const client = sb();
  const { data, error } = await client
    .from('exercises')
    .select('id,name,category,primary_muscle,movement_pattern,target_muscles,equipment_required')
    .limit(limit);

  if (error) throw error;
  const rows = (data || []).map(mapRow);

  // Filter by equipment first
  let candidates = rows.filter((r) => compat(r, userEquip));

  // If we have enough, bias to split; if too few, fall back to equipment-only
  const splitFiltered = candidates.filter((r) => splitMatch(split, r));
  if (splitFiltered.length >= 15) candidates = splitFiltered;

  // De-dup by name and return a slim catalog for the LLM
  const seen = new Set<string>();
  const catalog = candidates.filter((r) => {
    const k = r.name.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });

  return catalog;
}

export async function fetchUserEquipmentNames(userId: string) {
  const client = sb();
  // Try FK join if available
  const tryJoin = await client
    .from('user_equipment')
    .select('equipment_id,is_available,equipment:equipment_id(name)')
    .eq('user_id', userId)
    .eq('is_available', true);

  let names: string[] = [];
  if (!tryJoin.error && Array.isArray(tryJoin.data) && tryJoin.data.length) {
    names = tryJoin.data
      .map((r: any) => r?.equipment?.name)
      .filter(Boolean)
      .map((s: string) => s.toLowerCase());
  } else {
    // Fallback: two-step lookup
    const { data: ue } = await client
      .from('user_equipment')
      .select('equipment_id,is_available')
      .eq('user_id', userId)
      .eq('is_available', true);

    const ids = (ue || []).map((r: any) => r.equipment_id).filter(Boolean);
    if (ids.length) {
      const { data: eq } = await client.from('equipment').select('id,name').in('id', ids);
      names = (eq || []).map((r: any) => String(r.name).toLowerCase());
    }
  }

  // Always unique + friendly
  return [...new Set(names)];
}

export async function fetchMobilityByTargets(targets: string[]) {
  // Pull a generous pool; we'll filter/score in the LLM prompt
  const client = sb();
  const { data, error } = await client
    .from('exercises')
    .select('name, category, primary_muscle, exercise_phase')
    .ilike('category', '%mobility%'); // or use flags if you added them

  if (error) {
    console.error('fetchMobilityByTargets error', error);
    return { byTarget: {}, all: [] as string[] };
  }

  const rows = (data || []);
  const allNames = new Set<string>();
  const byTarget: Record<string, string[]> = {};

  const add = (t: string, n: string) => {
    const key = t.toLowerCase();
    if (!byTarget[key]) byTarget[key] = [];
    if (!byTarget[key].some(x => x.toLowerCase() === n.toLowerCase())) byTarget[key].push(n);
    allNames.add(n);
  };

  for (const r of rows) {
    const name = String(r?.name || '').trim();
    if (!name) continue;
    // try to map by primary_muscle first, then name heuristics
    const prim = Array.isArray(r?.primary_muscle) ? r.primary_muscle : [r?.primary_muscle].filter(Boolean);
    for (const p of prim) add(String(p), name);

    const n = name.toLowerCase();
    if (/hamstring/.test(n)) add('hamstring', name);
    if (/quad|quadricep/.test(n)) add('quad', name);
    if (/glute|piriformis/.test(n)) add('glute', name);
    if (/calf|gastroc|soleus/.test(n)) add('calf', name);
    if (/hip\s*flexor|psoas/.test(n)) add('hip flexor', name);
    if (/lat/.test(n)) add('lat', name);
    if (/upper\s*back|t-?spine|thoracic/.test(n)) add('upper back', name);
    if (/pec|chest/.test(n)) add('pec', name);
    if (/shoulder|delt/.test(n)) add('shoulder', name);
    if (/bicep/.test(n)) add('biceps', name);
    if (/tricep/.test(n)) add('triceps', name);
  }

  // Include a small, safe generic set in case a target is empty
  const SAFE_DEFAULTS = [
    "Seated Hamstring Stretch",
    "Hip Flexor Stretch",
    "Calf Wall Stretch",
    "Figure-4 Glute Stretch",
    "Lat Stretch Against Wall",
    "Doorway Pec Stretch",
    "Child's Pose",
    "Thread the Needle",
  ];
  for (const t of targets) if (!byTarget[t?.toLowerCase()]?.length) byTarget[t?.toLowerCase()] = SAFE_DEFAULTS;

  return { byTarget, all: Array.from(allNames) };
}
