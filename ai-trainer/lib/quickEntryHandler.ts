import { QuickEntry } from '@/utils/parseQuickEntry';
import { LocalSet } from '@/lib/workoutStore';

export function quickEntryHandler(
  entries: QuickEntry[], 
  firstPostWarmupExercise: string | null, 
  addLocalSet: (set: LocalSet) => void,
  addChatMessage?: (message: { id: string; role: 'assistant'; content: string; createdAt: string }) => void
): void {
  console.log('🔍 QUICK ENTRY HANDLER CALLED:', { entries, firstPostWarmupExercise });
  
  if (!firstPostWarmupExercise) {
    console.error('No exercise found after warm-up');
    return;
  }

  entries.forEach(({ setNumber, reps, weight }) => {
    console.log('quick-entry saving →', { setNumber, reps, weight, exerciseName: firstPostWarmupExercise });
    addLocalSet({
      exerciseName: firstPostWarmupExercise,
      setNumber,
      reps,
      actualWeight: weight,
      completed: true
    });
  });

  console.log(`Added ${entries.length} set${entries.length > 1 ? 's' : ''} to ${firstPostWarmupExercise} — will save when you finish workout 🏁`);
  
  // 🆕 push assistant confirmation **every time**
  if (addChatMessage) {
    addChatMessage({
      id: crypto.randomUUID(),                      // unique key for React list
      role: 'assistant',
      content: `✅ Added ${entries.length} set${entries.length > 1 ? 's' : ''} to **${firstPostWarmupExercise}** — will save when you finish workout 🏁`,
      createdAt: new Date().toISOString()
    });
  }
} 