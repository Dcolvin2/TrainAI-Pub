'use client';

// Enhanced workout display with Main Lift vs Accessory badges
// Updated to use isAccessory flag from LLM workout data

import React, { useState, useEffect } from 'react';

interface Exercise {
  name: string;
  previous?: string;
  sets?: number;
  reps?: string;
  isAccessory?: boolean;
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
  const [restTimer, setRestTimer] = useState<number | null>(null);
  const [isResting, setIsResting] = useState(false);

  const startRestTimer = (seconds: number) => {
    setRestTimer(seconds);
    setIsResting(true);
  };

  useEffect(() => {
    if (restTimer && restTimer > 0) {
      const timer = setTimeout(() => {
        setRestTimer(restTimer - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (restTimer === 0) {
      setIsResting(false);
      setRestTimer(null);
    }
  }, [restTimer]);

  return (
    <div className="min-h-screen bg-black text-white p-6">
      {/* Rest Timer Bar at Top */}
      {isResting && (
        <div className="fixed top-0 left-0 right-0 bg-gray-900 p-4 z-50">
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-center">
              <span className="text-lg">Rest Timer</span>
              <span className="text-2xl font-bold">{restTimer}s</span>
            </div>
            <div className="w-full bg-gray-800 h-2 mt-2 rounded">
              <div 
                className="bg-green-500 h-full rounded transition-all"
                style={{ width: `${((restTimer || 0) / 60) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-4xl mx-auto mt-20">
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
            onStartRest={() => startRestTimer(60)}
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
  };

  const badge = exercise.isAccessory ? "Accessory" : "Main Lift";
  const badgeColor = exercise.isAccessory ? "bg-blue-600" : "bg-green-600";

  return (
    <div className="bg-gray-900 rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold">{exercise.name}</h3>
        <span className={`px-2 py-1 text-xs text-white rounded ${badgeColor}`}>
          {badge}
        </span>
      </div>
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
              onChange={(e) => completeSet(idx)}
              className="w-5 h-5 cursor-pointer text-green-500 bg-gray-800 border-gray-600 rounded focus:ring-green-500 focus:ring-2"
              disabled={false}
            />
          </div>
        ))}
      </div>
      
      <button
        onClick={onStartRest}
        className="mt-4 text-green-500 hover:text-green-400"
      >
        + Add Set
      </button>
    </div>
  );
} 