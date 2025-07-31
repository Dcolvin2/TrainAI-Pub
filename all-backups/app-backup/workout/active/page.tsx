'use client'
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { WorkoutTimer } from '@/app/components/WorkoutTimer';
import { WorkoutExerciseCard, LogSet } from '@/app/components/WorkoutExerciseCard';

interface WorkoutSection {
  title: string;
  steps?: string[];
  exercises?: Array<{ name: string; sets: LogSet[] }>;
}

export default function ActiveWorkoutPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [sections, setSections] = useState<WorkoutSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Redirect if not authenticated
  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  useEffect(() => {
    if (!user?.id) return;

    const fetchCurrentWorkout = async () => {
      try {
        setIsLoading(true);
        setError('');
        
        const response = await fetch('/api/currentWorkout');
        if (!response.ok) {
          throw new Error('Failed to fetch current workout');
        }
        
        const workout = await response.json();
        
        const secs: WorkoutSection[] = [];
        
        if (workout.warmup?.length) {
          secs.push({ title: 'Warm‑Up', steps: workout.warmup });
        }
        
        if (Array.isArray(workout.details)) {
          secs.push({
            title: 'Main Workout',
            exercises: workout.details.map((ex: { name: string; sets: Array<{ previous: number | null; prescribed: number; reps: number; rest: number; rpe: number }> }) => ({
              name: ex.name,
              sets: ex.sets.map((st: { previous: number | null; prescribed: number; reps: number; rest: number; rpe: number }, idx: number) => ({
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
          secs.push({ title: 'Main Workout', steps: workout.workout });
        }
        
        if (workout.cooldown?.length) {
          secs.push({ title: 'Cool‑Down', steps: workout.cooldown });
        }
        
        setSections(secs);
      } catch (err) {
        console.error('Error fetching workout:', err);
        setError('Failed to load workout. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCurrentWorkout();
  }, [user?.id]);

  const updateSet = (exercise: string, target: LogSet, changes: Partial<LogSet>) => {
    setSections(prev =>
      prev.map(sec => ({
        ...sec,
        exercises: sec.exercises?.map(e =>
          e.name !== exercise
            ? e
            : { ...e, sets: e.sets.map(s => (s === target ? { ...s, ...changes } : s)) }
        ),
      }))
    );
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
        <div className="text-white">Loading workout...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0F172A] p-6">
        <div className="max-w-lg mx-auto text-center">
          <div className="bg-red-900/20 border border-red-500 text-red-400 px-4 py-3 rounded-xl mb-4">
            {error}
          </div>
          <button
            onClick={() => router.push('/workout/builder')}
            className="bg-[#22C55E] px-6 py-3 rounded-xl text-white font-semibold hover:bg-[#16a34a] transition-colors"
          >
            Create New Workout
          </button>
        </div>
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <div className="min-h-screen bg-[#0F172A] p-6">
        <div className="max-w-lg mx-auto text-center">
          <h1 className="text-2xl font-bold text-white mb-4">No Active Workout</h1>
          <p className="text-gray-400 mb-6">You don&apos;t have an active workout to track.</p>
          <button
            onClick={() => router.push('/workout/builder')}
            className="bg-[#22C55E] px-6 py-3 rounded-xl text-white font-semibold hover:bg-[#16a34a] transition-colors"
          >
            Create New Workout
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F172A] pt-4 pb-6 px-4">
      <div className="max-w-lg mx-auto">
        <WorkoutTimer />
        
        {sections.map(sec => (
          <div key={sec.title} className="mb-8">
            <h3 className="text-lg font-semibold text-white mb-3">{sec.title}</h3>
            
            {sec.steps && (
              <ul className="list-disc list-inside text-gray-200 mb-4">
                {sec.steps.map((step, i) => <li key={i}>{step}</li>)}
              </ul>
            )}
            
            {sec.exercises?.map(ex => (
              <WorkoutExerciseCard
                key={ex.name}
                exerciseName={ex.name}
                sets={ex.sets}
                updateSet={(t, c) => updateSet(ex.name, t, c)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
} 