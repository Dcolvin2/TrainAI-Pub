'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
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
    id: 'full_body',
    title: 'FULL BODY',
    subtitle: 'Complete workout',
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

// Types + normalizer
type DisplayItem = {
  name: string;
  sets?: string;
  reps?: string;
  duration?: string;
  instruction?: string;
  isAccessory?: boolean;
};

interface GeneratedWorkout {
  name: string;
  warmup: DisplayItem[];
  main: DisplayItem[];          // primaries only
  accessories: DisplayItem[];   // derived from LLM main
  cooldown: DisplayItem[];
  duration?: number;
  focus?: string;
}

function normalizeFromLLM(raw: any): GeneratedWorkout {
  const w = raw || {};
  const toItem = (x: any): DisplayItem =>
    typeof x === 'string' ? { name: x } : { ...x, name: x?.name ?? 'Exercise' };

  const warmup: DisplayItem[]  = Array.isArray(w.warmup)  ? w.warmup.map(toItem)  : [];
  const mainAll: DisplayItem[] = Array.isArray(w.main)    ? w.main.map(toItem)    : [];
  const cooldown: DisplayItem[] = Array.isArray(w.cooldown) ? w.cooldown.map(toItem) : [];

  // ✅ add explicit parameter types to satisfy noImplicitAny/strict
  const primaries: DisplayItem[] = mainAll
    .filter((i: DisplayItem) => !i.isAccessory)
    .map((i: DisplayItem) => ({ ...i, isAccessory: false }));

  const accessories: DisplayItem[] = mainAll
    .filter((i: DisplayItem) => i.isAccessory)
    .map((i: DisplayItem) => ({ ...i, isAccessory: true }));

  return {
    name: w.name ?? 'Planned Session',
    warmup,
    main: primaries,
    accessories,
    cooldown,
    duration: Number(w.est_total_minutes ?? w.duration_min ?? 0) || undefined,
    focus: undefined,
  };
}

