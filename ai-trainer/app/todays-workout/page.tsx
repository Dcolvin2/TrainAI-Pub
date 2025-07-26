'use client'
import React, { useState, useEffect } from 'react';
import { WorkoutTimer } from '@/app/components/WorkoutTimer';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: number;
  prescribedWeight: number;
  restSeconds: number;
}

interface LogEntry {
  exerciseId: string;
  setIndex: number;
  actualWeight: number;
  actualReps: number;
  restSeconds: number;
  rpe: number;
}

export default function TodaysWorkoutPage() {
  const { user } = useAuth();
  const router = useRouter();
  
  // Workout tracking state
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [currentSet, setCurrentSet] = useState<{ exIdx: number; setIdx: number }>({ exIdx: 0, setIdx: 0 });
  const [isLoadingWorkout, setIsLoadingWorkout] = useState(true);
  const [workoutError, setWorkoutError] = useState('');
  const [mainTimerRunning, setMainTimerRunning] = useState(false);
  const [restTimerRunning, setRestTimerRunning] = useState(false);
  const [restTimerDuration, setRestTimerDuration] = useState(60);
  const [currentExercise, setCurrentExercise] = useState<Exercise | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  // Load today's workout
  useEffect(() => {
    if (!user?.id) return;

    fetch('/api/currentWorkout')
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setWorkoutError(data.error);
          return;
        }
        
        // Convert to Exercise format for tracking
        const exerciseList: Exercise[] = data.details?.map((ex: { name: string; sets: Array<{ reps: number; prescribed: number; rest: number }> }, index: number) => ({
          id: `${ex.name}-${index}`,
          name: ex.name,
          sets: ex.sets.length,
          reps: ex.sets[0]?.reps || 8,
          prescribedWeight: ex.sets[0]?.prescribed || 0,
          restSeconds: ex.sets[0]?.rest ?? 60,
        })) || [];
        
        setExercises(exerciseList);
        if (exerciseList.length > 0) {
          setCurrentExercise(exerciseList[0]);
        }
      })
      .catch(err => {
        console.error('Error fetching workout:', err);
        setWorkoutError('Failed to load workout');
      })
      .finally(() => {
        setIsLoadingWorkout(false);
      });
  }, [user?.id]);

  // Advance to next set or finish
  const next = (): void => {
    setCurrentSet(({ exIdx, setIdx }) => {
      if (exIdx < exercises.length) {
        if (setIdx + 1 < exercises[exIdx].sets) {
          return { exIdx, setIdx: setIdx + 1 };
        }
        if (exIdx + 1 < exercises.length) {
          const nextExercise = exercises[exIdx + 1];
          setCurrentExercise(nextExercise);
          return { exIdx: exIdx + 1, setIdx: 0 };
        }
      }
      // End of workout
      setMainTimerRunning(false);
      setRestTimerRunning(false);
      return { exIdx, setIdx };
    });
  };

  // Log a set and start rest timer
  const logSet = (weight: number, reps: number, rpe = 8): void => {
    const { exIdx, setIdx } = currentSet;
    const ex = exercises[exIdx];
    
    setLogs((prev) => [
      ...prev,
      {
        exerciseId: ex.id,
        setIndex: setIdx,
        actualWeight: weight,
        actualReps: reps,
        restSeconds: ex.restSeconds,
        rpe,
      },
    ]);
    
    // Start rest timer
    setRestTimerDuration(ex.restSeconds);
    setRestTimerRunning(true);
    setMainTimerRunning(false);
    
    next();
  };



  // Finish workout
  const finishWorkout = async (): Promise<void> => {
    if (!user?.id) return;
    try {
      console.log('Saving workout session:', logs);
      router.push('/dashboard');
    } catch (err) {
      console.error('Save failed:', err);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F172A] p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-2">Today&apos;s Workout</h1>
          <p className="text-gray-400">Track your progress and stay focused</p>
        </div>

        {/* Main Workout Timer */}
        <div className="bg-[#1E293B] rounded-xl p-6 shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-white">Workout Timer</h2>
            <button
              type="button"
              onClick={() => setMainTimerRunning((prev) => !prev)}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors"
            >
              {mainTimerRunning ? 'Pause' : 'Start'}
            </button>
          </div>
          <WorkoutTimer />
        </div>

        {/* Rest Timer */}
        {restTimerRunning && (
          <div className="bg-[#1E293B] rounded-xl p-6 shadow-md border-l-4 border-orange-500">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-white">Rest Timer</h2>
              <span className="text-orange-400 font-medium">Take a break!</span>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-orange-400 mb-2">
                {Math.floor(restTimerDuration / 60)}:{(restTimerDuration % 60).toString().padStart(2, '0')}
              </div>
              <p className="text-gray-400">Next set coming up...</p>
            </div>
          </div>
        )}

        {/* Workout Content */}
        {isLoadingWorkout ? (
          <div className="text-center text-white">Loading workout...</div>
        ) : workoutError ? (
          <div className="text-center">
            <div className="text-red-400 mb-4">{workoutError}</div>
            <p className="text-gray-400">No workout found for today.</p>
          </div>
        ) : exercises.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <p className="mb-4">No workout found for today.</p>
          </div>
        ) : (
          <div className="bg-[#1E293B] rounded-xl p-6 shadow-md">
            {/* Current Exercise Highlight */}
            {currentExercise && (
              <div className="mb-6 p-4 bg-[#22C55E]/10 border border-[#22C55E]/20 rounded-lg">
                <h3 className="text-lg font-semibold text-[#22C55E] mb-2">
                  Current: {currentExercise.name}
                </h3>
                <p className="text-gray-300 text-sm">
                  Set {currentSet.setIdx + 1} of {currentExercise.sets} • {currentExercise.reps} reps
                </p>
              </div>
            )}

            {/* Exercise List */}
            {exercises.map((ex, exIdx) => (
              <article key={ex.id} className="mb-6">
                <h2 className="text-xl font-semibold text-white mb-2">{ex.name}</h2>

                {Array.from({ length: ex.sets }, (_, setIdx) => {
                  const completed = logs.some((l) => l.exerciseId === ex.id && l.setIndex === setIdx);
                  const isCurrent = exIdx === currentSet.exIdx && setIdx === currentSet.setIdx;
                  
                  return (
                    <div
                      key={setIdx}
                      className={`flex items-center space-x-2 p-3 rounded mb-2 transition-all ${
                        completed 
                          ? 'opacity-50 bg-gray-800' 
                          : isCurrent
                          ? 'bg-[#22C55E]/20 border border-[#22C55E]/30'
                          : 'bg-[#111827]'
                      }`}
                    >
                      <span className={`w-6 text-center font-medium ${
                        isCurrent ? 'text-[#22C55E]' : 'text-white'
                      }`}>
                        {setIdx + 1}
                      </span>
                      <input
                        type="number"
                        defaultValue={ex.prescribedWeight}
                        disabled={completed}
                        onBlur={(e) => logSet(Number(e.target.value), ex.reps)}
                        className="w-16 p-1 bg-transparent border border-gray-600 rounded text-white text-center focus:border-[#22C55E] focus:outline-none"
                        placeholder="0"
                      />
                      <span className="text-white">×</span>
                      <span className="w-8 text-center text-white">{ex.reps}</span>
                      <button
                        type="button"
                        onClick={() => logSet(ex.prescribedWeight, ex.reps)}
                        disabled={completed}
                        className={`ml-auto px-3 py-1 rounded transition-colors ${
                          completed
                            ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                            : isCurrent
                            ? 'bg-[#22C55E] hover:bg-[#16a34a] text-white'
                            : 'bg-green-500 hover:bg-green-600 text-white'
                        }`}
                      >
                        {completed ? 'Done' : 'Complete'}
                      </button>
                    </div>
                  );
                })}
              </article>
            ))}

            {/* Finish Workout Button */}
            <footer className="flex justify-end pt-4 border-t border-gray-700">
              <button
                type="button"
                onClick={finishWorkout}
                className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg transition-colors"
              >
                Finish Workout
              </button>
            </footer>
          </div>
        )}
      </div>
    </div>
  );
} 