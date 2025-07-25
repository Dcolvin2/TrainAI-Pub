'use client';
import { useState, useEffect } from 'react';

interface WorkoutSet {
  setNumber: number;
  previousWeight: number;
  prescribedWeight: number;
  actualWeight: string | number;
  reps: number;
  restSeconds: number;
  rpe: number;
  done: boolean;
}

interface WorkoutLoggerProps {
  userId: string;
  exerciseName: string;
  lastSets?: WorkoutSet[];
}

export default function WorkoutLogger({ userId, exerciseName, lastSets = [] }: WorkoutLoggerProps) {
  const [sets, setSets] = useState<WorkoutSet[]>(
    lastSets.length > 0 ? lastSets.map(s => ({
      setNumber: s.setNumber,
      previousWeight: s.previousWeight,
      prescribedWeight: s.prescribedWeight,
      actualWeight: '',
      reps: s.reps,
      restSeconds: 120,
      rpe: 7,
      done: false
    })) : [{
      setNumber: 1,
      previousWeight: 0,
      prescribedWeight: 0,
      actualWeight: '',
      reps: 10,
      restSeconds: 120,
      rpe: 7,
      done: false
    }]
  );

  // Add a new empty set row
  function addEmptySet() {
    setSets(prev => [
      ...prev,
      {
        setNumber: prev.length + 1,
        previousWeight: prev[prev.length - 1]?.previousWeight || 0,
        prescribedWeight: prev[prev.length - 1]?.prescribedWeight || 0,
        actualWeight: '',
        reps: prev[0]?.reps || 10,
        restSeconds: 120,
        rpe: 7,
        done: false
      }
    ]);
  }

  // Save to Supabase when final set done
  useEffect(() => {
    if (sets.length > 0 && sets.every(s => s.done)) {
      fetch('/api/completeWorkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, exerciseName, sets })
      });
    }
  }, [sets, userId, exerciseName]);

  const totalVolume = sets.reduce((sum, s) => sum + ((Number(s.actualWeight) || 0) * s.reps), 0);

  return (
    <div className="w-full space-y-4">
      <div className="bg-[#1E293B] p-4 rounded-xl">
        <h2 className="flex justify-between items-center text-lg font-semibold mb-2 text-white">
          {exerciseName}
          <span className="text-sm text-gray-400">💪 {totalVolume} lb</span>
        </h2>
        
        {/* Header row */}
        <div className="grid grid-cols-[auto,repeat(3,1fr),auto,auto,auto] gap-2 items-center mb-2 text-xs text-gray-400">
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
          {sets.map(s => (
            <div
              key={s.setNumber}
              className="grid grid-cols-[auto,repeat(3,1fr),auto,auto,auto] gap-2 items-center"
            >
              <span className="text-gray-300 text-sm">{s.setNumber}</span>
              <input 
                readOnly 
                value={s.previousWeight} 
                className="bg-[#0F172A] p-1 rounded text-center text-white text-sm" 
              />
              <input
                type="number"
                value={s.prescribedWeight}
                onChange={e => {
                  const val = +e.target.value;
                  setSets(ps => ps.map(x => x.setNumber === s.setNumber ? { ...x, prescribedWeight: val } : x));
                }}
                className="bg-[#0F172A] p-1 rounded text-center text-white text-sm"
              />
              <input
                type="number"
                value={s.actualWeight}
                onChange={e => {
                  const val = +e.target.value;
                  setSets(ps => ps.map(x => x.setNumber === s.setNumber ? { ...x, actualWeight: val } : x));
                }}
                className="bg-[#0F172A] p-1 rounded text-center text-white text-sm"
              />
              <input
                type="number"
                value={s.reps}
                onChange={e => {
                  const val = +e.target.value;
                  setSets(ps => ps.map(x => x.setNumber === s.setNumber ? { ...x, reps: val } : x));
                }}
                className="bg-[#0F172A] p-1 rounded text-center text-white text-sm"
              />
              <input
                type="checkbox"
                checked={s.done}
                onChange={() => {
                  setSets(ps => ps.map(x => x.setNumber === s.setNumber ? { ...x, done: !x.done } : x));
                }}
                className="h-4 w-4"
              />
              <input
                type="number"
                value={s.restSeconds}
                onChange={e => {
                  const val = +e.target.value;
                  setSets(ps => ps.map(x => x.setNumber === s.setNumber ? { ...x, restSeconds: val } : x));
                }}
                className="bg-[#0F172A] p-1 rounded text-center text-white text-sm w-16"
              />
              <input
                type="number"
                value={s.rpe}
                onChange={e => {
                  const val = +e.target.value;
                  setSets(ps => ps.map(x => x.setNumber === s.setNumber ? { ...x, rpe: val } : x));
                }}
                className="bg-[#0F172A] p-1 rounded text-center text-white text-sm w-12"
              />
            </div>
          ))}
        </div>
        <button 
          onClick={addEmptySet} 
          className="mt-2 text-sm text-green-400 hover:text-green-300 transition-colors"
        >
          + Add Set
        </button>
      </div>
    </div>
  );
} 