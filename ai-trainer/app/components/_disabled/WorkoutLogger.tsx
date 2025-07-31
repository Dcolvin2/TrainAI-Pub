'use client';
import { useState, useEffect } from 'react';
// Using a simple clock icon instead of lucide-react
const ClockIcon = () => (
  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

type LogSet = {
  sessionId?: string
  exerciseName: string
  setNumber: number
  previousWeight: number
  prescribedWeight: number
  actualWeight: number | ''
  reps: number
  restSeconds: number
  rpe: number
  done: boolean
}

interface WorkoutLoggerProps {
  userId: string;
  exercises: string[];
  lastSets?: LogSet[];
}

export default function WorkoutLogger({ userId, exercises, lastSets = [] }: WorkoutLoggerProps) {
  const [logSets, setLogSets] = useState<LogSet[]>([]);

  // Initialize logSets on mount
  useEffect(() => {
    if (lastSets.length > 0) {
      // Use provided lastSets and compute prescribedWeight
      const computedSets = lastSets.map(set => ({
        ...set,
        prescribedWeight: set.previousWeight + (set.previousWeight > 0 ? 5 : 0),
        actualWeight: '' as const,
        done: false
      }));
      setLogSets(computedSets);
    } else {
      // Create initial sets for each exercise
      const initialSets: LogSet[] = exercises.flatMap(exerciseName => 
        Array.from({ length: 3 }, (_, i) => ({
          exerciseName,
          setNumber: i + 1,
          previousWeight: 0,
          prescribedWeight: 0,
          actualWeight: '',
          reps: 10,
          restSeconds: 120,
          rpe: 7,
          done: false
        }))
      );
      setLogSets(initialSets);
    }
  }, [exercises, lastSets]);

  // Update a specific set in the logSets array
  const updateSet = (originalSet: LogSet, changes: Partial<LogSet>) => {
    setLogSets(prev => prev.map(set => 
      set.exerciseName === originalSet.exerciseName && set.setNumber === originalSet.setNumber
        ? { ...set, ...changes }
        : set
    ));
  };

  // Add a new set for a specific exercise
  const addSet = (exerciseName: string) => {
    const exerciseSets = logSets.filter(s => s.exerciseName === exerciseName);
    const newSetNumber = exerciseSets.length + 1;
    const lastSet = exerciseSets[exerciseSets.length - 1];
    
    const newSet: LogSet = {
      exerciseName,
      setNumber: newSetNumber,
      previousWeight: lastSet?.actualWeight || lastSet?.previousWeight || 0,
      prescribedWeight: (lastSet?.actualWeight || lastSet?.previousWeight || 0) + 5,
      actualWeight: '',
      reps: lastSet?.reps || 10,
      restSeconds: 120,
      rpe: 7,
      done: false
    };

    setLogSets(prev => [...prev, newSet]);
  };

  // Group sets by exercise name
  const grouped = logSets.reduce((acc, s) => {
    (acc[s.exerciseName] ||= []).push(s);
    return acc;
  }, {} as Record<string, typeof logSets>);

  // Save to Supabase when all sets are done
  useEffect(() => {
    if (logSets.length > 0 && logSets.every(s => s.done)) {
      fetch('/api/completeWorkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, logSets })
      });
    }
  }, [logSets, userId]);

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([exerciseName, sets]) => (
        <div key={exerciseName}>
          <h2 className="text-xl font-semibold mb-2 flex justify-between">
            {exerciseName}
            <span className="text-gray-400">
              💪 {sets.reduce((sum, s) => sum + ((Number(s.actualWeight) || 0) * s.reps), 0)} lb
            </span>
          </h2>
          <div className="flex flex-col gap-2">
            {sets.map(s => (
              <div
                key={`${exerciseName}-${s.setNumber}`}
                className="grid grid-cols-[auto,repeat(4,1fr),auto,auto,auto] gap-2 items-center p-2 bg-[#0F172A] rounded"
              >
                <span className="text-gray-300">{s.setNumber}</span>
                <input readOnly value={s.previousWeight} className="bg-transparent text-center"/>
                <input
                  type="number"
                  value={s.prescribedWeight}
                  onChange={e => updateSet(s, { prescribedWeight: +e.target.value })}
                  className="bg-transparent text-center"
                />
                <input
                  type="number"
                  value={s.actualWeight}
                  onChange={e => updateSet(s, { actualWeight: +e.target.value })}
                  className="bg-transparent text-center"
                />
                <input
                  type="number"
                  value={s.reps}
                  onChange={e => updateSet(s, { reps: +e.target.value })}
                  className="bg-transparent text-center"
                />
                <input
                  type="checkbox"
                  checked={s.done}
                  onChange={() => updateSet(s, { done: !s.done })}
                  className="h-5 w-5"
                />
                <div className="flex items-center gap-1">
                  <ClockIcon />
                  <input
                    type="number"
                    value={s.restSeconds}
                    onChange={e => updateSet(s, { restSeconds: +e.target.value })}
                    className="bg-transparent text-center w-16"
                  />
                </div>
                <input
                  type="number"
                  value={s.rpe}
                  onChange={e => updateSet(s, { rpe: +e.target.value })}
                  className="bg-transparent text-center w-12"
                />
              </div>
            ))}
          </div>
          <button 
            onClick={() => addSet(exerciseName)} 
            className="mt-2 text-sm text-green-400 hover:text-green-300 transition-colors"
          >
            + Add Set for {exerciseName}
          </button>
        </div>
      ))}
    </div>
  );
} 