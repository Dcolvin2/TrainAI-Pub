'use client';

import React, { useEffect, useRef, useState } from 'react';
import { planWorkout, type LegacyWorkout } from '@/lib/planWorkout';

type Split = 'push' | 'pull' | 'legs' | 'upper' | 'full' | 'hiit';
type RenderTable = (workout: LegacyWorkout) => React.ReactNode;

export default function PlannedWorkoutView({
  split,
  userId,
  minutes = 45,
  message = '',
  renderTable,
}: {
  split: Split;
  userId: string;
  minutes?: number;
  message?: string;
  renderTable: RenderTable;
}) {
  const [workoutFromLLM, setWorkoutFromLLM] = useState<LegacyWorkout | null>(null);
  const [coach, setCoach] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const locked = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setErr(null);
      try {
        const { workout, coach } = await planWorkout({
          userId,
          split,
          minutes,
          style: split === 'hiit' ? 'hiit' : 'strength',
          message,
          debug: 'none',
        });
        if (!cancelled && !locked.current) {
          locked.current = true;
          setWorkoutFromLLM(workout);
          setCoach(coach || '');
          // dev visibility
          console.groupCollapsed(`[LLM→UI] ${split} ${minutes}min`);
          console.table({
            warmup: workout.warmup.map((i: any) => i.name).join(' | '),
            main: workout.main.map((i: any) => `${i.name}${i.isAccessory ? ' (A)' : ' (M)'}`).join(' | '),
            cooldown: workout.cooldown.map((i: any) => i.name).join(' | '),
          });
          console.groupEnd();
        }
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || 'Failed to plan workout');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [userId, split, minutes, message]);

  if (loading) return <div className="p-4">Loading plan…</div>;
  if (err) return <div className="p-4 text-red-500">{err}</div>;
  if (!workoutFromLLM) return null;

  return (
    <div>
      {coach ? (
        <div className="mb-3 rounded-md border p-3 text-sm text-gray-200 bg-gray-900/30 whitespace-pre-wrap">
          {coach}
        </div>
      ) : null}
      {renderTable(workoutFromLLM)}
    </div>
  );
}
