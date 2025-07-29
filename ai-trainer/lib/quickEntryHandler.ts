import { QuickEntry } from '@/utils/parseQuickEntry';

export function quickEntryHandler(entries: QuickEntry[], firstPostWarmupExercise: string | null, addLocalSet: (set: any) => void): void {
  if (!firstPostWarmupExercise) {
    console.error('No exercise found after warm-up');
    return;
  }

  entries.forEach(({ setNumber, reps, weight }) => {
    addLocalSet({
      exerciseName: firstPostWarmupExercise,
      setNumber,
      reps,
      actualWeight: weight,
      completed: true
    });
  });

  console.log(`Added ${entries.length} set${entries.length > 1 ? 's' : ''} to ${firstPostWarmupExercise} — will save when you finish workout 🏁`);
} 