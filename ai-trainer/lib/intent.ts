export type Intent =
  | 'make_workout'
  | 'modify_workout'
  | 'explain_or_coach'
  | 'celebrity_inspired'
  | 'log_or_history'
  | 'unknown';

export type Parsed = {
  intent: Intent;
  duration_min?: number;
  modality?: 'kettlebell'|'barbell'|'dumbbell'|'bodyweight'|'mixed';
  focus?: string;
  athleteName?: string;
};

const celebNames = ['rob gronkowski','joe holder','gronk','arnold','froning','fraser','toomey'];

export function quickParse(q: string): Parsed {
  const s = q.toLowerCase();
  const out: Parsed = { intent: 'unknown' };

  // modality
  if (s.includes('kettlebell') || s.includes('kb')) out.modality = 'kettlebell';
  else if (s.includes('barbell') || s.includes('bb')) out.modality = 'barbell';
  else if (s.includes('dumbbell') || s.includes('db')) out.modality = 'dumbbell';
  else if (s.includes('bodyweight')) out.modality = 'bodyweight';

  // duration
  const m = s.match(/(\d{2,3})\s?(min|minutes|minute)/);
  if (m) out.duration_min = Math.max(10, Math.min(120, parseInt(m[1],10)));

  // celebrity
  const found = celebNames.find(n => s.includes(n));
  if (found) { out.intent = 'celebrity_inspired'; out.athleteName = found; return out; }

  if (/(workout|wod|session|program)/.test(s)) out.intent = 'make_workout';
  if (/(swap|no |replace|shorter|longer|change)/.test(s)) out.intent = 'modify_workout';
  if (/(how to|what is|why|explain|form)/.test(s)) out.intent = 'explain_or_coach';
  if (/(log|history|what did i do)/.test(s)) out.intent = 'log_or_history';

  if (/(upper|lower|full body|push|pull|legs|conditioning|cardio)/.test(s)) out.focus = s;
  return out;
}
