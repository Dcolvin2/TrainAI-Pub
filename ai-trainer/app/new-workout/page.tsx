'use client';

import { useState, useEffect } from 'react';
import WorkoutTypeSelector from '@/app/components/WorkoutTypeSelector';
import { generateWorkoutForType, getWorkoutSuggestions, saveWorkout } from '@/lib/workoutGenerator';

interface WorkoutType {
  id: string;
  name: string;
  category: string;
  target_muscles: string[];
  movement_patterns: string[];
}

interface GeneratedWorkout {
  type: WorkoutType;
  warmup: any[];
  mainExercises: any[];
  accessories: any[];
  cooldown: any[];
  duration: number;
  focus: string;
}

export default function NewWorkoutPage() {
  const [selectedWorkoutType, setSelectedWorkoutType] = useState<WorkoutType | null>(null);
  const [generatedWorkout, setGeneratedWorkout] = useState<GeneratedWorkout | null>(null);
  const [suggestedType, setSuggestedType] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [showSelector, setShowSelector] = useState(true);
  const [userId] = useState('demo-user-id'); // In real app, get from auth

  useEffect(() => {
    fetchWorkoutSuggestion();
  }, []);

  const fetchWorkoutSuggestion = async () => {
    try {
      const suggestion = await getWorkoutSuggestions(userId);
      if (suggestion) {
        setSuggestedType(suggestion.type);
      }
    } catch (error) {
      console.error('Error fetching workout suggestion:', error);
    }
  };

  const handleWorkoutTypeSelected = async (workoutType: WorkoutType) => {
    setLoading(true);
    try {
      const workout = await generateWorkoutForType(workoutType, userId);
      setGeneratedWorkout(workout);
      setSelectedWorkoutType(workoutType);
      setShowSelector(false);
    } catch (error) {
      console.error('Error generating workout:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveWorkout = async () => {
    if (!generatedWorkout || !selectedWorkoutType) return;

    try {
      setLoading(true);
      await saveWorkout(userId, generatedWorkout, selectedWorkoutType.id);
      alert('Workout saved successfully!');
      resetWorkout();
    } catch (error) {
      console.error('Error saving workout:', error);
      alert('Failed to save workout');
    } finally {
      setLoading(false);
    }
  };

  const resetWorkout = () => {
    setSelectedWorkoutType(null);
    setGeneratedWorkout(null);
    setShowSelector(true);
  };

  const formatMuscles = (muscles: string[]) => {
    return muscles.map(muscle => 
      muscle.charAt(0).toUpperCase() + muscle.slice(1)
    ).join(', ');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4">Create New Workout</h1>
            <p className="text-gray-400 text-lg">
              Choose your workout type and let AI generate the perfect routine
            </p>
          </div>

          {showSelector ? (
            <div className="bg-gray-800 rounded-lg shadow-xl">
              <WorkoutTypeSelector 
                userId={userId}
                onWorkoutTypeSelected={handleWorkoutTypeSelected}
                suggestedType={suggestedType}
              />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Workout Type Info */}
              <div className="bg-gray-800 rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold">Your {selectedWorkoutType?.name.replace('_', ' ')} Workout</h2>
                  <button 
                    onClick={resetWorkout}
                    className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                  >
                    Choose Different Type
                  </button>
                </div>
                
                {selectedWorkoutType && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Type:</span>
                      <span className="ml-2 capitalize">{selectedWorkoutType.name.replace('_', ' ')}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Category:</span>
                      <span className="ml-2 capitalize">{selectedWorkoutType.category.replace('_', ' ')}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Target Muscles:</span>
                      <span className="ml-2">{formatMuscles(selectedWorkoutType.target_muscles)}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Duration:</span>
                      <span className="ml-2">{generatedWorkout?.duration} min</span>
                    </div>
                  </div>
                )}
              </div>

              {loading ? (
                <div className="bg-gray-800 rounded-lg p-6 flex items-center justify-center">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400 mx-auto mb-4"></div>
                    <p className="text-gray-400">Generating your workout...</p>
                  </div>
                </div>
              ) : generatedWorkout ? (
                <div className="space-y-6">
                  {/* Warmup */}
                  <div className="bg-gray-800 rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-4 text-yellow-400">Warmup</h3>
                    <div className="space-y-3">
                      {generatedWorkout.warmup.map((exercise, index) => (
                        <div key={index} className="flex justify-between items-center p-3 bg-gray-700 rounded">
                          <span className="font-medium">{exercise.name}</span>
                          <span className="text-gray-400">{exercise.duration}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Main Exercises */}
                  <div className="bg-gray-800 rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-4 text-red-400">Main Exercises</h3>
                    <div className="space-y-3">
                      {generatedWorkout.mainExercises.map((exercise, index) => (
                        <div key={index} className="p-3 bg-gray-700 rounded">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-medium">{exercise.name}</span>
                            <span className="text-gray-400">{exercise.sets} sets × {exercise.reps}</span>
                          </div>
                          <div className="text-sm text-gray-400">
                            Rest: {exercise.rest}s • {exercise.instruction}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Accessories */}
                  <div className="bg-gray-800 rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-4 text-blue-400">Accessories</h3>
                    <div className="space-y-3">
                      {generatedWorkout.accessories.map((exercise, index) => (
                        <div key={index} className="p-3 bg-gray-700 rounded">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-medium">{exercise.name}</span>
                            <span className="text-gray-400">{exercise.sets} sets × {exercise.reps}</span>
                          </div>
                          <div className="text-sm text-gray-400">
                            Rest: {exercise.rest}s • {exercise.instruction}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Cooldown */}
                  <div className="bg-gray-800 rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-4 text-green-400">Cooldown</h3>
                    <div className="space-y-3">
                      {generatedWorkout.cooldown.map((exercise, index) => (
                        <div key={index} className="flex justify-between items-center p-3 bg-gray-700 rounded">
                          <span className="font-medium">{exercise.name}</span>
                          <span className="text-gray-400">{exercise.duration}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-4 pt-4">
                    <button 
                      onClick={handleSaveWorkout}
                      disabled={loading}
                      className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      {loading ? 'Saving...' : 'Save Workout'}
                    </button>
                    <button 
                      onClick={() => console.log('Starting workout timer...')}
                      className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Start Timer
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* Features Info */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="text-3xl mb-4">🎯</div>
              <h3 className="text-xl font-semibold mb-2">Smart Selection</h3>
              <p className="text-gray-400 text-sm">
                AI suggests workouts based on your training history and muscle group needs
              </p>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="text-3xl mb-4">⚡</div>
              <h3 className="text-xl font-semibold mb-2">Equipment Aware</h3>
              <p className="text-gray-400 text-sm">
                Only shows exercises you can perform with your available equipment
              </p>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="text-3xl mb-4">🧠</div>
              <h3 className="text-xl font-semibold mb-2">Pattern Learning</h3>
              <p className="text-gray-400 text-sm">
                Learns your preferences and suggests optimal training sequences
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 