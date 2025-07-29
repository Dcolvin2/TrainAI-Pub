import { QuickEntry } from '@/utils/parseQuickEntry';
import { LocalSet } from '@/lib/workoutStore';

export function quickEntryHandler(
  entries: QuickEntry[], 
  firstPostWarmupExercise: string | null, 
  addLocalSet: (set: LocalSet) => void
): void {
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