// app/todays-workout/page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { fetchJSON } from '@/lib/api';
import { normalizeWorkoutResponse, type NormalizedWorkout } from '@/utils/normalizeWorkoutResponse';
import ChatPanel from '@/app/components/ChatPanel';

type WorkoutUI = NormalizedWorkout['workout'];

export default function TodaysWorkoutPage() {
  const [workout, setWorkout] = useState<WorkoutUI>({ warmup: [], mainExercises: [] });
  const [coachText, setCoachText] = useState<string>('');
  const [planName, setPlanName] = useState<string>('');
  const [error, setError] = useState<string>('');
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    (async () => {
      try {
        // Step 0: safe JSON fetch (no external base, avoid 404)
        const raw = await fetchJSON<any>('/api/chat-workout/test');

        // quick probe
        console.table(
          [
            ['warmup', typeof raw?.workout?.warmup, Array.isArray(raw?.workout?.warmup)],
            ['mainExercises', typeof raw?.workout?.mainExercises, Array.isArray(raw?.workout?.mainExercises)],
            ['finisher', typeof raw?.workout?.finisher, !!raw?.workout?.finisher],
          ].map(([k, t, a]) => ({ key: k as string, type: t as string, isArray: Boolean(a) }))
        );

        const data = normalizeWorkoutResponse(raw);

        if (!data.ok) {
          setError(data.error || 'Unknown error');
          return;
        }

        setWorkout(data.workout);
        setPlanName(data.name || data.message || 'Workout');
        setCoachText(data.coach || data.chatMsg || data.message || data.name || 'Coach loaded.');
      } catch (e: any) {
        setError(e?.message || 'Failed to load workout.');
      }
    })();
  }, []);

  const warmup = Array.isArray(workout?.warmup) ? workout.warmup : [];
  const main = Array.isArray(workout?.mainExercises) ? workout.mainExercises : [];

  return (
    <div className="p-4 text-slate-200">
      <h1 className="text-xl font-semibold mb-4">{planName || 'Today\'s Workout'}</h1>

      {error && (
        <div className="mb-4 rounded bg-red-900/40 border border-red-700 px-3 py-2 text-sm">
          Workout generation failed: {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <section className="rounded-xl bg-slate-900 p-4">
            <h2 className="font-medium mb-3">Warm-up</h2>
            {warmup.length === 0 ? (
              <div className="opacity-70 text-sm">No warm-up provided.</div>
            ) : (
              <ul className="space-y-2 text-sm">
                {warmup.map((w, i) => (
                  <li key={i} className="flex items-center justify-between">
                    <span>{w.name}</span>
                    <span className="opacity-80">
                      {w.duration || [w.sets, w.reps].filter(Boolean).join(' x ') || ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl bg-slate-900 p-4">
            <h2 className="font-medium mb-3">Main</h2>
            {main.length === 0 ? (
              <div className="opacity-70 text-sm">No main exercises provided.</div>
            ) : (
              <ul className="space-y-2 text-sm">
                {main.map((m, i) => (
                  <li key={i} className="flex items-center justify-between">
                    <span>{m.name}</span>
                    <span className="opacity-80">
                      {m.duration || [m.sets, m.reps].filter(Boolean).join(' x ') || ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="md:col-span-1">
          <ChatPanel initialAssistant={coachText} />
        </div>
      </div>
    </div>
  );
}
