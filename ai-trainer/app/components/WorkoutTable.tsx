'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useWorkoutStore } from '@/lib/workoutStore';

interface GeneratedWorkout {
  warmup: string[];
  workout: string[];
  cooldown: string[];
  accessories?: string[];
  prompt?: string;
}

interface NikeExercise {
  workout: number;
  workout_type: string;
  sets: number;
  reps: string;
  exercise: string;
  exercise_type: string;
  instructions?: string;
}

interface NikeWorkout {
  exercises: NikeExercise[];
  workoutNumber: number;
}

interface PreviousSetData {
  weight: number;
  reps: number;
}

interface PreviousExerciseData {
  [setNumber: number]: PreviousSetData;
}

interface PreviousWorkoutData {
  [exerciseName: string]: PreviousExerciseData;
}

interface EnrichedNikeExercise extends NikeExercise {
  previousSets?: PreviousExerciseData;
}

interface EnrichedGeneratedWorkout extends GeneratedWorkout {
  previousData?: PreviousWorkoutData;
}

interface WorkoutSet {
  id: string;
  exerciseName: string;
  setNumber: number;
  previousWeight?: number | null;
  previousReps?: number | null;
  prescribedWeight: number;
  prescribedReps: number;
  actualWeight?: number;
  actualReps?: number;
  completed: boolean;
  restSeconds: number;
  section: 'warmup' | 'workout' | 'cooldown' | 'accessories';
}



interface WorkoutTableProps {
  workout: EnrichedGeneratedWorkout | NikeWorkout;
  onFinishWorkout?: () => void;
  onStopTimer?: () => void;
  elapsedTime?: number;
  showPrevious?: boolean;
  quickEntrySets?: any[];
}

// Format previous weight and reps for display
const formatPrev = (w?: number | null, r?: number | null) => 
  w && r ? `${w} lb × ${r}` : '—';

