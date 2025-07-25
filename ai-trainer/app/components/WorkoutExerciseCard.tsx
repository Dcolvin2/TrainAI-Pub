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
  updateSet: (target: LogSet, changes: Partial<LogSet>) => void;
}) {
  return (
    <div className="mb-6 bg-[#0F172A] rounded-2xl shadow-lg">
      <div className="px-4 py-3 border-b border-gray-700">
        <h2 className="text-xl font-bold text-white">{exerciseName}</h2>
      </div>

      <div className="divide-y divide-gray-700">
        {sets.map((s, idx) => (
          <div
            key={idx}
            className="flex flex-col md:grid md:grid-cols-7 gap-3 px-4 py-3 items-center md:items-start"
          >
            <div className="w-8 text-center text-white font-medium md:text-left">
              {s.setNumberLabel}
            </div>
            <div className="w-10 text-center text-gray-300">
              {s.previousWeight != null ? `${s.previousWeight}` : '—'}
            </div>
            <input
              type="number"
              value={s.prescribedWeight}
              onChange={e => updateSet(s, { prescribedWeight: +e.target.value })}
              className="flex-1 bg-transparent border border-gray-600 text-center rounded-lg py-1 text-white focus:ring-2 focus:ring-green-400"
              placeholder="Prescribed"
            />
            <input
              type="number"
              value={s.actualWeight || ''}
              onChange={e => updateSet(s, { actualWeight: +e.target.value })}
              className="flex-1 bg-transparent border border-gray-600 text-center rounded-lg py-1 text-white focus:ring-2 focus:ring-green-400"
              placeholder="Actual"
            />
            <input
              type="number"
              value={s.reps}
              onChange={e => updateSet(s, { reps: +e.target.value })}
              className="w-16 bg-transparent border border-gray-600 text-center rounded-lg py-1 text-white focus:ring-2 focus:ring-green-400"
              placeholder="Reps"
            />
            <div className="flex items-center justify-center">
              <input
                type="checkbox"
                checked={s.done}
                onChange={() => updateSet(s, { done: !s.done })}
                className="h-5 w-5 text-green-400"
              />
            </div>
            <div className="flex items-center justify-center space-x-1">
              <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <input
                type="number"
                value={s.restSeconds}
                onChange={e => updateSet(s, { restSeconds: +e.target.value })}
                className="w-16 bg-transparent border border-gray-600 text-center rounded-lg py-1 text-white focus:ring-2 focus:ring-green-400"
                placeholder="Rest"
              />
            </div>
            <input
              type="number"
              value={s.rpe}
              onChange={e => updateSet(s, { rpe: +e.target.value })}
              className="w-12 bg-transparent border border-gray-600 text-center rounded-lg py-1 text-white focus:ring-2 focus:ring-green-400"
              placeholder="RPE"
            />
          </div>
        ))}
      </div>
    </div>
  );
} 