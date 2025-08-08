'use client';

import React, { useState, useEffect } from 'react';
import { RestTimer } from './RestTimer';

interface Exercise {
  name: string;
  previous?: string;
  sets?: number;
  reps?: string;
}

interface Workout {
  name: string;
  warmup: string[];
  main: Exercise[];
  cooldown: string[];
}

interface WorkoutDisplayProps {
  workout: Workout;
  onFinish: () => void;
}

export function WorkoutDisplay({ workout, onFinish }: WorkoutDisplayProps) {
  const [showRestTimer, setShowRestTimer] = useState(false);
  const [currentExercise, setCurrentExercise] = useState<string>('');

  const startRestTimer = (exerciseName: string) => {
    setCurrentExercise(exerciseName);
    setShowRestTimer(true);
  };

  const handleRestComplete = () => {
    setShowRestTimer(false);
    setCurrentExercise('');
  };

  return (
    <div className="min-h-screen bg-black text-white p-6">
      {/* Rest Timer Modal */}
      {showRestTimer && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4">
            <div className="text-center mb-4">
              <h3 className="text-xl font-semibold text-white mb-2">
                Rest Timer
              </h3>
              <p className="text-gray-400">
                Resting after: <span className="text-green-400">{currentExercise}</span>
              </p>
            </div>
            <RestTimer 
              defaultRestTime={180} 
              onRestComplete={handleRestComplete}
            />
            <button
              onClick={handleRestComplete}
              className="w-full mt-4 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Skip Rest
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-4xl mx-auto">
        {/* Workout Header */}
        <h1 className="text-3xl font-bold mb-8">{workout.name}</h1>

        {/* Warm-up Section */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-6">Warm-up</h2>
          <div className="bg-gray-900 rounded-lg p-6">
            {workout.warmup.map((exercise, idx) => (
              <div key={idx} className="flex items-center mb-4">
                <span className="text-gray-400 mr-4">{idx + 1}</span>
                <span className="text-lg">{exercise}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Main Exercises */}
        {workout.main.map((exercise, idx) => (
          <ExerciseCard 
            key={idx}
            exercise={exercise}
            onStartRest={() => startRestTimer(exercise.name)}
          />
        ))}

        {/* Cool-down Section */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-6">Cool-down</h2>
          <div className="bg-gray-900 rounded-lg p-6">
            {workout.cooldown.map((exercise, idx) => (
              <div key={idx} className="flex items-center mb-4">
                <span className="text-gray-400 mr-4">{idx + 1}</span>
                <span className="text-lg">{exercise}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Finish Workout Button */}
        <button
          onClick={onFinish}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-8 rounded-lg text-lg transition-colors"
        >
          Finish Workout
        </button>
      </div>
    </div>
  );
}

// Exercise Card Component
interface ExerciseCardProps {
  exercise: Exercise;
  onStartRest: () => void;
}

function ExerciseCard({ exercise, onStartRest }: ExerciseCardProps) {
  const [sets, setSets] = useState([
    { weight: 0, reps: 0, completed: false },
    { weight: 0, reps: 0, completed: false },
    { weight: 0, reps: 0, completed: false }
  ]);

  const updateSet = (index: number, field: 'weight' | 'reps', value: string) => {
    setSets(prev => prev.map((set, idx) => 
      idx === index ? { ...set, [field]: parseInt(value) || 0 } : set
    ));
  };

  const completeSet = (index: number) => {
    setSets(prev => prev.map((set, idx) => 
      idx === index ? { ...set, completed: !set.completed } : set
    ));
    
    // Start rest timer when a set is completed
    if (!sets[index].completed) {
      onStartRest();
    }
  };

  return (
    <div className="bg-gray-900 rounded-lg p-6 mb-6">
      <h3 className="text-xl font-semibold mb-4">{exercise.name}</h3>
      <div className="space-y-3">
        <div className="grid grid-cols-5 gap-4 text-sm text-gray-400 mb-2">
          <span>Set</span>
          <span>Previous</span>
          <span className="text-right">lbs</span>
          <span className="text-right">Reps</span>
          <span></span>
        </div>
        
        {sets.map((set, idx) => (
          <div key={idx} className="grid grid-cols-5 gap-4 items-center">
            <span className="text-lg">{idx + 1}</span>
            <span className="text-gray-500">{exercise.previous || 'N/A'}</span>
            <input
              type="number"
              value={set.weight}
              onChange={(e) => updateSet(idx, 'weight', e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-right"
            />
            <input
              type="number"
              value={set.reps}
              onChange={(e) => updateSet(idx, 'reps', e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-right"
            />
            <input
              type="checkbox"
              checked={set.completed || false}
              onChange={() => completeSet(idx)}
              className="w-5 h-5 cursor-pointer text-green-500 bg-gray-800 border-gray-600 rounded focus:ring-green-500 focus:ring-2"
              disabled={false}
            />
          </div>
        ))}
      </div>
      
      <div className="flex justify-between items-center mt-4">
        <button
          onClick={onStartRest}
          className="text-green-500 hover:text-green-400"
        >
          + Add Set
        </button>
        <button
          onClick={onStartRest}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Start Rest Timer
        </button>
      </div>
    </div>
  );
} 