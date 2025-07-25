'use client';

import React from 'react';

export interface LogSet {
  setNumberLabel: string;    // 'W' or '1', '2', ...
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
    <div className="bg-[#14233C] rounded-lg overflow-hidden mb-6">
      {/* Title */}
      <div className="px-4 py-2">
        <h2 className="text-xl font-bold text-white">{exerciseName}</h2>
      </div>

      {/* Grid header + rows */}
      <div className="grid grid-cols-[40px,repeat(4,1fr),auto,auto] gap-2 px-4 py-2 text-gray-300 text-sm">
        {/* Column Labels */}
        <div>Set</div>
        <div className="text-center">Prev</div>
        <div className="text-center">Weight</div>
        <div className="text-center">Reps</div>
        <div className="text-center">Done</div>
        <div className="text-center">Rest</div>
        <div className="text-center">RPE</div>

        {/* Divider */}
        <div className="col-span-full border-t border-gray-600 my-1"></div>

        {/* Data Rows */}
        {sets.map((s, idx) => (
          <React.Fragment key={idx}>
            <div className="text-white flex items-center justify-center">
              {s.setNumberLabel}
            </div>
            <div className="text-center text-gray-200">
              {s.previousWeight ?? '—'}
            </div>
            <input
              type="number"
              value={s.prescribedWeight}
              onChange={(e) => updateSet(s, { prescribedWeight: +e.target.value })}
              className="bg-[#1E293B] text-white text-center rounded focus:outline-none"
            />
            <input
              type="number"
              value={s.actualWeight || ''}
              onChange={(e) => updateSet(s, { actualWeight: +e.target.value })}
              className="bg-[#1E293B] text-white text-center rounded focus:outline-none"
            />
            <input
              type="number"
              value={s.reps}
              onChange={(e) => updateSet(s, { reps: +e.target.value })}
              className="bg-[#1E293B] text-white text-center rounded focus:outline-none"
            />
            <div className="flex items-center justify-center">
              <input
                type="checkbox"
                checked={s.done}
                onChange={() => updateSet(s, { done: !s.done })}
                className="h-5 w-5 text-green-400"
              />
            </div>
            <div className="flex items-center justify-center gap-1">
              <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <input
                type="number"
                value={s.restSeconds}
                onChange={(e) => updateSet(s, { restSeconds: +e.target.value })}
                className="bg-[#1E293B] text-white text-center rounded w-12 focus:outline-none"
              />
            </div>
            <input
              type="number"
              value={s.rpe}
              onChange={(e) => updateSet(s, { rpe: +e.target.value })}
              className="bg-[#1E293B] text-white text-center rounded w-12 focus:outline-none"
            />
          </React.Fragment>
        ))}
      </div>
    </div>
  );
} 