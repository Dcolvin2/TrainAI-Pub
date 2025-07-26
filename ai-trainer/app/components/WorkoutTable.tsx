'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

interface GeneratedWorkout {
  warmup: string[];
  workout: string[];
  cooldown: string[];
  prompt?: string;
}

interface FlahertyExercise {
  Workout: number;
  'Upper / Lower body': string;
  Sets: number;
  Reps: string;
  Exercise: string;
  'Exercise Type': string;
}

interface FlahertyWorkout {
  exercises: FlahertyExercise[];
  workoutNumber: number;
}

interface WorkoutSet {
  id: string;
  exerciseName: string;
  setNumber: number;
  previousWeight?: number;
  previousReps?: number;
  prescribedWeight: number;
  prescribedReps: number;
  actualWeight?: number;
  actualReps?: number;
  completed: boolean;
  restSeconds: number;
  section: 'warmup' | 'workout' | 'cooldown';
}



interface WorkoutTableProps {
  workout: GeneratedWorkout | FlahertyWorkout;
  onFinishWorkout?: () => void;
  onStopTimer?: () => void;
}

// Parse workout string into structured data
const parseWorkoutString = (workoutString: string, section: 'warmup' | 'workout' | 'cooldown'): WorkoutSet => {
  // Handle different formats
  const patterns = [
    // "Back Squat: 3x8 @ 100lb rest 90s"
    /^(.+?):\s*(\d+)x(\d+)\s*@\s*(\d+)lb\s*rest\s*(\d+)s?$/i,
    // "Bodyweight squats – 1 min"
    /^(.+?)\s*[–-]\s*(\d+)\s*min$/i,
    // "Push-ups: 3x10"
    /^(.+?):\s*(\d+)x(\d+)$/i,
    // "Plank: 30 seconds"
    /^(.+?):\s*(\d+)\s*seconds?$/i,
    // "Jumping jacks: 1 minute"
    /^(.+?):\s*(\d+)\s*minute?s?$/i
  ];

  for (let i = 0; i < patterns.length; i++) {
    const match = workoutString.match(patterns[i]);
    if (match) {
      const exerciseName = match[1].trim().replace(/\s*\(bodyweight\)\s*$/i, '');
      
      if (i === 0) {
        // Format: "Back Squat: 3x8 @ 100lb rest 90s"
        return {
          id: `${exerciseName}-${section}-${Date.now()}-${Math.random()}`,
          exerciseName,
          setNumber: 1,
          prescribedWeight: parseInt(match[4]),
          prescribedReps: parseInt(match[3]),
          completed: false,
          restSeconds: parseInt(match[5]),
          section,
          previousWeight: parseInt(match[4]) - 5,
          previousReps: parseInt(match[3])
        };
      } else if (i === 1) {
        // Format: "Bodyweight squats – 1 min"
        return {
          id: `${exerciseName}-${section}-${Date.now()}-${Math.random()}`,
          exerciseName,
          setNumber: 1,
          prescribedWeight: 0,
          prescribedReps: parseInt(match[2]) * 60, // Convert minutes to seconds
          completed: false,
          restSeconds: 30,
          section
        };
      } else if (i === 2) {
        // Format: "Push-ups: 3x10"
        return {
          id: `${exerciseName}-${section}-${Date.now()}-${Math.random()}`,
          exerciseName,
          setNumber: 1,
          prescribedWeight: 0,
          prescribedReps: parseInt(match[3]),
          completed: false,
          restSeconds: 60,
          section
        };
      } else {
        // Format: "Plank: 30 seconds" or "Jumping jacks: 1 minute"
        const duration = i === 3 ? parseInt(match[2]) : parseInt(match[2]) * 60;
        return {
          id: `${exerciseName}-${section}-${Date.now()}-${Math.random()}`,
          exerciseName,
          setNumber: 1,
          prescribedWeight: 0,
          prescribedReps: duration,
          completed: false,
          restSeconds: 30,
          section
        };
      }
    }
  }

  // Fallback for unrecognized format
  return {
    id: `${workoutString}-${section}-${Date.now()}-${Math.random()}`,
    exerciseName: workoutString.replace(/\s*\(bodyweight\)\s*$/i, ''),
    setNumber: 1,
    prescribedWeight: 0,
    prescribedReps: 10,
    completed: false,
    restSeconds: 60,
    section
  };
};

