'use client';

import { useState } from 'react';
import WorkoutStarter from '@/app/components/WorkoutStarter';
import PlannedWorkoutView from '@/app/components/PlannedWorkoutView';
import { type LegacyWorkout } from '@/lib/planWorkout';

// This is the table renderer that respects the isAccessory flag
function WorkoutTableRenderer({ workout }: { workout: LegacyWorkout }) {
  return (
    <div className="space-y-6">
      {/* Warmup */}
      {workout.warmup && workout.warmup.length > 0 && (
        <div className="bg-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-3 text-yellow-400">Warmup</h3>
          <div className="space-y-2">
            {workout.warmup.map((exercise: any, index: number) => (
              <div key={index} className="flex justify-between items-center">
                <span>{exercise.name}</span>
                <span className="text-gray-400">{exercise.duration || exercise.reps || '1 set'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Work - respect isAccessory for badges */}
      {workout.main && workout.main.length > 0 && (
        <div className="bg-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-3 text-red-400">Main Work</h3>
          <div className="space-y-3">
            {workout.main.map((exercise: any, index: number) => {
              const badge = exercise.isAccessory ? 'Accessory' : 'Main Lift';
              const badgeColor = exercise.isAccessory ? 'bg-blue-600' : 'bg-green-600';
              
              return (
                <div key={index} className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{exercise.name}</span>
                    <span className={`px-2 py-1 text-xs text-white rounded ${badgeColor}`}>
                      {badge}
                    </span>
                  </div>
                  <span className="text-gray-400">
                    {exercise.sets} sets × {exercise.reps || '8-12'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cooldown */}
      {workout.cooldown && workout.cooldown.length > 0 && (
        <div className="bg-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-3 text-green-400">Cooldown</h3>
          <div className="space-y-2">
            {workout.cooldown.map((exercise: any, index: number) => (
              <div key={index} className="flex justify-between items-center">
                <span>{exercise.name}</span>
                <span className="text-gray-400">{exercise.duration || exercise.reps || '1 set'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4 pt-4">
        <button 
          onClick={() => console.log('Workout completed:', workout)}
          className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          Complete Workout
        </button>
        <button 
          onClick={() => console.log('Starting workout:', workout)}
          className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Start Workout
        </button>
      </div>
    </div>
  );
}

export default function DynamicWorkoutPage() {
  const [workoutStarted, setWorkoutStarted] = useState(false);
  const [selectedWorkout, setSelectedWorkout] = useState<any>(null);

  const handleWorkoutSelected = (workout: any) => {
    setSelectedWorkout(workout);
    setWorkoutStarted(true);
  };

  const resetWorkout = () => {
    setSelectedWorkout(null);
    setWorkoutStarted(false);
  };

  const handleWorkoutComplete = (workout: any) => {
    console.log('Workout completed:', workout);
    // Add your workout completion logic here
    resetWorkout();
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

              {/* Use PlannedWorkoutView to drive the display */}
              <PlannedWorkoutView
                split={selectedWorkout?.type === 'full_body' ? 'full' : selectedWorkout?.type || 'push'}
                userId="demo-user-id"
                minutes={45}
                message=""
                renderTable={(workout) => <WorkoutTableRenderer workout={workout} />}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 