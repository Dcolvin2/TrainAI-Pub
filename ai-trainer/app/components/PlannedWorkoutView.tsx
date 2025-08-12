'use client';

import { useEffect, useRef, useState } from 'react';
import { planWorkout, type LegacyWorkout } from '@/lib/planWorkout';

type Split = 'push' | 'pull' | 'legs' | 'upper' | 'full' | 'hiit';

export default function PlannedWorkoutView({
  split,
  userId,
  minutes = 45,
  message = '',
  renderTable, // your existing renderer: (workout) => JSX
}: {
  split: Split;
  userId: string;
  minutes?: number;
  message?: string;
  renderTable: (workout: LegacyWorkout) => JSX.Element;
}) {
  const [workoutFromLLM, setWorkoutFromLLM] = useState<LegacyWorkout | null>(null);
  const [coach, setCoach] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // freeze-once so a local "template generator" can't overwrite on re-render
  const locked = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setErr(null);
      try {
        const { workout, coach } = await planWorkout({
          userId, split, minutes, style: 'strength', message, debug: 'none',
        });
        if (!cancelled && !locked.current) {
          locked.current = true;
          setWorkoutFromLLM(workout);

          // DEV: prove we're using exactly what the API returned
          console.groupCollapsed(`[LLM→UI] ${split} ${minutes}min`);
          console.table({
            warmup: workout.warmup.map(i => i.name).join(' | '),
            main:   workout.main.map(i => `${i.name}${i.isAccessory ? ' (A)' : ' (M)'}`).join(' | '),
            cooldown: workout.cooldown.map(i => i.name).join(' | '),
          });
          console.groupEnd();
          setCoach(coach || '');
        }
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || 'Failed to plan workout');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [userId, split, minutes, message]);

  if (loading) return <div className="p-4">Loading plan…</div>;
  if (err)     return <div className="p-4 text-red-500">{err}</div>;
  if (!workoutFromLLM) return null;

  return (
    <div>
      {coach ? (
        <div className="mb-3 rounded-md border p-3 text-sm text-gray-200 bg-gray-900/30 whitespace-pre-wrap">
          {coach}
        </div>
      ) : null}

      {/* IMPORTANT: render the LLM workout verbatim */}
      {renderTable(workoutFromLLM)}
    </div>
  );
}
