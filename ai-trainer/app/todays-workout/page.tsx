'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkoutStore } from '@/lib/workoutStore';

export default function TodaysWorkoutPage() {
  const router = useRouter();
  const { setPending } = useWorkoutStore();
  const [selectedTime, setSelectedTime] = useState(45);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [workoutData, setWorkoutData] = useState<any>(null);

  const workoutTypes = [
    { id: 'push', label: 'PUSH', description: 'Chest, Shoulders, Triceps' },
    { id: 'pull', label: 'PULL', description: 'Back, Biceps' },
    { id: 'legs', label: 'LEGS', description: 'Quads, Hamstrings, Glutes' },
    { id: 'upper body', label: 'UPPER BODY', description: 'Chest, Back, Shoulders, Arms' },
    { id: 'full body', label: 'FULL BODY', description: 'Total Body Workout' },
    { id: 'hiit', label: 'HIIT', description: 'High Intensity Intervals' }
  ];

  const handleWorkoutSelect = async (type: string) => {
    setError(null);
    setIsGenerating(true);
    setSelectedType(type);

    try {
      const response = await fetch('/api/generate-workout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workoutType: type,
          timeAvailable: selectedTime
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      // Store the workout data
      const workout = data.workout;
      setWorkoutData(workout);
      
      // Set in workout store
      setPending({
        planId: data.sessionId,
        warmup: workout.warmup || [],
        workout: workout.main || [],
        cooldown: workout.cooldown || [],
        accessories: workout.accessories || []
      });

    } catch (err) {
      console.error('Error generating workout:', err);
      setError(err.message || 'Failed to generate workout');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStartWorkout = () => {
    if (workoutData) {
      router.push('/workout/active');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Today's Workout</h1>

        {/* Time Selection */}
        <div className="mb-8">
          <h2 className="text-xl mb-4">Time Available</h2>
          <div className="flex gap-4">
            {[15, 30, 45, 60].map(time => (
              <button
                key={time}
                onClick={() => setSelectedTime(time)}
                className={`px-6 py-3 rounded-lg ${
                  selectedTime === time
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-800 text-gray-300'
                }`}
              >
                {time} min
              </button>
            ))}
          </div>
        </div>

        {/* Workout Type Selection */}
        <div className="mb-8">
          <h2 className="text-xl mb-4">Choose Your Workout</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {workoutTypes.map(type => (
              <button
                key={type.id}
                onClick={() => handleWorkoutSelect(type.id)}
                disabled={isGenerating}
                className={`p-6 rounded-lg text-center transition-all ${
                  selectedType === type.id
                    ? 'bg-blue-600 ring-2 ring-blue-400'
                    : 'bg-gray-800 hover:bg-gray-700'
                } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <h3 className="font-bold text-lg">{type.label}</h3>
                <p className="text-sm text-gray-400 mt-1">{type.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Workout Display */}
        {workoutData && selectedType && (
          <div className="bg-gray-800 rounded-lg p-6 mb-8">
            <h3 className="text-2xl font-bold mb-4">
              {selectedType.toUpperCase()} Workout
            </h3>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-green-400">Warmup ({workoutData.warmup?.length || 0} exercises)</h4>
                <ul className="list-disc list-inside text-gray-300">
                  {workoutData.warmup?.map((ex: string, i: number) => (
                    <li key={i}>{ex}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-blue-400">Main ({workoutData.main?.length || 0} exercises)</h4>
                <ul className="list-disc list-inside text-gray-300">
                  {workoutData.main?.map((ex: string, i: number) => (
                    <li key={i}>{ex}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-purple-400">Accessories ({workoutData.accessories?.length || 0} exercises)</h4>
                <ul className="list-disc list-inside text-gray-300">
                  {workoutData.accessories?.map((ex: string, i: number) => (
                    <li key={i}>{ex}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-orange-400">Cooldown ({workoutData.cooldown?.length || 0} exercises)</h4>
                <ul className="list-disc list-inside text-gray-300">
                  {workoutData.cooldown?.map((ex: string, i: number) => (
                    <li key={i}>{ex}</li>
                  ))}
                </ul>
              </div>
            </div>

            <button
              onClick={handleStartWorkout}
              className="w-full mt-6 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
            >
              Start Workout
            </button>
          </div>
        )}

        {/* Loading State */}
        {isGenerating && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            <p className="mt-2">Generating your workout...</p>
          </div>
        )}
      </div>
    </div>
  );
} 