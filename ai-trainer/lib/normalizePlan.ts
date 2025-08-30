// lib/normalizePlan.ts
import { canonicalSplit, isHiit, isMainLiftForSplit, pickFirstAllowedMain } from "@/lib/trainingRules";

export type NormalizedItem = {
  name: string;
  sets: string;
  reps: string;
  duration?: string;
  instruction?: string;
  isAccessory: boolean;
  isMain: boolean;
};

export type NormalizedPlan = {
  warmup: NormalizedItem[];
  main: NormalizedItem[];
  cooldown: NormalizedItem[];
  title: string;
  totalMinutes?: number;
  mainLiftName?: string;
  split?: string;              // <- carry split through
  showAccessoryLabels?: boolean; // <- for HIIT = false
};

export function normalizePlan(plan: any): NormalizedPlan | null {
  if (!plan) return null;

  const normalizeItem = (item: any, isAccessory: boolean = false, isMain: boolean = false): NormalizedItem => {
    const sets = item?.sets != null ? String(item.sets) : '3';
    const reps = item?.reps != null ? String(item.reps) : '8-12';
    const duration = item?.duration != null ? String(item.duration) : undefined;
    
    return {
      name: item?.name || 'Exercise',
      sets,
      reps,
      duration,
      instruction: item?.instruction || '',
      isAccessory,
      isMain,
    };
  };

  // Handle workout structure
  if (plan.workout) {
    const warmup = (plan.workout.warmup || []).map((item: any) => normalizeItem(item, true, false));
    const main = (plan.workout.main || []).map((item: any, index: number) => 
      normalizeItem(item, false, index === 0) // First main exercise gets isMain=true
    );
    const cooldown = (plan.workout.cooldown || []).map((item: any) => normalizeItem(item, true, false));

    return {
      warmup,
      main,
      cooldown,
      title: plan.name || 'Workout',
      totalMinutes: plan.duration_min || plan.est_total_minutes,
    };
  }

  // Handle plan.phases structure
  if (plan.phases) {
    const getPhaseItems = (phaseName: string) => {
      const phase = plan.phases.find((p: any) => p.phase === phaseName);
      return (phase?.items || []).map((item: any) => normalizeItem(item, true, false));
    };

    const warmup = [...getPhaseItems('prep'), ...getPhaseItems('activation')];
    let main: NormalizedItem[] = getPhaseItems('strength').map((item: any, index: number) => ({
      ...item,
      isAccessory: false,
      isMain: index === 0, // First strength exercise gets isMain=true
    }));
    const cooldown = getPhaseItems('cooldown');

    // Try to preserve split from input if present (optional extension to Plan)
    const maybeSplit = (plan as any)?.split as string | undefined;
    const split = canonicalSplit(maybeSplit);
    const hiit = isHiit(split);

    // Enforce main-lift-first (except HIIT)
    if (!hiit) {
      // Mark any item that's one of the allowed main lifts as non-accessory; others become accessory
      main = main.map((m: NormalizedItem, idx: number) => ({
        ...m,
        isAccessory: !isMainLiftForSplit(m.name, split),
      }));
      const haveMain = main.some(m => !m.isAccessory);
      if (!haveMain) {
        const injected = pickFirstAllowedMain(split);
        if (injected) {
          // Inject a default main lift at top if none present
          main = [{ name: injected, sets: "3", reps: "5", instruction: "", isAccessory: false, isMain: true }, ...main];
        }
      }
    } else {
      // HIIT: don't show accessory/main labels in the UI
      main = main.map((m: NormalizedItem) => ({ ...m, isAccessory: false }));
    }

    const mainLiftName = hiit ? undefined : (main.find(i => !i.isAccessory)?.name ?? main[0]?.name);

    return {
      warmup,
      main,
      cooldown,
      title: plan.name || 'Workout',
      totalMinutes: plan.duration_min || plan.est_total_minutes,
      mainLiftName,
      split,
      showAccessoryLabels: !hiit,
    };
  }

  return null;
}

export function buildChatSummary(plan: NormalizedPlan): string {
  const lines: string[] = [];
  
  lines.push(`${plan.title}${plan.totalMinutes ? ` — ${plan.totalMinutes} min` : ''}`);

  const addSection = (label: string, items: NormalizedItem[]) => {
    if (!items?.length) return;
    
    lines.push('');
    lines.push(`${label}:`);
    items.forEach((item, i) => {
      const sets = item.sets ? `${item.sets}×` : '';
      const repsOrDur = item.duration || item.reps || '';
      const mainBadge = item.isMain ? ' (Main Lift)' : '';
      const cue = item.instruction ? ` — ${item.instruction}` : '';
      lines.push(`${i + 1}. ${item.name}${mainBadge} ${sets}${repsOrDur}${cue}`.trim());
    });
  };

  addSection('🔥 Warm-up', plan.warmup);
  addSection('💪 Main', plan.main);
  addSection('🧘 Cool-down', plan.cooldown);

  return lines.join('\n');
}
