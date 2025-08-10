import type { Plan } from './schemas';

const BLOCKED = new Set(['Snatch','Power Clean','Hang Clean','Clean and Jerk','Clean & Jerk','Clean']);

const SWAPS: Record<string,string[]> = {
  'Snatch': ['Kettlebell Swing','Trap Bar Deadlift'],
  'Power Clean': ['Trap Bar Deadlift','Kettlebell Swing'],
  'Hang Clean': ['Romanian Deadlift','High Pull (light)'],
  'Clean and Jerk': ['Front Squat','Overhead Press'],
  'Clean & Jerk': ['Front Squat','Overhead Press'],
  'Clean': ['Trap Bar Deadlift','Romanian Deadlift'],
};

export function sanitize(plan: Plan) {
  const blocked: string[] = [];
  for (const ph of plan.phases) {
    for (const it of ph.items) {
      if (BLOCKED.has(it.name)) {
        blocked.push(it.name);
        const alt = (SWAPS[it.name] && SWAPS[it.name][0]) || 'Kettlebell Swing';
        it.name = alt;
        it.instruction = (it.instruction || '') + ' (auto-swapped for safety)';
        it.substitutions = SWAPS[it.name] || [];
      }
    }
  }
  return { plan, blocked };
}
