// lib/coach.ts
import type { SimpleSet } from './history';

export function buildCoachNote(opts: {
  split: string;
  minutes: number;
  mainLift: string;
  history: { recent?: SimpleSet; e1rm?: number | null; trendUp?: boolean };
  equipment?: string[];
  prefs?: { cooldown?: string };
}) {
  const { split, minutes, mainLift, history, equipment = [], prefs } = opts;
  const splitTitle = split ? `${split.toUpperCase()} day` : 'Training day';

  // If no history yet
  if (!history?.recent) {
    return `${splitTitle}. Main lift: ${mainLift || '—'}. First time logging this pattern—let's set a baseline today. Aim for smooth reps, RPE 7–8, and leave 1–2 reps in the tank. We'll progress next session.`;
  }

  const { date, actual_weight, reps, rpe } = history.recent;
  const e1rmTxt = history.e1rm ? ` (~e1RM ${history.e1rm} lb)` : '';
  const trendTxt = history.trendUp
    ? `You nudged progress last session—nice.`
    : `Let's push for a small win today.`;

  // Simple next-step target: +1 rep or +2.5–5lb
  const nextCue =
    actual_weight && reps
      ? `Try ${actual_weight} lb for ${Number(reps) + 1} reps, or add 2.5–5 lb and keep reps steady.`
      : `Build to a crisp top set around RPE 8.`;

  // Cooldown preference hint, if any
  const cdHint =
    prefs?.cooldown === 'stretch_only' || prefs?.cooldown === 'stretch_priority'
      ? `We'll finish with mobility—no HIIT in the cooldown.`
      : `We'll finish with a short cooldown.`

  return `${splitTitle}. Main lift: ${mainLift}. Last time (${date.slice(0, 10)}): ${actual_weight ?? '—'} lb × ${reps ?? '—'}${rpe ? ` @ RPE ${rpe}` : ''}${e1rmTxt}. ${trendTxt} ${nextCue} ${cdHint}`;
}
