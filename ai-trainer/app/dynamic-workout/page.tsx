'use client';

import { useState } from 'react';
import WorkoutStarter from '@/app/components/WorkoutStarter';

export default function DynamicWorkoutPage() {
  const [selectedWorkout, setSelectedWorkout] = useState<any>(null);
  const [workoutStarted, setWorkoutStarted] = useState(false);

  const handleWorkoutSelected = (workout: any) => {
    setSelectedWorkout(workout);
    setWorkoutStarted(true);
  };

  const handleWorkoutComplete = async (workoutData: any) => {
    try {
      const response = await fetch('/api/dynamicWorkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'demo-user-id' // In real app, get from auth
        },
        body: JSON.stringify({ workoutData })
      });

      const result = await response.json();
      
      if (result.suggestion) {
        alert(`AI Suggestion: ${result.suggestion}`);
      }
    } catch (error) {
      console.error('Error completing workout:', error);
    }
  };

  const resetWorkout = () => {
    setSelectedWorkout(null);
    setWorkoutStarted(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4">Dynamic Workout Generator</h1>
            <p className="text-gray-400 text-lg">
              AI-powered workout suggestions based on your training patterns
            </p>
          </div>

          {!workoutStarted ? (
            <div className="bg-gray-800 rounded-lg shadow-xl">
              <WorkoutStarter 
                userId="demo-user-id"
                onWorkoutSelected={handleWorkoutSelected}
              />
            </div>
          ) : (
            <div className="bg-gray-800 rounded-lg shadow-xl p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Your Workout</h2>
                <button 
                  onClick={resetWorkout}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  Start New Workout
                </button>
              </div>

              {selectedWorkout && (
                <div className="space-y-6">
                  {/* Workout Type Info */}
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="text-lg font-semibold mb-2">Workout Type</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-400">Type:</span>
                        <span className="ml-2 capitalize">{selectedWorkout.type}</span>
                      </div>
                      {selectedWorkout.pattern && (
                        <div>
                          <span className="text-gray-400">Pattern:</span>
                          <span className="ml-2">{selectedWorkout.pattern}</span>
                        </div>
                      )}
                      {selectedWorkout.dayType && (
                        <div>
                          <span className="text-gray-400">Day Type:</span>
                          <span className="ml-2 capitalize">{selectedWorkout.dayType}</span>
                        </div>
                      )}
                      {selectedWorkout.coreLift && (
                        <div>
                          <span className="text-gray-400">Core Lift:</span>
                          <span className="ml-2">{selectedWorkout.coreLift}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Warmup */}
                  {selectedWorkout.warmup && (
                    <div className="bg-gray-700 rounded-lg p-4">
                      <h3 className="text-lg font-semibold mb-3 text-yellow-400">Warmup</h3>
                      <div className="space-y-2">
                        {selectedWorkout.warmup.map((exercise: any, index: number) => (
                          <div key={index} className="flex justify-between items-center">
                            <span>{exercise.name}</span>
                            <span className="text-gray-400">{exercise.duration}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Main Work */}
                  {selectedWorkout.mainWork && selectedWorkout.mainWork.length > 0 && (
                    <div className="bg-gray-700 rounded-lg p-4">
                      <h3 className="text-lg font-semibold mb-3 text-red-400">Main Work</h3>
                      <div className="space-y-3">
                        {selectedWorkout.mainWork.map((exercise: any, index: number) => (
                          <div key={index} className="flex justify-between items-center">
                            <span className="font-medium">{exercise}</span>
                            <span className="text-gray-400">Primary Movement</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Accessories */}
                  {selectedWorkout.accessories && selectedWorkout.accessories.length > 0 && (
                    <div className="bg-gray-700 rounded-lg p-4">
                      <h3 className="text-lg font-semibold mb-3 text-blue-400">Accessories</h3>
                      <div className="space-y-3">
                        {selectedWorkout.accessories.map((exercise: any, index: number) => (
                          <div key={index} className="flex justify-between items-center">
                            <span>{exercise}</span>
                            <span className="text-gray-400">3 sets</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Cooldown */}
                  {selectedWorkout.cooldown && (
                    <div className="bg-gray-700 rounded-lg p-4">
                      <h3 className="text-lg font-semibold mb-3 text-green-400">Cooldown</h3>
                      <div className="space-y-2">
                        {selectedWorkout.cooldown.map((exercise: any, index: number) => (
                          <div key={index} className="flex justify-between items-center">
                            <span>{exercise.name}</span>
                            <span className="text-gray-400">{exercise.duration}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-4 pt-4">
                    <button 
                      onClick={() => handleWorkoutComplete(selectedWorkout)}
                      className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Complete Workout
                    </button>
                    <button 
                      onClick={() => console.log('Starting workout timer...')}
                      className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Start Timer
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Features Demo */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="text-3xl mb-4">🧠</div>
              <h3 className="text-xl font-semibold mb-2">Smart Detection</h3>
              <p className="text-gray-400 text-sm">
                Analyzes your recent workouts to suggest the next logical training day
              </p>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="text-3xl mb-4">🎯</div>
              <h3 className="text-xl font-semibold mb-2">Pattern Learning</h3>
              <p className="text-gray-400 text-sm">
                Learns your training preferences and suggests saving consistent patterns
              </p>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="text-3xl mb-4">⚡</div>
              <h3 className="text-xl font-semibold mb-2">Equipment Aware</h3>
              <p className="text-gray-400 text-sm">
                Only suggests exercises you can perform with your available equipment
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 