// Parse workout string into structured data
const parseWorkoutString = (workoutString: string, section: 'warmup' | 'workout' | 'cooldown' | 'accessories'): WorkoutSet => {
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
const getDefaultSetCount = (section: 'warmup' | 'workout' | 'cooldown' | 'accessories', exerciseName: string): number => {
  // Determine exercise type based on section and exercise name
  if (section === 'warmup') return 1;
  if (section === 'cooldown') return 1;
  if (section === 'accessories') return 3;
  
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



// Convert workout arrays to structured sets with proper set counts
const convertWorkoutToSets = (workout: EnrichedGeneratedWorkout | NikeWorkout): WorkoutSet[] => {
  const sets: WorkoutSet[] = [];
  
  // If it's a Nike workout, use the actual exercise data
  if ('exercises' in workout) {
    workout.exercises.forEach((exercise: NikeExercise) => {
      // Determine section based on exercise type
      let section: 'warmup' | 'workout' | 'cooldown' = 'workout';
      const exerciseType = exercise.exercise_type.toLowerCase();
      
      if (exerciseType.includes('warmup') ||
          (exerciseType.includes('mobility') && !exerciseType.includes('cool down'))) {
        section = 'warmup';
      } else if (exerciseType.includes('cooldown') ||
                 exerciseType.includes('cool down') ||
                 exerciseType.includes('mobility cool down') ||
                 exerciseType.includes('stretch')) {
        section = 'cooldown';
      }
      
      // Parse reps (handle different formats)
      let prescribedReps = 1;
      if (exercise.reps !== '-' && !isNaN(Number(exercise.reps))) {
        prescribedReps = Number(exercise.reps);
      } else if (exercise.reps.includes('min') || exercise.reps.includes('minute')) {
        // Convert time-based reps to seconds
        const timeMatch = exercise.reps.match(/(\d+)/);
        prescribedReps = timeMatch ? Number(timeMatch[1]) * 60 : 60;
      }
      
      // Get previous data for this exercise if available
      const previousSets = (exercise as EnrichedNikeExercise).previousSets || {};
      
      // Create the correct number of sets based on database
      for (let i = 0; i < exercise.sets; i++) {
        const prevSet = previousSets[i + 1]; // Set numbers are 1-indexed
        const set: WorkoutSet = {
          id: `${exercise.exercise}-${section}-${Date.now()}-${Math.random()}-${i}`,
          exerciseName: exercise.exercise,
          setNumber: i + 1,
          prescribedWeight: 0, // Default to bodyweight
          prescribedReps: prescribedReps,
          completed: false,
          restSeconds: 60, // Default rest
          section: section,
          previousWeight: prevSet?.weight || null,
          previousReps: prevSet?.reps || null
        };
        sets.push(set);
      }
    });
  } else {
    // Handle GeneratedWorkout format (existing logic)
    const generatedWorkout = workout;
    const previousData = (workout as EnrichedGeneratedWorkout).previousData || {};
    
    // Process warmup
    generatedWorkout.warmup.forEach((item: string) => {
      const baseSet = parseWorkoutString(item, 'warmup');
      const setCount = getDefaultSetCount('warmup', baseSet.exerciseName);
      const exercisePrevData = previousData[baseSet.exerciseName] || {};
      
      for (let i = 0; i < setCount; i++) {
        const set = { ...baseSet };
        set.id = `${baseSet.exerciseName}-warmup-${Date.now()}-${Math.random()}-${i}`;
        set.setNumber = i + 1;
        const prevSet = exercisePrevData[i + 1];
        set.previousWeight = prevSet?.weight || null;
        set.previousReps = prevSet?.reps || null;
        sets.push(set);
      }
    });
    
    // Process main workout
    generatedWorkout.workout.forEach((item: string) => {
      const baseSet = parseWorkoutString(item, 'workout');
      const setCount = getDefaultSetCount('workout', baseSet.exerciseName);
      const exercisePrevData = previousData[baseSet.exerciseName] || {};
      
      for (let i = 0; i < setCount; i++) {
        const set = { ...baseSet };
        set.id = `${baseSet.exerciseName}-workout-${Date.now()}-${Math.random()}-${i}`;
        set.setNumber = i + 1;
        const prevSet = exercisePrevData[i + 1];
        set.previousWeight = prevSet?.weight || null;
        set.previousReps = prevSet?.reps || null;
        sets.push(set);
      }
    });
    
    // Process accessories
    if (generatedWorkout.accessories) {
      generatedWorkout.accessories.forEach((item: string) => {
        const baseSet = parseWorkoutString(item, 'accessories');
        const setCount = getDefaultSetCount('accessories', baseSet.exerciseName);
        const exercisePrevData = previousData[baseSet.exerciseName] || {};
        
        for (let i = 0; i < setCount; i++) {
          const set = { ...baseSet };
          set.id = `${baseSet.exerciseName}-accessories-${Date.now()}-${Math.random()}-${i}`;
          set.setNumber = i + 1;
          const prevSet = exercisePrevData[i + 1];
          set.previousWeight = prevSet?.weight || null;
          set.previousReps = prevSet?.reps || null;
          sets.push(set);
        }
      });
    }
    
    // Process cooldown
    generatedWorkout.cooldown.forEach((item: string) => {
      const baseSet = parseWorkoutString(item, 'cooldown');
      const setCount = getDefaultSetCount('cooldown', baseSet.exerciseName);
      const exercisePrevData = previousData[baseSet.exerciseName] || {};
      
      for (let i = 0; i < setCount; i++) {
        const set = { ...baseSet };
        set.id = `${baseSet.exerciseName}-cooldown-${Date.now()}-${Math.random()}-${i}`;
        set.setNumber = i + 1;
        const prevSet = exercisePrevData[i + 1];
        set.previousWeight = prevSet?.weight || null;
        set.previousReps = prevSet?.reps || null;
        sets.push(set);
      }
    });
  }
  
  return sets;
};

export default function WorkoutTable({ workout, onFinishWorkout, onStopTimer, elapsedTime = 0, showPrevious = false, quickEntrySets = [] }: WorkoutTableProps) {
  const { user } = useAuth();
  const router = useRouter();
  
  // Get local sets from store
  const { getLocalSetsForExercise, clearLocalSets, localSets } = useWorkoutStore();
  
  const [sets, setSets] = useState<WorkoutSet[]>([]);
  const [sessionId, setSessionId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  console.log('Workout data received:', workout);

  // TEMPORARY LOGGING
  console.log('🔍 WORKOUT TABLE RENDER:', { 
    workout, 
    quickEntrySets, 
    setsCount: sets.length,
    sets: sets.slice(0, 3), // First 3 sets for debugging
    // Log local sets for each exercise
    localSets: sets.map(s => ({ exercise: s.exerciseName, localSets: getLocalSetsForExercise(s.exerciseName) }))
  });

  // Initialize sets from workout data
  useEffect(() => {
    if (workout) {
      const workoutSets = convertWorkoutToSets(workout);
      setSets(workoutSets);
      setSessionId(`session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    }
  }, [workout]);

  // Merge local sets with server sets
  const mergeLocalAndServerSets = (serverSets: WorkoutSet[]): WorkoutSet[] => {
    const merged = [...serverSets];
    
    // Group server sets by exercise
    const serverSetsByExercise = new Map<string, WorkoutSet[]>();
    serverSets.forEach(set => {
      if (!serverSetsByExercise.has(set.exerciseName)) {
        serverSetsByExercise.set(set.exerciseName, []);
      }
      serverSetsByExercise.get(set.exerciseName)!.push(set);
    });
    
    // For each exercise, merge local sets
    serverSetsByExercise.forEach((serverSetsForExercise, exerciseName) => {
      const localSets = getLocalSetsForExercise(exerciseName);
      
      if (localSets.length > 0) {
        console.log(`🔍 Merging local sets for ${exerciseName}:`, localSets);
        
        localSets.forEach(localSet => {
          // Find if there's already a server set with this set number
          const existingIndex = merged.findIndex(s => 
            s.exerciseName === exerciseName && s.setNumber === localSet.setNumber
          );
          
          if (existingIndex >= 0) {
            // Update existing set with local data
            merged[existingIndex] = {
              ...merged[existingIndex],
              actualWeight: localSet.actualWeight,
              actualReps: localSet.reps,
              completed: localSet.completed
            };
          } else {
            // Create new set from local data
            const newSet: WorkoutSet = {
              id: `${exerciseName}-local-${localSet.setNumber}`,
              exerciseName,
              setNumber: localSet.setNumber,
              prescribedWeight: 0,
              prescribedReps: localSet.reps,
              actualWeight: localSet.actualWeight,
              actualReps: localSet.reps,
              completed: localSet.completed,
              restSeconds: 60,
              section: 'workout'
            };
            merged.push(newSet);
          }
        });
      }
    });
    
    // Sort by exercise name and set number
    return merged.sort((a, b) => {
      if (a.exerciseName !== b.exerciseName) {
        return a.exerciseName.localeCompare(b.exerciseName);
      }
      return a.setNumber - b.setNumber;
    });
  };

  // Update sets when local sets change
  useEffect(() => {
    if (sets.length > 0) {
      const mergedSets = mergeLocalAndServerSets(sets);
      setSets(mergedSets);
    }
  }, [sets, getLocalSetsForExercise]);

  // Apply quick entry sets when they change
  useEffect(() => {
    quickEntrySets.forEach(quickEntry => {
      applyQuickEntrySets(quickEntry.exerciseName, quickEntry.entries);
    });
  }, [quickEntrySets]);

  // Apply quick entry sets to the table
  const applyQuickEntrySets = (exerciseName: string, entries: any[]) => {
    setSets(prev => {
      const updated = [...prev];
      
      entries.forEach(entry => {
        // Find existing set or create new one
        let setIndex = updated.findIndex(s => 
          s.exerciseName === exerciseName && s.setNumber === entry.setNumber
        );
        
        if (setIndex >= 0) {
          // Update existing set
          updated[setIndex] = {
            ...updated[setIndex],
            actualReps: entry.reps,
            actualWeight: entry.actualWeight,
            completed: entry.completed
          };
        } else {
          // Create new set
          const newSet: WorkoutSet = {
            id: `${exerciseName}-workout-${Date.now()}-${Math.random()}-${entry.setNumber}`,
            exerciseName,
            setNumber: entry.setNumber,
            prescribedWeight: 0,
            prescribedReps: entry.reps,
            actualReps: entry.reps,
            actualWeight: entry.actualWeight,
            completed: entry.completed,
            restSeconds: 60,
            section: 'workout'
          };
          updated.push(newSet);
        }
      });
      
      return updated;
    });
  };

  // Update set completion
  const updateSet = (setId: string, updates: Partial<WorkoutSet>) => {
    setSets(prev => prev.map(set => 
      set.id === setId ? { ...set, ...updates } : set
    ));
  };

  // Add a set to an exercise
  const addSet = (exerciseName: string, section: 'warmup' | 'workout' | 'cooldown' | 'accessories') => {
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
      // Get all local sets from store
      const allLocalSets = Object.values(localSets).flat();
      console.log('🔍 Saving local sets:', allLocalSets);
      
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

      // Save individual sets (including local sets from store)
      const completedSets = sets.filter(s => s.completed);
      const localSetsToSave = allLocalSets.map((localSet: any) => ({
        sessionId,
        exerciseName: localSet.exerciseName,
        setNumber: localSet.setNumber,
        reps: localSet.reps,
        actualWeight: localSet.actualWeight,
        completed: localSet.completed
      }));
      
      const allSetsToSave = [...completedSets, ...localSetsToSave];
      
      if (allSetsToSave.length > 0) {
        const setsResponse = await fetch('/api/saveWorkoutSets', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user.id,
            sessionId,
            sets: allSetsToSave
          })
        });

        if (!setsResponse.ok) {
          const errorData = await setsResponse.json();
          throw new Error(`Failed to save workout sets: ${errorData.details || errorData.error || 'Unknown error'}`);
        }
      }

      // Clear local sets from store
      clearLocalSets();
      console.log('✅ Cleared local sets from store');

      // Handle Nike workout completion
      if ('workoutNumber' in workout) {
        // This is a Nike workout - save to workouts table and update progress
        const today = new Date().toISOString().split('T')[0];
        const workoutType = workout.exercises[0]?.workout_type || 'Workout';
        const timerMinutes = Math.floor(elapsedTime / 60); // Convert seconds to minutes
        
        // 1. Save to workouts table
        const { error: workoutError } = await supabase
          .from('workouts')
          .insert({
            user_id: user.id,
            date: today,
            program_name: 'Nike',
            program_workout_number: workout.workoutNumber,
            workout_type: workoutType,
            duration_minutes: timerMinutes,
            sets: JSON.stringify(workout.exercises) // Full set plan
          });

        if (workoutError) {
          console.error('Error saving to workouts table:', workoutError);
        }

        // 2. Update last_nike_workout on profile
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ last_nike_workout: workout.workoutNumber })
          .eq('id', user.id);

        if (profileError) {
          console.error('Error updating Nike progress:', profileError);
        }
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
    { key: 'accessories', title: 'Accessories', sets: Object.entries(groupedSets).filter(([key]) => key.startsWith('accessories-')) },
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
                          {showPrevious && <th className="py-2 text-left text-sm">Previous</th>}
                          <th className="py-2 text-left text-sm">Lbs</th>
                          <th className="py-2 text-left text-sm">Reps</th>
                          <th className="py-2 text-center text-sm">✓</th>
                        </tr>
                      </thead>
                      <tbody>
                        {exerciseSets.map((set) => {
                          return (
                            <tr key={set.id} className="border-b border-gray-700">
                              <td className="py-2 text-sm">{set.setNumber}</td>
                              {showPrevious && (
                                <td className="py-2 text-sm">
                                  {formatPrev(set.previousWeight, set.previousReps)}
                                </td>
                              )}
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