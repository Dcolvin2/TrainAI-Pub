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
  const grouped = logSets.reduce((acc, set) => {
    (acc[set.exerciseName] = acc[set.exerciseName] || []).push(set);
    return acc;
  }, {} as Record<string, LogSet[]>);

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
    <div className="flex flex-col space-y-4">
      {Object.entries(grouped).map(([exerciseName, sets]) => (
        <div key={exerciseName} className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-xl font-semibold text-white">
              {exerciseName}
            </h2>
            <span className="text-gray-400">
              💪 {sets.reduce((sum, s) => sum + ((Number(s.actualWeight) || 0) * s.reps), 0)} lb
            </span>
          </div>
          
          {/* Header row */}
          <div className="grid grid-cols-[auto,repeat(4,1fr),auto,auto,auto] gap-2 items-center mb-2 text-xs text-gray-400">
            <span>Set</span>
            <span className="text-center">Prev</span>
            <span className="text-center">Prescribed</span>
            <span className="text-center">Actual</span>
            <span className="text-center">Reps</span>
            <span className="text-center">Done</span>
            <span className="text-center">Rest(s)</span>
            <span className="text-center">RPE</span>
          </div>

          <div className="flex flex-col gap-2">
            {sets.map(set => (
              <div
                key={`${set.exerciseName}-${set.setNumber}`}
                className="grid grid-cols-[auto,repeat(4,1fr),auto,auto,auto] gap-2 items-center bg-[#0F172A] p-2 rounded"
              >
                <span className="text-gray-300 text-sm">{set.setNumber}</span>
                <input 
                  readOnly 
                  value={set.previousWeight} 
                  className="bg-transparent text-center text-white text-sm" 
                />
                <input
                  type="number"
                  value={set.prescribedWeight}
                  onChange={e => updateSet(set, { prescribedWeight: +e.target.value })}
                  className="bg-transparent text-center text-white text-sm"
                />
                <input
                  type="number"
                  value={set.actualWeight}
                  onChange={e => updateSet(set, { actualWeight: +e.target.value })}
                  className="bg-transparent text-center text-white text-sm"
                />
                <input
                  type="number"
                  value={set.reps}
                  onChange={e => updateSet(set, { reps: +e.target.value })}
                  className="bg-transparent text-center text-white text-sm"
                />
                <input
                  type="checkbox"
                  checked={set.done}
                  onChange={() => updateSet(set, { done: !set.done })}
                  className="h-5 w-5"
                />
                <div className="flex items-center gap-1">
                  <ClockIcon />
                  <input
                    type="number"
                    value={set.restSeconds}
                    onChange={e => updateSet(set, { restSeconds: +e.target.value })}
                    className="bg-transparent text-center text-white text-sm w-16"
                  />
                </div>
                <input
                  type="number"
                  value={set.rpe}
                  onChange={e => updateSet(set, { rpe: +e.target.value })}
                  className="bg-transparent text-center text-white text-sm w-12"
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