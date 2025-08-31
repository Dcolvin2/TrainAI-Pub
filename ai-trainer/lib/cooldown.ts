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
}) {
  const sampleLimit = opts.sampleLimit ?? 80;
  const recentDays = opts.recentDays ?? 14;

  // 1) Candidate cooldown/mobility/stretch rows from DB
  const { data: exRows, error: exErr } = await supabase
    .from('exercises')
    .select('name, category, primary_muscle, target_muscles, exercise_phase')
    .in('exercise_phase', ['cooldown', 'warmup'])
    .limit(sampleLimit);

  if (exErr) throw exErr;

  const wanted = (opts.focusHints ?? []).map(norm);

  const pool = (exRows ?? []).filter((r) => {
    const cat = norm(r.category ?? '');
    const pm = norm(r.primary_muscle ?? '');
    const tms = (r.target_muscles ?? []).map((x: unknown) => norm(String(x)));
    const isMobilityish = /mobility|stretch|cooldown|yoga|flow|flex|release|breath/.test(cat);
    const hitsTarget = wanted.length
      ? wanted.some((t) => pm.includes(t) || tms.some((m) => m.includes(t)))
      : true;
    return isMobilityish && hitsTarget;
  });

  // Dedup by name
  const seen = new Set<string>();
  const dbCandidates = pool
    .map((r) => ({ name: r.name as string }))
    .filter((r) => {
      const key = norm(r.name);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  // 2) Recently used cooldown names (avoid repeats)
  const sinceISO = new Date(Date.now() - recentDays * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const { data: recentLogs, error: recErr } = await supabase
    .from('workout_log_entries')
    .select('exercise_name, created_at')
    .gte('created_at', sinceISO);

  if (recErr) throw recErr;

  const recentNames = new Set<string>(
    (recentLogs ?? [])
      .map((r) => r.exercise_name)
      .filter(Boolean)
      .map((n) => norm(n as string)),
  );

  return { dbCandidates, recentNames };
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

// Fisher-Yates shuffle (small, dependency-free)
export function shuffleInPlace<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
