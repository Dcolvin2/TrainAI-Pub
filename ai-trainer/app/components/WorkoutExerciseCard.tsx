'use client';

import React from 'react';

export interface LogSet {
  setNumberLabel: string;
  previousWeight?: number;
  prescribedWeight: number;
  actualWeight?: number;
  reps: number;
  done: boolean;
  restSeconds: number;
  rpe: number;
}

export function WorkoutExerciseCard({
  exerciseName,
  sets,
  updateSet,
}: {
  exerciseName: string;
  sets: LogSet[];
  updateSet: (s: LogSet, changes: Partial<LogSet>) => void;
}) {
  return (
    <div className="mb-6 bg-gray-800 rounded-lg shadow-md overflow-hidden">
      {/* Title */}
      <div className="border-b border-gray-700 px-4 py-2">
        <h2 className="text-lg font-semibold text-white">{exerciseName}</h2>
      </div>

      {/* Rows: mobile stacked, sm+ grid */}
      <div className="divide-y divide-gray-700">
        {sets.map((s, idx) => (
          <div
            key={idx}
            className="grid grid-cols-1 sm:grid-cols-[40px,repeat(4,1fr),auto,auto] gap-2 px-4 py-3 items-center"
          >
            {/* Set label */}
            <div className="text-white font-medium text-center sm:text-left">
              {s.setNumberLabel}
            </div>

            {/* Prev */}
            <div className="text-gray-300 text-center py-1 sm:py-0">
              {s.previousWeight ?? '—'}
            </div>

            {/* Prescribed Weight */}
            <div className="col-span-2 sm:col-auto">
              <input
                type="number"
                value={s.prescribedWeight}
                onChange={(e) => updateSet(s, { prescribedWeight: +e.target.value })}
                className="w-full bg-gray-700 text-white text-center rounded py-1 focus:ring-2 focus:ring-green-500"
              />
            </div>

            {/* Actual Weight */}
            <div className="col-span-2 sm:col-auto">
              <input
                type="number"
                value={s.actualWeight || ''}
                onChange={(e) => updateSet(s, { actualWeight: +e.target.value })}
                className="w-full bg-gray-700 text-white text-center rounded py-1 focus:ring-2 focus:ring-green-500"
              />
            </div>

            {/* Reps */}
            <input
              type="number"
              value={s.reps}
              onChange={(e) => updateSet(s, { reps: +e.target.value })}
              className="w-full bg-gray-700 text-white text-center rounded py-1 focus:ring-2 focus:ring-green-500"
            />

            {/* Done */}
            <div className="flex justify-center py-1 sm:py-0">
              <input
                type="checkbox"
                checked={s.done}
                onChange={() => updateSet(s, { done: !s.done })}
                className="h-5 w-5 text-green-400"
              />
            </div>

            {/* Rest */}
            <div className="flex items-center justify-center gap-1 py-1 sm:py-0">
              <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <input
                type="number"
                value={s.restSeconds}
                onChange={(e) => updateSet(s, { restSeconds: +e.target.value })}
                className="w-12 bg-gray-700 text-white text-center rounded py-1 focus:ring-2 focus:ring-green-500"
              />
            </div>

            {/* RPE */}
            <input
              type="number"
              value={s.rpe}
              onChange={(e) => updateSet(s, { rpe: +e.target.value })}
              className="w-12 bg-gray-700 text-white text-center rounded py-1 focus:ring-2 focus:ring-green-500"
            />
          </div>
        ))}
      </div>
    </div>
  );
} 