'use client';

import React from 'react';

interface WorkoutSet {
  exerciseName: string;
  setNumber: number;
  setNumberLabel: string;
  previousWeight: number | null;
  prescribedWeight: number;
  actualWeight: number | string;
  reps: number;
  restSeconds: number;
  rpe: number;
  done: boolean;
}

interface WorkoutExerciseCardProps {
  exerciseName: string;
  sets: WorkoutSet[];
  updateSet: (set: WorkoutSet, changes: Partial<WorkoutSet>) => void;
}

export function WorkoutExerciseCard({ exerciseName, sets, updateSet }: WorkoutExerciseCardProps) {
  return (
    <div className="bg-[#1E293B] rounded-lg overflow-hidden mb-4">
      {/* Header */}
      <div className="flex justify-between items-center px-4 py-3 bg-[#0F172A]">
        <h2 className="text-xl font-bold text-white">{exerciseName}</h2>
        <span className="text-sm text-gray-400">
          💪 {sets.reduce((sum, s) => sum + ((Number(s.actualWeight) || 0) * s.reps), 0)} lb
        </span>
      </div>

      {/* Grid: header + all rows together */}
      <div className="grid grid-cols-[40px,repeat(4,1fr),auto,auto] gap-2 px-4 py-3 bg-[#0F172A] text-gray-400 text-sm font-medium">
        {/* Column labels */}
        <span>Set</span>
        <span className="text-center">Prev</span>
        <span className="text-center">Weight</span>
        <span className="text-center">Reps</span>
        <span className="text-center">Done</span>
        <span className="text-center">Rest</span>
        <span className="text-center">RPE</span>

        {/* Divider line beneath header */}
        <div className="col-span-full border-t border-gray-700 my-2"></div>

        {/* Data rows */}
        {sets.map((s) => (
          <React.Fragment key={s.setNumber}>
            {/* Set number or "W" */}
            <span className="text-white">{s.setNumberLabel}</span>

            {/* Previous weight */}
            <span className="text-center text-gray-200">{s.previousWeight ?? '—'}</span>

            {/* Prescribed weight */}
            <input
              type="number"
              className="bg-[#0F172A] text-center text-white rounded border border-gray-600 focus:border-blue-400 focus:outline-none"
              value={s.prescribedWeight}
              onChange={(e) => updateSet(s, { prescribedWeight: +e.target.value })}
            />

            {/* Actual weight */}
            <input
              type="number"
              className="bg-[#0F172A] text-center text-white rounded border border-gray-600 focus:border-blue-400 focus:outline-none"
              value={s.actualWeight}
              onChange={(e) => updateSet(s, { actualWeight: +e.target.value })}
            />

            {/* Reps */}
            <input
              type="number"
              className="bg-[#0F172A] text-center text-white rounded border border-gray-600 focus:border-blue-400 focus:outline-none"
              value={s.reps}
              onChange={(e) => updateSet(s, { reps: +e.target.value })}
            />

            {/* Done */}
            <div className="flex justify-center">
              <input
                type="checkbox"
                className="h-5 w-5 text-green-400 rounded focus:ring-2 focus:ring-green-400"
                checked={s.done}
                onChange={() => updateSet(s, { done: !s.done })}
              />
            </div>

            {/* Rest */}
            <div className="flex items-center justify-center gap-1">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <input
                type="number"
                className="bg-[#0F172A] text-center text-white rounded w-12 border border-gray-600 focus:border-blue-400 focus:outline-none"
                value={s.restSeconds}
                onChange={(e) => updateSet(s, { restSeconds: +e.target.value })}
              />
            </div>

            {/* RPE */}
            <input
              type="number"
              className="bg-[#0F172A] text-center text-white rounded w-12 border border-gray-600 focus:border-blue-400 focus:outline-none"
              value={s.rpe}
              onChange={(e) => updateSet(s, { rpe: +e.target.value })}
            />
          </React.Fragment>
        ))}
      </div>
    </div>
  );
} 