export default function TodaysWorkout() {
  const [timeAvailable, setTimeAvailable] = useState(45);
  const [selectedWorkout, setSelectedWorkout] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [suggestedType, setSuggestedType] = useState<string | null>(null);
  const [userId] = useState('demo-user-id'); // In real app, get from auth

  const { user } = useAuth();
  const router = useRouter();

  // Chat state
  const [inputMessage, setInputMessage] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [generatedWorkout, setGeneratedWorkout] = useState<GeneratedWorkout | null>(null);

  // Previous workout data for context
  const [previousWorkoutData, setPreviousWorkoutData] = useState<Record<string, { weight: number; reps: number }>>({});

  // Fetch previous workout data
  useEffect(() => {
    const fetchPreviousWorkout = async () => {
      if (!user) return;
      
      const { data: previousSets } = await supabase
        .from('workout_sets')
        .select('id, session_id, exercise_name, set_number, prescribed_weight, actual_weight, reps, rest_seconds, rpe, session:workout_sessions!inner(user_id, date)')
        .eq('session.user_id', user.id)
        .order('date', { foreignTable: 'workout_sessions', ascending: false })
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
      // Check if user is requesting a Nike workout
      const messageLower = userMessage.toLowerCase();
      if (messageLower.includes('nike') || messageLower.includes('nike workout') || messageLower.includes('nike wod')) {
        // Extract workout number from message (e.g., "Nike 23" -> 23)
        let workoutNumber = 1; // Default to workout 1
        
        // Look for patterns like "nike 23", "nike workout 5", "nike wod 12"
        const nikeMatch = userMessage.match(/nike\s+(?:workout\s+)?(?:wod\s+)?(\d+)/i);
        if (nikeMatch) {
          workoutNumber = parseInt(nikeMatch[1], 10);
        }
        
        const response = await fetch('/api/nike-workout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            workoutNumber,
            userId: user?.id || 'demo-user-id',
            equipment: ['barbell', 'dumbbells', 'kettlebells']
          })
        });

        if (!response.ok) {
          throw new Error('Failed to generate Nike workout');
        }

        const data = await response.json();
        
        if (data.workout) {
          const normalized = normalizeFromLLM(data.workout);
          setGeneratedWorkout(normalized);
          
          setChatMessages(prev => [...prev, {
            role: 'assistant',
            content: `Here's Nike WOD ${workoutNumber}:\n\n${data.message || 'Generated Nike workout'}`,
          }]);
        }
        return;
      }

      // Regular workout generation via chat
      const response = await fetch('/api/chat-workout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          user: user?.id || 'demo-user-id'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate workout');
      }

      const data = await response.json();
      
      // Handle error responses
      if (data.error) {
        setChatMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `Error: ${data.error}` 
        }]);
      } else {
        // Handle modification responses
        if (data.isModification && data.workout) {
          // Update the workout with the modified version
          const normalized = normalizeFromLLM(data.workout);
          setGeneratedWorkout(normalized);
          
          // Show just the modification message
          setChatMessages(prev => [...prev, {
            role: 'assistant',
            content: data.message
          }]);
          
        } else if (data.workout && !data.isModification) {
          // New workout generated
          const normalized = normalizeFromLLM(data.workout);
          setGeneratedWorkout(normalized);
          
          // Format and display the full workout
          let workoutDisplay = data.message + '\n\n';
          
          if (normalized.warmup && normalized.warmup.length > 0) {
            workoutDisplay += '**🔥 Warm-up:**\n';
            normalized.warmup.forEach((ex: any, i: number) => {
              workoutDisplay += `${i+1}. ${ex.name} - ${ex.sets ? ex.sets + ' sets x ' + ex.reps + ' reps' : ex.duration}\n`;
            });
            workoutDisplay += '\n';
          }
          
          if (normalized.main && normalized.main.length > 0) {
            workoutDisplay += '**💪 Main Workout:**\n';
            normalized.main.forEach((ex: any, i: number) => {
              workoutDisplay += `${i+1}. ${ex.name} - ${ex.sets} sets x ${ex.reps} reps\n`;
            });
            workoutDisplay += '\n';
          }
          
          if (normalized.accessories && normalized.accessories.length > 0) {
            workoutDisplay += '**🔧 Accessories:**\n';
            normalized.accessories.forEach((ex: any, i: number) => {
              workoutDisplay += `${i+1}. ${ex.name} - ${ex.sets} sets x ${ex.reps} reps\n`;
            });
            workoutDisplay += '\n';
          }
          
          if (normalized.cooldown && normalized.cooldown.length > 0) {
            workoutDisplay += '**🧘 Cool-down:**\n';
            normalized.cooldown.forEach((ex: any, i: number) => {
              workoutDisplay += `${i+1}. ${ex.name} - ${ex.duration}\n`;
            });
          }
          
          setChatMessages(prev => [...prev, {
            role: 'assistant',
            content: workoutDisplay
          }]);
        }
      }
    } catch (error) {
      console.error('Error generating workout:', error);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error while generating your workout. Please try again.',
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Replace handleWorkoutSelect to call /api/chat-workout (LLM) instead of /api/generate-workout
  const handleWorkoutSelect = async (workoutType: string) => {
    setIsLoading(true);
    try {
      const url = `/api/chat-workout?user=${user?.id}&split=${encodeURIComponent(workoutType)}&minutes=${timeAvailable}&style=${workoutType === 'hiit' ? 'hiit' : 'strength'}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // body is optional but helps bias the model; safe for our route
        body: JSON.stringify({ message: `${workoutType} ${timeAvailable} min — use only my equipment.` }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.info('[SRC] LLM /api/chat-workout', { workoutType, timeAvailable, data });

      // Prefer LLM legacy shape if present
      if (data?.workout) {
        const normalized = normalizeFromLLM(data.workout);
        setGeneratedWorkout(normalized);
        setChatMessages(prev => [...prev, { role: 'assistant', content: data.message || `Loaded ${normalized.name}` }]);
      } else if (data?.plan) {
        // Fallback if only plan shape returned
        const planWorkoutShape = {
          warmup: data.plan?.phases?.find((p: any) => p.phase === 'warmup')?.items ?? [],
          main:   data.plan?.phases?.find((p: any) => p.phase === 'main')?.items ?? [],
          cooldown: data.plan?.phases?.find((p: any) => p.phase === 'cooldown')?.items ?? [],
          name: data.plan?.name,
          est_total_minutes: data.plan?.est_total_minutes ?? data.plan?.duration_min,
        };
        const normalized = normalizeFromLLM(planWorkoutShape);
        setGeneratedWorkout(normalized);
        setChatMessages(prev => [...prev, { role: 'assistant', content: data.message || `Loaded ${normalized.name}` }]);
      } else {
        throw new Error('LLM did not return a workout.');
      }
    } catch (error) {
      console.error('Error generating workout:', error);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: `Sorry, I had trouble generating your ${workoutType} workout. Please try again.`,
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartWorkout = () => {
    // Navigate to workout execution screen
    console.log('Starting workout...');
  };

  const handleTimeChange = (newTime: number) => {
    setTimeAvailable(newTime);
  };

  const handleWorkoutTypeSelect = (type: string) => {
    setSelectedWorkout(type);
    handleWorkoutSelect(type);
  };

  const handleWorkoutComplete = () => {
    // Handle workout completion
    console.log('Workout completed');
  };

  const handleWorkoutModification = async (modification: string) => {
    if (!generatedWorkout) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/modify-workout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentWorkout: generatedWorkout,
          modification,
          userId: user?.id || 'demo-user-id'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to modify workout');
      }

      const data = await response.json();
      
      if (data.workout) {
        const normalized = normalizeFromLLM(data.workout);
        setGeneratedWorkout(normalized);
        
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: `Modified workout: ${data.message}`
        }]);
      }
    } catch (error) {
      console.error('Error modifying workout:', error);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error while modifying your workout. Please try again.',
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickEntry = async (exerciseName: string, sets: Array<{ weight: number; reps: number; completed: boolean }>) => {
    if (!user?.id) return;
    
    try {
      const response = await fetch('/api/quick-entry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          exerciseName,
          sets
        })
      });

      if (!response.ok) {
        throw new Error('Failed to log quick entry');
      }

      const data = await response.json();
      console.log('Quick entry logged:', data);
      
      // Update previous workout data
      const latestSet = sets[sets.length - 1];
      setPreviousWorkoutData(prev => ({
        ...prev,
        [exerciseName]: {
          weight: latestSet.weight,
          reps: latestSet.reps
        }
      }));
      
    } catch (error) {
      console.error('Error logging quick entry:', error);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">Today's Workout</h1>
          <p className="text-gray-400 text-lg">
            Choose your workout type or chat with AI to create a personalized plan
          </p>
        </div>

        {/* Time Selector */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-center">How much time do you have?</h2>
          <div className="flex justify-center space-x-4">
            {[30, 45, 60, 90].map((time) => (
              <button
                key={time}
                onClick={() => handleTimeChange(time)}
                className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                  timeAvailable === time
                    ? 'bg-[#22C55E] text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {time} min
              </button>
            ))}
          </div>
        </div>

        {/* Workout Type Selection */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-center">Choose Your Workout Type</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {workoutTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => handleWorkoutTypeSelect(type.id)}
                className={`p-6 rounded-lg border-2 transition-all duration-200 ${type.color} ${type.bgHover} hover:scale-105`}
              >
                <h3 className="text-xl font-bold mb-2">{type.title}</h3>
                <p className="text-gray-400 text-sm">{type.subtitle}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Chat Interface */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold">AI Workout Chat</h2>
            <button
              onClick={() => setShowChat(!showChat)}
              className="px-4 py-2 bg-[#22C55E] text-white rounded-lg hover:bg-[#16a34a] transition-colors"
            >
              {showChat ? 'Hide Chat' : 'Show Chat'}
            </button>
          </div>

          {showChat && (
            <div className="bg-gray-800 rounded-lg p-6 max-w-4xl mx-auto">
              <div className="mb-4 h-64 overflow-y-auto border border-gray-600 rounded p-4 bg-gray-900">
                {chatMessages.map((message, index) => (
                  <div
                    key={index}
                    className={`mb-3 ${
                      message.role === 'user' ? 'text-right' : 'text-left'
                    }`}
                  >
                    <div
                      className={`inline-block p-3 rounded-lg max-w-xs lg:max-w-md ${
                        message.role === 'user'
                          ? 'bg-[#22C55E] text-white'
                          : 'bg-gray-700 text-gray-300'
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="text-left">
                    <div className="inline-block p-3 rounded-lg bg-gray-700 text-gray-300">
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Generating workout...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex space-x-2">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Describe your workout needs..."
                  className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-[#22C55E] focus:outline-none"
                  disabled={isLoading}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={isLoading || !inputMessage.trim()}
                  className="px-6 py-2 bg-[#22C55E] text-white rounded-lg hover:bg-[#16a34a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Send
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Generated Workout Display */}
        {generatedWorkout && (
          <div className="bg-gray-800 rounded-lg p-6 max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">{generatedWorkout.name}</h2>
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowChat(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Modify
                </button>
                <button
                  onClick={handleStartWorkout}
                  className="px-4 py-2 bg-[#22C55E] text-white rounded-lg hover:bg-[#16a34a] transition-colors"
                >
                  Start Workout
                </button>
              </div>
            </div>

            {/* Warm-up Section */}
            {generatedWorkout.warmup && generatedWorkout.warmup.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xl font-semibold mb-3 text-yellow-400">🔥 Warm-up</h3>
                <div className="space-y-2">
                  {generatedWorkout.warmup.map((exercise, index) => (
                    <div key={index} className="flex justify-between items-center bg-gray-700 p-3 rounded">
                      <span>{exercise.name}</span>
                      <span className="text-gray-400">
                        {exercise.duration || exercise.reps || '1 set'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Main Workout Section */}
            {generatedWorkout.main && generatedWorkout.main.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xl font-semibold mb-3 text-red-400">💪 Main Workout</h3>
                <div className="space-y-3">
                  {generatedWorkout.main.map((exercise, index) => (
                    <div key={index} className="bg-gray-700 p-4 rounded">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">{exercise.name}</span>
                        <span className={`ml-2 px-2 py-1 text-xs text-white rounded ${ (exercise as any).isAccessory ? 'bg-blue-600' : 'bg-green-600' }`}>
                          {(exercise as any).isAccessory ? 'Accessory' : 'Main Lift'}
                        </span>
                      </div>
                      <div className="text-gray-400 text-sm">
                        {exercise.sets} sets × {exercise.reps || '8-12'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Accessories Section */}
            {generatedWorkout.accessories && generatedWorkout.accessories.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xl font-semibold mb-3 text-blue-400">🔧 Accessories</h3>
                <div className="space-y-3">
                  {generatedWorkout.accessories.map((exercise, index) => (
                    <div key={index} className="bg-gray-700 p-4 rounded">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">{exercise.name}</span>
                        <span className="ml-2 px-2 py-1 text-xs text-white rounded bg-blue-600">
                          Accessory
                        </span>
                      </div>
                      <div className="text-gray-400 text-sm">
                        {exercise.sets} sets × {exercise.reps || '10-15'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cool-down Section */}
            {generatedWorkout.cooldown && generatedWorkout.cooldown.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xl font-semibold mb-3 text-green-400">🧘 Cool-down</h3>
                <div className="space-y-2">
                  {generatedWorkout.cooldown.map((exercise, index) => (
                    <div key={index} className="flex justify-between items-center bg-gray-700 p-3 rounded">
                      <span>{exercise.name}</span>
                      <span className="text-gray-400">
                        {exercise.duration || exercise.reps || '1 set'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Workout Actions */}
            <div className="flex justify-center space-x-4 pt-6">
              <button
                onClick={handleWorkoutComplete}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Complete Workout
              </button>
              <button
                onClick={() => setShowChat(true)}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Modify Workout
              </button>
            </div>
          </div>
        )}

        {/* Navigation Links */}
        <div className="text-center mt-8">
          <div className="flex justify-center space-x-4">
            <Link
              href="/workout/builder"
              className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Custom Workout Builder
            </Link>
            <Link
              href="/workout/active"
              className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Active Workout
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
