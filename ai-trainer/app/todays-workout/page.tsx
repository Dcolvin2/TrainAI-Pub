'use client';

import { useState } from 'react';

// Simple icon component (since we don't have lucide-react)
const MessageCircle = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);

export default function TodaysWorkoutPage() {
  const [showChat, setShowChat] = useState(false);
  const [timeAvailable, setTimeAvailable] = useState(45);

  const popularChoices = [
    { id: 'push', label: 'Push', muscles: 'Chest, shoulders, triceps', color: 'bg-blue-500', icon: '💪' },
    { id: 'pull', label: 'Pull', muscles: 'Back, biceps', color: 'bg-green-500', icon: '🏋️' },
    { id: 'legs', label: 'Legs', muscles: 'Quads, hamstrings, glutes', color: 'bg-purple-500', icon: '🦵' },
    { id: 'upper', label: 'Upper Body', muscles: 'All upper body', color: 'bg-orange-500', icon: '💪' },
    { id: 'full', label: 'Full Body', muscles: 'Total body workout', color: 'bg-red-500', icon: '🏃' },
    { id: 'hiit', label: 'HIIT', muscles: 'High intensity', color: 'bg-yellow-500', icon: '⚡' },
    { id: 'chat', label: 'AI Chat', muscles: 'Custom workout with AI', color: 'bg-indigo-500', icon: '🤖' },
  ];

  const handleWorkoutSelect = async (workoutType: string) => {
    if (workoutType === 'chat') {
      setShowChat(true);
      return;
    }
    
    // Your existing workout generation logic
    const response = await fetch('/api/generate-workout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        timeAvailable, 
        workoutType,
        focus: workoutType 
      })
    });
    
    const data = await response.json();
    // Handle workout generation
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-8">Today's Workout</h1>
      
      {/* Time selector */}
      <div className="mb-8">
        <h2 className="text-xl mb-4">Time Available: {timeAvailable} minutes</h2>
        <div className="flex gap-2">
          {[15, 30, 45, 60].map(time => (
            <button
              key={time}
              onClick={() => setTimeAvailable(time)}
              className={`px-4 py-2 rounded ${
                timeAvailable === time ? 'bg-blue-500 text-white' : 'bg-gray-200'
              }`}
            >
              {time} min
            </button>
          ))}
        </div>
      </div>

      {/* Workout options */}
      <div className="mb-8">
        <h2 className="text-xl mb-4">What are we training today?</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {popularChoices.map(choice => (
            <button
              key={choice.id}
              onClick={() => handleWorkoutSelect(choice.id)}
              className={`p-6 rounded-lg text-white ${choice.color} hover:opacity-90 transition`}
            >
              <div className="text-3xl mb-2">{choice.icon}</div>
              <div className="font-bold text-lg">{choice.label}</div>
              <div className="text-sm opacity-90 mt-1">{choice.muscles}</div>
              {choice.id === 'chat' && (
                <div className="inline-block ml-2">
                  <MessageCircle size={16} />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Additional options */}
      <div className="grid gap-4">
        <details className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
          <summary className="cursor-pointer font-semibold">💪 Muscle Groups</summary>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {['Chest', 'Back', 'Shoulders', 'Arms', 'Core', 'Glutes'].map(muscle => (
              <button
                key={muscle}
                className="p-2 bg-white dark:bg-gray-700 rounded hover:bg-gray-200"
                onClick={() => handleWorkoutSelect(muscle.toLowerCase())}
              >
                {muscle}
              </button>
            ))}
          </div>
        </details>

        <details className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
          <summary className="cursor-pointer font-semibold">⚡ Specific Focus</summary>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {['Strength', 'Hypertrophy', 'Endurance', 'Power', 'Mobility'].map(focus => (
              <button
                key={focus}
                className="p-2 bg-white dark:bg-gray-700 rounded hover:bg-gray-200"
                onClick={() => handleWorkoutSelect(focus.toLowerCase())}
              >
                {focus}
              </button>
            ))}
          </div>
        </details>

        {/* Quick Chat Access */}
        <button
          onClick={() => setShowChat(true)}
          className="bg-indigo-500 text-white p-4 rounded-lg flex items-center justify-center gap-2 hover:bg-indigo-600"
        >
          <MessageCircle size={20} />
          <span>Chat with AI Trainer (Nike Workouts, Custom Plans, Modifications)</span>
        </button>
      </div>

      {/* Chat Panel Modal */}
      {showChat && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-xl font-semibold">AI Workout Assistant</h2>
              <button
                onClick={() => setShowChat(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="h-[60vh] p-4">
              <p className="text-center text-gray-600">
                Chat functionality will be integrated here. For now, you can access Nike workouts and custom plans through the main interface.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 