// Get default set count based on exercise type
const getDefaultSetCount = (section: 'warmup' | 'workout' | 'cooldown', exerciseName: string): number => {
  // Determine exercise type based on section and exercise name
  if (section === 'warmup') return 1;
  if (section === 'cooldown') return 1;
  
  // For main workout, determine by exercise characteristics
  const exerciseLower = exerciseName.toLowerCase();
  
  // Cardio/endurance exercises
  if (exerciseLower.includes('cardio') || 
      exerciseLower.includes('run') || 
      exerciseLower.includes('jog') || 
      exerciseLower.includes('bike') || 
      exerciseLower.includes('row') || 
      exerciseLower.includes('elliptical') ||
      exerciseLower.includes('jumping') ||
      exerciseLower.includes('burpee') ||
      exerciseLower.includes('mountain climber')) {
    return 2;
  }
  
  // HIIT exercises
  if (exerciseLower.includes('sprint') || 
      exerciseLower.includes('tabata') || 
      exerciseLower.includes('circuit') ||
      exerciseLower.includes('amrap') ||
      exerciseLower.includes('emom')) {
    return 3;
  }
  
  // Strength exercises (default)
  return 4;
};

// Convert Flaherty workout to GeneratedWorkout format
const convertFlahertyToGenerated = (flahertyWorkout: FlahertyWorkout): GeneratedWorkout => {
  const warmup: string[] = [];
  const workout: string[] = [];
  const cooldown: string[] = [];
  
  flahertyWorkout.exercises.forEach(exercise => {
    // Handle different rep formats (numbers vs "30 seconds")
    const repsDisplay = exercise.Reps === '-' ? '1' : exercise.Reps;
    const exerciseString = `${exercise.Exercise}: ${exercise.Sets}x${repsDisplay}`;
    
    // Categorize based on exercise type
    if (exercise['Exercise Type'].toLowerCase().includes('warmup') || 
        exercise['Exercise Type'].toLowerCase().includes('mobility')) {
      warmup.push(exerciseString);
    } else if (exercise['Exercise Type'].toLowerCase().includes('cooldown') || 
               exercise['Exercise Type'].toLowerCase().includes('stretch')) {
      cooldown.push(exerciseString);
    } else {
      workout.push(exerciseString);
    }
  });
  
  return {
    warmup,
    workout,
    cooldown,
    prompt: `Flaherty Workout ${flahertyWorkout.workoutNumber}`
  };
};

// Convert workout arrays to structured sets with proper set counts
const convertWorkoutToSets = (workout: GeneratedWorkout | FlahertyWorkout): WorkoutSet[] => {
  // Convert Flaherty workout to GeneratedWorkout format if needed
  const generatedWorkout = 'exercises' in workout ? convertFlahertyToGenerated(workout) : workout;
  const sets: WorkoutSet[] = [];
  
  // Process warmup
  generatedWorkout.warmup.forEach((item: string) => {
    const baseSet = parseWorkoutString(item, 'warmup');
    const setCount = getDefaultSetCount('warmup', baseSet.exerciseName);
    
    for (let i = 0; i < setCount; i++) {
      const set = { ...baseSet };
      set.id = `${baseSet.exerciseName}-warmup-${Date.now()}-${Math.random()}-${i}`;
      set.setNumber = i + 1;
      sets.push(set);
    }
  });
  
  // Process main workout
  generatedWorkout.workout.forEach((item: string) => {
    const baseSet = parseWorkoutString(item, 'workout');
    const setCount = getDefaultSetCount('workout', baseSet.exerciseName);
    
    for (let i = 0; i < setCount; i++) {
      const set = { ...baseSet };
      set.id = `${baseSet.exerciseName}-workout-${Date.now()}-${Math.random()}-${i}`;
      set.setNumber = i + 1;
      sets.push(set);
    }
  });
  
  // Process cooldown
  generatedWorkout.cooldown.forEach((item: string) => {
    const baseSet = parseWorkoutString(item, 'cooldown');
    const setCount = getDefaultSetCount('cooldown', baseSet.exerciseName);
    
    for (let i = 0; i < setCount; i++) {
      const set = { ...baseSet };
      set.id = `${baseSet.exerciseName}-cooldown-${Date.now()}-${Math.random()}-${i}`;
      set.setNumber = i + 1;
      sets.push(set);
    }
  });
  
  return sets;
};

