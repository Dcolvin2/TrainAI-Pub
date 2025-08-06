'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { generateWorkoutForType, getWorkoutSuggestions, saveWorkout } from '@/lib/workoutGenerator';
import { WorkoutDisplay } from '../components/WorkoutDisplay';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

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
  warmup: (string | { name: string; sets?: string; reps?: string })[];
  main: (string | { name: string; sets?: string; reps?: string })[];
  accessories: (string | { name: string; sets?: string; reps?: string })[];
  cooldown: (string | { name: string; sets?: string; reps?: string })[];
  duration?: number;
  focus?: string;
}

export default function TodaysWorkoutPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [selectedTime, setSelectedTime] = useState(45);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedWorkout, setGeneratedWorkout] = useState<GeneratedWorkout | null>(null);
  const [previousWorkoutData, setPreviousWorkoutData] = useState<any>({});

  // Fetch previous workout data
  useEffect(() => {
    const fetchPreviousWorkout = async () => {
      if (!user) return;
      
      const { data: previousSets } = await supabase
        .from('workout_sets')
        .select('exercise_name, actual_weight, reps')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      
      // Group by exercise name to get most recent
      const previousData: Record<string, { weight: number; reps: number }> = {};
      previousSets?.forEach(set => {
        if (!previousData[set.exercise_name]) {
          previousData[set.exercise_name] = {
            weight: set.actual_weight,
            reps: set.reps
          };
        }
      });
      
      setPreviousWorkoutData(previousData);
    };
    
    fetchPreviousWorkout();
  }, [user]);

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
      console.log('Sending workout request:', {
        type: workoutType,
        timeMinutes: selectedTime,
        userId: user?.id
      });
      
      const response = await fetch('/api/generate-workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: workoutType,
          timeMinutes: selectedTime,
          userId: user?.id
        })
      });

      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', errorText);
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('API Response:', data);
      console.log('API Response data:', data);        // Add this
      console.log('data.main:', data.main);           // Add this
      console.log('data.warmup:', data.warmup);       // Add this
      console.log('data.accessories:', data.accessories); // Add this
      
      // Set the generated workout to display
      setGeneratedWorkout({
        name: `${workoutType.toUpperCase()} Workout`,
        warmup: data.warmup || [],
        main: data.main || [],  // ← FIXED: Use data.main not data.mainLift
        accessories: data.accessories || [],
        cooldown: data.cooldown || [],
        duration: data.duration || selectedTime,
        focus: data.focus || workoutType
      });
    } catch (error) {
      console.error('Error generating workout:', error);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: `Sorry, I had trouble generating your ${workoutType} workout. Please try again or check your equipment settings.`
      }]);
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
                <h3 className="text-lg font-semibold mb-4">{generatedWorkout.name}</h3>
                
                {/* Warm-up Section */}
                {generatedWorkout.warmup?.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-md font-semibold text-gray-300 mb-3">Warm-up</h4>
                    <div className="space-y-2">
                      {generatedWorkout.warmup.map((exercise, idx) => (
                        <div key={idx} className="flex items-center">
                          <span className="w-6 h-6 bg-gray-700 rounded-full flex items-center justify-center text-xs text-white mr-3">
                            {idx + 1}
                          </span>
                          <span className="text-gray-200">
                            {(typeof exercise === 'string' ? exercise : exercise.name || 'Exercise').replace(/^-\s*/, '')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Main Exercises Section */}
                {generatedWorkout.main?.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center mb-3">
                      <h4 className="text-md font-semibold text-gray-300">
                        Main Exercises
                      </h4>
                      <span className="ml-2 px-2 py-1 bg-green-600 text-xs text-white rounded">
                        Main Lift
                      </span>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-4">
                      {/* Column headers */}
                      <div className="grid grid-cols-5 gap-4 text-sm text-gray-400 mb-4 pb-2 border-b border-gray-700">
                        <span>Set</span>
                        <span>Previous</span>
                        <span className="text-right">lbs</span>
                        <span className="text-right">Reps</span>
                        <span className="text-right">Complete</span>
                      </div>
                      
                      {/* Exercises */}
                      {Array.isArray(generatedWorkout.main) && 
                        generatedWorkout.main
                          .filter(exercise => {
                            // Filter out instruction text
                            const name = typeof exercise === 'string' ? exercise : exercise.name;
                            return !name.toLowerCase().includes('perform') && 
                                   !name.toLowerCase().includes('rounds') &&
                                   name.length > 3;
                          })
                          .map((exercise, exerciseIndex) => {
                            // Parse exercise details
                            let exerciseName = typeof exercise === 'string' ? exercise : exercise.name;
                            let targetSets = typeof exercise === 'object' && exercise.sets ? 
                              parseInt(exercise.sets) : 3;
                            let targetReps = typeof exercise === 'object' && exercise.reps ? 
                              exercise.reps : '10';
                            
                            // Clean exercise name
                            exerciseName = exerciseName.replace(/^\d+\.\s*/, '');
                            const repsMatch = exerciseName.match(/(.+?)\s*-\s*(\d+)\s*reps?/i);
                            if (repsMatch) {
                              exerciseName = repsMatch[1].trim();
                              targetReps = repsMatch[2];
                            }
                            exerciseName = exerciseName.replace(/\s*\([^)]*\)\s*/g, '').trim();
                            
                            // Get previous workout data
                            const previous = previousWorkoutData[exerciseName];
                            
                            return (
                              <div key={exerciseIndex} className="mb-6">
                                {/* Exercise Name Header */}
                                <div className="text-white font-medium mb-2">
                                  {exerciseName}
                                </div>
                                
                                {/* Sets */}
                                {[...Array(targetSets)].map((_, setIndex) => (
                                  <div key={setIndex} className="grid grid-cols-5 gap-4 items-center mb-2">
                                    <span className="text-gray-400 text-sm">
                                      Set {setIndex + 1}
                                    </span>
                                    <span className="text-gray-500 text-sm text-center">
                                      {/* Previous weight x reps - from DB or default */}
                                      {previous ? `${previous.weight} lbs × ${previous.reps}` : 'N/A'}
                                    </span>
                                    <input
                                      type="number"
                                      className="bg-gray-700 rounded px-2 py-1 text-center text-white"
                                      placeholder="0"
                                    />
                                    <input
                                      type="number"
                                      className="bg-gray-700 rounded px-2 py-1 text-center text-white"
                                      placeholder={targetReps.toString()}
                                      defaultValue={targetReps}
                                    />
                                    <input type="checkbox" className="ml-auto w-5 h-5 cursor-pointer" />
                                  </div>
                                ))}
                              </div>
                            );
                          })
                      }
                    </div>
                  </div>
                )}
                
                {/* Accessories Section */}
                {generatedWorkout.accessories?.length > 0 && (
                  <div className="mb-6">
                    {generatedWorkout.accessories.map((exercise, idx) => (
                      <div key={idx} className="mb-4">
                        <div className="flex items-center mb-3">
                          <h4 className="text-md font-semibold text-gray-300">
                            {typeof exercise === 'string' ? exercise : exercise.name || 'Exercise'}
                          </h4>
                          <span className="ml-2 px-2 py-1 bg-blue-600 text-xs text-white rounded">Accessory</span>
                        </div>
                        <div className="bg-gray-800 rounded-lg p-4">
                          <div className="grid grid-cols-5 gap-4 text-sm text-gray-400 mb-2">
                            <span>Set</span>
                            <span>Previous</span>
                            <span className="text-right">lbs</span>
                            <span className="text-right">Reps</span>
                            <span className="text-right">Complete</span>
                          </div>
                          {[1, 2, 3].map((setNum) => (
                            <div key={setNum} className="grid grid-cols-5 gap-4 items-center mb-2">
                              <span className="text-gray-300">{setNum}</span>
                              <span className="text-gray-500">N/A</span>
                              <input
                                type="number"
                                className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-right text-gray-200"
                                placeholder="0"
                              />
          <input
            type="number"
                                className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-right text-gray-200"
                                placeholder="0"
                              />
                              <input type="checkbox" className="ml-auto w-5 h-5 cursor-pointer" />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
        </div>
                )}
                
                {/* Cool-down Section */}
                {generatedWorkout.cooldown?.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-md font-semibold text-gray-300 mb-3">Cool-down</h4>
                    <div className="space-y-2">
                      {generatedWorkout.cooldown.map((exercise, idx) => (
                        <div key={idx} className="flex items-center">
                          <span className="w-6 h-6 bg-gray-700 rounded-full flex items-center justify-center text-xs text-white mr-3">
                            {idx + 1}
                          </span>
                          <span className="text-gray-200">
                            {(typeof exercise === 'string' ? exercise : exercise.name || 'Exercise').replace(/^-\s*/, '')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <button 
                  onClick={() => console.log('Starting workout:', generatedWorkout)}
                  className="mt-4 w-full bg-green-600 hover:bg-green-700 py-3 rounded-lg font-semibold"
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