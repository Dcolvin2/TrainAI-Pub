'use client'
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { WorkoutTimer } from '@/app/components/WorkoutTimer';

interface ExerciseRow {
  name: string;
  sets: number;
  reps: number;
  weight: number;
  restSeconds: number;
}

export default function TodaysWorkoutPage() {
  const [rows, setRows] = useState<ExerciseRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/currentWorkout')
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error);
          return;
        }
        
        // flatten workout details into one row per exercise
        const list: ExerciseRow[] = data.details?.map((ex: { name: string; sets: Array<{ reps: number; prescribed: number; rest: number }> }) => ({
          name: ex.name,
          sets: ex.sets.length,
          reps: ex.sets[0]?.reps || 8,
          weight: ex.sets[0]?.prescribed || 0,
          restSeconds: ex.sets[0]?.rest ?? 60,
        })) || [];
        
        setRows(list);
      })
      .catch(err => {
        console.error('Error fetching workout:', err);
        setError('Failed to load workout');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const updateField = (idx: number, field: keyof ExerciseRow, value: number) => {
    setRows(old => old.map((r,i) => i === idx ? { ...r, [field]: value } : r));
  };

  if (isLoading) {
    return (
      <div className="pt-4 pb-6 px-4 max-w-lg mx-auto bg-[#0F172A]">
        <div className="text-white text-center">Loading workout...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pt-4 pb-6 px-4 max-w-lg mx-auto bg-[#0F172A]">
        <div className="text-red-400 text-center mb-4">{error}</div>
        <Link href="/workout/builder" className="text-green-400 text-center block">
          Build a New Workout
        </Link>
      </div>
    );
  }

  return (
    <div className="pt-4 pb-6 px-4 max-w-lg mx-auto bg-[#0F172A]">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl text-white font-bold">Today&apos;s Workout</h1>
        <Link href="/workout/builder" className="text-green-400 hover:text-green-300">
          Build a New Workout
        </Link>
      </header>

      <WorkoutTimer />

      {rows.length === 0 ? (
        <div className="text-center text-gray-400 py-8">
          <p className="mb-4">No workout found for today.</p>
          <Link href="/workout/builder" className="text-green-400 hover:text-green-300">
            Create your first workout
          </Link>
        </div>
      ) : (
        <table className="w-full text-left text-gray-200 mb-8">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="py-2">Exercise</th>
              <th>Sets</th>
              <th>Reps</th>
              <th>Weight</th>
              <th>Rest (s)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {rows.map((r, i) => (
              <tr key={r.name+i} className="hover:bg-gray-800">
                <td className="py-3 text-white">{r.name}</td>
                <td>
                  <input
                    type="number"
                    value={r.sets}
                    onChange={e => updateField(i, 'sets', +e.target.value)}
                    className="w-12 bg-transparent border border-gray-600 rounded text-center text-white p-1 focus:ring-2 focus:ring-green-400"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={r.reps}
                    onChange={e => updateField(i, 'reps', +e.target.value)}
                    className="w-12 bg-transparent border border-gray-600 rounded text-center text-white p-1 focus:ring-2 focus:ring-green-400"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={r.weight}
                    onChange={e => updateField(i, 'weight', +e.target.value)}
                    className="w-16 bg-transparent border border-gray-600 rounded text-center text-white p-1 focus:ring-2 focus:ring-green-400"
                  />
                </td>
                <td className="flex items-center space-x-1">
                  <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12,6 12,12 16,14" />
                  </svg>
                  <input
                    type="number"
                    value={r.restSeconds}
                    onChange={e => updateField(i, 'restSeconds', +e.target.value)}
                    className="w-12 bg-transparent border border-gray-600 rounded text-center text-white p-1 focus:ring-2 focus:ring-green-400"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* optional chat sidebar or footer chat window for form cues */}
      <div className="mb-4">
        {/* Placeholder: Insert Chat component here for technique Q&A only */}
      </div>
    </div>
  );
} 