export default function WorkoutTable({ workout, onFinishWorkout, onStopTimer }: WorkoutTableProps) {
  const { user } = useAuth();
  const router = useRouter();
  
  const [sets, setSets] = useState<WorkoutSet[]>([]);
  const [sessionId, setSessionId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Initialize sets from workout data
  useEffect(() => {
    if (workout) {
      const workoutSets = convertWorkoutToSets(workout);
      setSets(workoutSets);
      setSessionId(`session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    }
  }, [workout]);

  // Update set completion
  const updateSet = (setId: string, updates: Partial<WorkoutSet>) => {
    setSets(prev => prev.map(set => 
      set.id === setId ? { ...set, ...updates } : set
    ));
  };

  // Add a set to an exercise
  const addSet = (exerciseName: string, section: 'warmup' | 'workout' | 'cooldown') => {
    const existingSets = sets.filter(s => s.exerciseName === exerciseName && s.section === section);
    const lastSet = existingSets[existingSets.length - 1];
    
    const newSet: WorkoutSet = {
      id: `${exerciseName}-${section}-${Date.now()}-${Math.random()}`,
      exerciseName,
      setNumber: existingSets.length + 1, // Always increment from current count
      prescribedWeight: lastSet?.prescribedWeight || 0,
      prescribedReps: lastSet?.prescribedReps || 10,
      completed: false,
      restSeconds: lastSet?.restSeconds || 60,
      section,
      previousWeight: lastSet?.previousWeight,
      previousReps: lastSet?.previousReps
    };
    
    setSets(prev => [...prev, newSet]);
  };

  // Finish workout and save to database
  const handleFinishWorkout = async () => {
    if (!user?.id) {
      setError('User ID is required');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Save workout session
      const sessionResponse = await fetch('/api/saveWorkoutSession', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          sessionId,
          workoutData: workout,
          completedAt: new Date().toISOString(),
          totalSets: sets.length,
          completedSets: sets.filter(s => s.completed).length
        })
      });

      if (!sessionResponse.ok) {
        const errorData = await sessionResponse.json();
        throw new Error(`Failed to save workout session: ${errorData.details || errorData.error || 'Unknown error'}`);
      }

      // Save individual sets
      const completedSets = sets.filter(s => s.completed);
      if (completedSets.length > 0) {
        const setsResponse = await fetch('/api/saveWorkoutSets', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user.id,
            sessionId,
            sets: completedSets
          })
        });

        if (!setsResponse.ok) {
          const errorData = await setsResponse.json();
          throw new Error(`Failed to save workout sets: ${errorData.details || errorData.error || 'Unknown error'}`);
        }
      }

      // Update user's Flaherty progress if this was a Flaherty workout
      const workoutPrompt = 'prompt' in workout ? workout.prompt : `Flaherty Workout ${('workoutNumber' in workout ? workout.workoutNumber : 0)}`;
      if (workoutPrompt?.toLowerCase().includes('flaherty')) {
        await fetch('/api/updateFlahertyProgress', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user.id
          })
        });
      }

      console.log('Workout completed and saved successfully');
      onStopTimer?.(); // Stop the timer
      onFinishWorkout?.();
      router.push('/dashboard');
      
    } catch (err) {
      console.error('Save failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to save workout');
    } finally {
      setIsLoading(false);
    }
  };

  // Group sets by exercise and section
  const groupedSets = sets.reduce((acc, set) => {
    const key = `${set.section}-${set.exerciseName}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(set);
    return acc;
  }, {} as Record<string, WorkoutSet[]>);

  const sections = [
    { key: 'warmup', title: 'Warm-up', sets: Object.entries(groupedSets).filter(([key]) => key.startsWith('warmup-')) },
    { key: 'workout', title: 'Main Workout', sets: Object.entries(groupedSets).filter(([key]) => key.startsWith('workout-')) },
    { key: 'cooldown', title: 'Cool-down', sets: Object.entries(groupedSets).filter(([key]) => key.startsWith('cooldown-')) }
  ];

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-900/20 border border-red-500 text-red-400 px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {sections.map(({ key, title, sets: sectionSets }) => (
        <div key={key} className="bg-[#1F2937] rounded-lg p-4">
          <h2 className="text-xl font-semibold text-white mb-4">{title}</h2>
          
          {sectionSets.length === 0 ? (
            <p className="text-gray-400 text-sm">No exercises in this section</p>
          ) : (
            sectionSets.map(([exerciseKey, exerciseSets]) => {
              const exerciseName = exerciseSets[0].exerciseName;
              const section = exerciseSets[0].section;
              
              return (
                <div key={exerciseKey} className="mb-6">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-medium text-white">{exerciseName}</h3>
                    <button
                      onClick={() => addSet(exerciseName, section)}
                      className="text-green-400 hover:text-green-300 text-sm"
                    >
                      + Add Set
                    </button>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-white">
                      <thead>
                        <tr className="border-b border-gray-600">
                          <th className="py-2 text-left text-sm">Set</th>
                          <th className="py-2 text-left text-sm">Previous</th>
                          <th className="py-2 text-left text-sm">Lbs</th>
                          <th className="py-2 text-left text-sm">Reps</th>
                          <th className="py-2 text-center text-sm">✓</th>
                        </tr>
                      </thead>
                      <tbody>
                        {exerciseSets.map((set) => {
                          const prevLabel = set.previousWeight !== undefined
                            ? `${set.previousWeight} lb x ${set.previousReps || set.prescribedReps}`
                            : '—';
                          
                          return (
                            <tr key={set.id} className="border-b border-gray-700">
                              <td className="py-2 text-sm">{set.setNumber}</td>
                              <td className="py-2 text-sm">{prevLabel}</td>
                              <td className="py-2">
                                <input
                                  type="number"
                                  value={set.actualWeight ?? set.prescribedWeight}
                                  onChange={(e) => updateSet(set.id, { actualWeight: Number(e.target.value) })}
                                  disabled={set.completed}
                                  className="w-16 p-1 bg-transparent border border-gray-600 rounded text-white text-sm"
                                />
                              </td>
                              <td className="py-2">
                                <input
                                  type="number"
                                  value={set.actualReps ?? set.prescribedReps}
                                  onChange={(e) => updateSet(set.id, { actualReps: Number(e.target.value) })}
                                  disabled={set.completed}
                                  className="w-12 p-1 bg-transparent border border-gray-600 rounded text-white text-sm"
                                />
                              </td>
                              <td className="py-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={set.completed}
                                  onChange={(e) => updateSet(set.id, { completed: e.target.checked })}
                                  className="w-4 h-4 text-green-400"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ))}

      <button
        onClick={handleFinishWorkout}
        disabled={isLoading}
        className="w-full bg-red-500 hover:bg-red-600 text-white py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Saving Workout...' : 'Finish Workout'}
      </button>
    </div>
  );
} 