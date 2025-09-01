// lib/cooldown.ts
import { supabase } from '@/lib/supabase';

export type CoolItem = { name: string; duration?: string; reps?: string; instruction?: string };

function norm(s: unknown) {
  return String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function focusFromSplit(split?: string): string[] {
  const s = norm(split);
  if (s.includes('leg') || s.includes('lower')) return ['legs', 'quads', 'hamstrings', 'glutes', 'hips', 'calves'];
  if (s.includes('push')) return ['chest', 'shoulders', 'triceps'];
  if (s.includes('pull')) return ['back', 'lats', 'biceps', 'posterior chain'];
  if (s.includes('upper')) return ['chest', 'shoulders', 'back', 'arms'];
  if (s.includes('hiit')) return [];
  return [];
}

export async function fetchCooldownContext(opts: {
  focusHints: string[];
  sampleLimit?: number;
  recentDays?: number;
  userId?: string;
}) {
  const sampleLimit = opts.sampleLimit ?? 120;
  const recentDays = opts.recentDays ?? 14;

  // 1) Grab all cooldown/warmup rows (we'll rank, not over-filter)
  const { data: exRows, error: exErr } = await supabase
    .from('exercises')
    .select('name, category, primary_muscle, target_muscles, exercise_phase')
    .in('exercise_phase', ['cooldown', 'warmup'])
    .limit(sampleLimit);

  if (exErr) throw exErr;

  const wanted: string[] = (opts.focusHints ?? []).map((v) => norm(v));

  // Dedup by name
  const seen = new Set<string>();
  const all = (exRows ?? []).reduce<{ name: string; primary?: string; targets?: string[] }[]>((acc, r) => {
    const nm = String(r.name ?? '').trim();
    if (!nm) return acc;
    const key = norm(nm);
    if (seen.has(key)) return acc;
    seen.add(key);
    acc.push({
      name: nm,
      primary: typeof r.primary_muscle === 'string' ? r.primary_muscle : undefined,
      targets: Array.isArray(r.target_muscles) ? r.target_muscles.map((x) => String(x ?? '')) : [],
    });
    return acc;
  }, []);

  // Score by focus hints (but keep all)
  const ranked = all
    .map((row) => {
      const pm = norm(row.primary);
      const tms = (row.targets ?? []).map((x) => norm(x));
      let score = 0;
      for (const h of wanted) {
        if (!h) continue;
        if (pm.includes(h)) score += 2;
        if (tms.some((m) => m.includes(h))) score += 1;
      }
      return { ...row, _score: score };
    })
    .sort((a, b) => b._score - a._score);

  // 2) Recently used cooldown names (avoid repeats)
  const sinceISO = new Date(Date.now() - recentDays * 24 * 3600 * 1000).toISOString().slice(0, 10);
  let recentQuery = supabase
    .from('workout_log_entries')
    .select('exercise_name, created_at')
    .gte('created_at', sinceISO);
  if (opts.userId) recentQuery = recentQuery.eq('user_id', opts.userId);
  const { data: recentLogs, error: recErr } = await recentQuery;

  if (recErr) throw recErr;

  const recentNames = new Set<string>(
    (recentLogs ?? [])
      .map((r) => r.exercise_name)
      .filter(Boolean)
      .map((n) => norm(n as string)),
  );

  // Return both the ranked and the full pool for diagnostics/fallback
  return {
    rankedCandidates: ranked.map((r) => ({ name: r.name })), // score already applied via sort
    allCandidates: all.map((r) => ({ name: r.name })),       // unranked backup pool
    recentNames,
  };
}

export function mapLLMToPlanItems(items: CoolItem[]) {
  return (items ?? [])
    .map((i) => ({
      name: i.name?.trim(),
      duration: i.duration ?? '30–60s',
      reps: i.reps ?? undefined,
      instruction: i.instruction ?? '',
    }))
    .filter((i) => i.name && i.name.length > 1);
}

export function shuffleInPlace<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
