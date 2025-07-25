'use client';

import React, { useState, useEffect } from 'react';
import { WorkoutTimer } from './WorkoutTimer';
import { WorkoutExerciseCard, LogSet } from './WorkoutExerciseCard';

interface WorkoutSection {
  title: string;
  // for warmup/cooldown: list of simple steps
  steps?: string[];
  // for main session: detailed exercises
  exercises?: Array<{ name: string; sets: LogSet[] }>;
}

export default function WorkoutPage() {
  const [sections, setSections] = useState<WorkoutSection[]>([]);

  useEffect(() => {
    fetch('/api/currentWorkout')
      .then(res => res.json())
      .then(workout => {
        const secs: WorkoutSection[] = [];
        if (workout.warmup?.length) {
          secs.push({ title: 'Warm‑Up', steps: workout.warmup });
        }
        if (Array.isArray(workout.details)) {
          // structured workout details with sets
          secs.push({
            title: 'Main Workout',
            exercises: workout.details.map((ex: any) => ({
              name: ex.name,
              sets: ex.sets.map((st: any, idx: number) => ({
                setNumberLabel: String(idx + 1),
                previousWeight: st.previous,
                prescribedWeight: st.prescribed,
                actualWeight: null,
                reps: st.reps,
                done: false,
                restSeconds: st.rest ?? 60,
                rpe: st.rpe ?? 8,
              })),
            })),
          });
        } else if (workout.workout?.length) {
          // fallback: flat list
          secs.push({ title: 'Main Workout', steps: workout.workout });
        }
        if (workout.cooldown?.length) {
          secs.push({ title: 'Cool‑Down', steps: workout.cooldown });
        }
        setSections(secs);
      });
  }, []);

  const updateSet = (exercise: string, target: LogSet, changes: Partial<LogSet>) => {
    setSections(prev => prev.map(sec => {
      if (!sec.exercises) return sec;
      return {
        ...sec,
        exercises: sec.exercises.map(e =>
          e.name !== exercise
            ? e
            : { ...e, sets: e.sets.map(s => (s === target ? { ...s, ...changes } : s)) }
        ),
      };
    }));
  };

  return (
    <div className="pt-4 pb-6 px-4 max-w-lg mx-auto">
      <WorkoutTimer />
      {sections.map(sec => (
        <div key={sec.title} className="mb-8">
          <h3 className="text-lg font-semibold text-white mb-3">{sec.title}</h3>
          {sec.steps && (
            <ul className="list-disc list-inside text-gray-200 mb-4">
              {sec.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ul>
          )}
          {sec.exercises && sec.exercises.map(ex => (
            <WorkoutExerciseCard
              key={ex.name}
              exerciseName={ex.name}
              sets={ex.sets}
              updateSet={(target, changes) => updateSet(ex.name, target, changes)}
            />
          ))}
        </div>
      ))}
    </div>
  );
} 