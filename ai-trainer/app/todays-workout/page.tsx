'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { generateWorkoutForType, getWorkoutSuggestions, saveWorkout } from '@/lib/workoutGenerator';
import { WorkoutDisplay } from '../components/WorkoutDisplay';
import Link from 'next/link';

// Define workout types with proper text
const workoutTypes = [
  {
    id: 'push',
    title: 'PUSH',
    subtitle: 'Chest, Shoulders, Triceps',
    color: 'border-blue-500',
    bgHover: 'hover:bg-blue-500/10'
  },
  {
    id: 'pull',
    title: 'PULL',
    subtitle: 'Back, Biceps',
    color: 'border-green-500',
    bgHover: 'hover:bg-green-500/10'
  },
  {
    id: 'legs',
    title: 'LEGS',
    subtitle: 'Quads, Hamstrings, Glutes',
    color: 'border-purple-500',
    bgHover: 'hover:bg-purple-500/10'
  },
  {
    id: 'upper',
    title: 'UPPER BODY',
    subtitle: 'Chest, Back, Shoulders, Arms',
    color: 'border-orange-500',
    bgHover: 'hover:bg-orange-500/10'
  },
  {
    id: 'full',
    title: 'FULL BODY',
    subtitle: 'Total Body Workout',
    color: 'border-red-500',
    bgHover: 'hover:bg-red-500/10'
  },
  {
    id: 'hiit',
    title: 'HIIT',
    subtitle: 'High Intensity Intervals',
    color: 'border-yellow-500',
    bgHover: 'hover:bg-yellow-500/10'
  }
];

interface GeneratedWorkout {
  name: string;
  warmup: string[];
  main: any[];
  accessories: string[];
  cooldown: string[];
}

export default function TodaysWorkoutPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [selectedTime, setSelectedTime] = useState(45);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedWorkout, setGeneratedWorkout] = useState<GeneratedWorkout | null>(null);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;
    
    const userMessage = inputMessage;
    setInputMessage('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage })
      });

      const data = await response.json();
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
      
      // If workout data is returned, update the display
      if (data.workout) {
        setGeneratedWorkout(data.workout);
      }
    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWorkoutSelect = async (workoutType: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/generate-workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timeAvailable: selectedTime,
          workoutType,
          focus: workoutType
        })
      });
      const data = await response.json();
      
      // Set the generated workout to display
      setGeneratedWorkout({
        name: `${workoutType.toUpperCase()} Workout`,
        warmup: data.warmup || [],
        main: data.workout || data.main || [],
        accessories: data.accessories || [],
        cooldown: data.cooldown || []
      });
      
      // Add to chat
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: `I've generated a ${selectedTime}-minute ${workoutType} workout for you. Click "Start Workout" when you're ready!`
      }]);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Redirect if not authenticated
  if (!user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-white text-xl mb-4">Please log in to access your workout</div>
          <button
            onClick={() => router.push('/login')}
            className="bg-green-600 px-6 py-3 rounded-xl text-white font-semibold hover:bg-green-700 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-6 py-8 h-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Left side - Workout Selection */}
          <div className="lg:col-span-2 space-y-8">
            {/* Time Selection */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Time Available</h2>
              <div className="flex gap-3">
                {[15, 30, 45, 60].map((time) => (
                  <button
                    key={time}
                    onClick={() => setSelectedTime(time)}
                    className={`px-6 py-3 rounded-lg transition-all ${
                      selectedTime === time
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    {time === 60 ? '60+' : time} min
                  </button>
                ))}
              </div>
            </div>

            {/* Workout Type Cards */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Choose Your Workout</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {workoutTypes.map((workout) => (
                  <button
                    key={workout.id}
                    onClick={() => handleWorkoutSelect(workout.id)}
                    className={`p-6 rounded-lg bg-gray-900 border-t-4 ${workout.color} 
                      ${workout.bgHover} transition-all hover:scale-105 text-left`}
                    disabled={isLoading}
                  >
                    <h3 className="text-lg font-bold mb-2">{workout.title}</h3>
                    <p className="text-sm text-gray-400">{workout.subtitle}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Generated Workout Display */}
            {generatedWorkout && (
              <div className="bg-gray-900 rounded-lg p-6">
                <h3 className="text-xl font-semibold mb-6">{generatedWorkout.name || 'Your Workout'}</h3>
                
                {/* Warmup Section */}
                {generatedWorkout.warmup && generatedWorkout.warmup.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Warm-up</h4>
                    <div className="space-y-2">
                      {generatedWorkout.warmup.map((exercise, idx) => (
                        <div key={idx} className="text-gray-300 flex items-start">
                          <span className="text-gray-500 mr-3 mt-0.5">{idx + 1}.</span>
                          <span>{exercise}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Main Workout Section */}
                {generatedWorkout.main && generatedWorkout.main.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Main Exercises</h4>
                    <div className="space-y-2">
                      {generatedWorkout.main.map((exercise, idx) => (
                        <div key={idx} className="text-gray-300 flex items-start">
                          <span className="text-gray-500 mr-3 mt-0.5">{idx + 1}.</span>
                          <span className="font-medium">{exercise}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Accessories Section */}
                {generatedWorkout.accessories && generatedWorkout.accessories.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Accessory Work</h4>
                    <div className="space-y-2">
                      {generatedWorkout.accessories.map((exercise, idx) => (
                        <div key={idx} className="text-gray-300 flex items-start">
                          <span className="text-gray-500 mr-3 mt-0.5">{idx + 1}.</span>
                          <span>{exercise}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Cooldown Section */}
                {generatedWorkout.cooldown && generatedWorkout.cooldown.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Cool-down</h4>
                    <div className="space-y-2">
                      {generatedWorkout.cooldown.map((exercise, idx) => (
                        <div key={idx} className="text-gray-300 flex items-start">
                          <span className="text-gray-500 mr-3 mt-0.5">{idx + 1}.</span>
                          <span>{exercise}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <button 
                  onClick={() => {
                    alert('Start Workout functionality coming soon!');
                  }}
                  className="mt-6 w-full bg-green-600 hover:bg-green-700 py-3 rounded-lg font-semibold transition-colors"
                >
                  Start Workout
                </button>
              </div>
            )}
          </div>

          {/* Right side - Chat */}
          <div className="lg:col-span-1">
            <div className="bg-gray-900 rounded-lg h-[500px] flex flex-col">
              <div className="p-4 border-b border-gray-800">
                <h3 className="text-lg font-semibold">AI Workout Assistant</h3>
              </div>
              
              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {chatMessages.length === 0 && (
                  <div className="text-gray-500 text-center mt-8">
                    Ask me anything about workouts or say "Nike workouts" for your program
                  </div>
                )}
                
                {chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 ${
                        msg.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-800 text-gray-100'
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    </div>
                  </div>
                ))}
                
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-800 rounded-lg px-4 py-2">
                      <span className="text-gray-400 animate-pulse">Thinking...</span>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Chat Input */}
              <div className="p-4 border-t border-gray-800">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Ask me anything..."
                    className="flex-1 bg-gray-800 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={isLoading || !inputMessage.trim()}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 