'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

// ── LLM → UI helpers (non-UI; keeps your current table layout) ─────────────────
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
  accessories: DisplayItem[];   // flagged or overflow from main
  cooldown: DisplayItem[];
  duration?: number;
  focus?: string;
}

// stringify
const S = (v: any) => (v == null ? undefined : String(v));

// collapse duplicates like "Battle Battle Rope", unify common equipment names
const cleanName = (raw?: string) => {
  let s = S(raw)?.replace(/^\d+\.\s*/, "").trim() ?? "Exercise";
  s = s.replace(/\b(\w+)\s+\1\b/gi, "$1"); // repeated words
  s = s.replace(/\bBarbells?\b/gi, "Barbell")
       .replace(/\bDumbbells?\b/gi, "Dumbbell")
       .replace(/\bKettlebells?\b/gi, "Kettlebell")
       .replace(/\bBattle\s*Ropes?\b/gi, "Battle Rope")
       .replace(/\bExercise\s*Bike\b/gi, "Exercise Bike"); // keep exact
  // strip trailing " - 10 reps" artifacts if they got inline-appended
  s = s.replace(/\s*-\s*\d+.*$/, "").trim();
  return s;
};

const toKey = (name: string) => cleanName(name).toLowerCase().replace(/[^a-z0-9]+/g, "");
const isNoiseLine = (name: string) =>
  /\b(rounds?|perform|interval|emom|amrap|tabata|work\/rest|rest)\b/i.test(name);

const toDisplayItem = (x: any): DisplayItem => {
  const name = cleanName(typeof x === "string" ? x : x?.name);
  if (!name || isNoiseLine(name)) return { name: "" }; // will be filtered out
  return {
    name,
    sets: S(x?.sets),
    reps: S(x?.reps),
    duration: S(x?.duration),
    instruction: S(x?.instruction),
    isAccessory: Boolean(x?.isAccessory),
  };
};

function dedup(items: DisplayItem[]): DisplayItem[] {
  const seen = new Set<string>();
  const out: DisplayItem[] = [];
  for (const it of items) {
    const k = toKey(it.name || "");
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

function llmToGeneratedWorkout(raw: any): GeneratedWorkout {
  const w = raw || {};
  const warmup = Array.isArray(w.warmup) ? w.warmup.map(toDisplayItem).filter((i: DisplayItem) => i.name) : [];
  const mainAll = Array.isArray(w.main) ? w.main.map(toDisplayItem).filter((i: DisplayItem) => i.name) : [];
  const cooldown = Array.isArray(w.cooldown) ? w.cooldown.map(toDisplayItem).filter((i: DisplayItem) => i.name) : [];

  // Separate primaries vs accessories using isAccessory, with a sensible fallback
  let primaries = mainAll.filter((it: DisplayItem) => !it.isAccessory);
  let accessories = mainAll.filter((it: DisplayItem) => it.isAccessory);

  if (primaries.length === 0 && mainAll.length) {
    // Fallback: treat first 2 as primaries, rest as accessories
    const splitN = Math.min(2, mainAll.length);
    primaries = mainAll.slice(0, splitN).map((it: DisplayItem) => ({ ...it, isAccessory: false }));
    accessories = mainAll.slice(splitN).map((it: DisplayItem) => ({ ...it, isAccessory: true }));
  }

  // De-dupe with priority: main > accessories, and keep cooldown independent
  const mainDedup = dedup(primaries);
  const mainKeys = new Set(mainDedup.map((i: DisplayItem) => toKey(i.name)));
  const accDedup = dedup(accessories.filter((a: DisplayItem) => !mainKeys.has(toKey(a.name))));

  return {
    name: S(w.name) ?? "Planned Session",
    warmup: dedup(warmup),
    main: mainDedup,
    accessories: accDedup,
    cooldown: dedup(cooldown),
    duration: Number(w.est_total_minutes ?? w.duration_min ?? 0) || undefined,
    focus: undefined,
  };
}

// Pretty, multi-line coach text for chat bubble
const asCoachMessage = (gw: GeneratedWorkout, title?: string, minutes?: number) => {
  const header = `${title || gw.name}${minutes ? ` (~${minutes} min)` : ""}`;
  const line = (it: DisplayItem, idx: number) =>
    it.duration
      ? `${idx}. ${it.name} - ${it.duration}`
      : `${idx}. ${it.name} - ${it.sets ? `${it.sets} sets x ` : ""}${it.reps ?? ""}`.trim();

  const mainPlusAcc = [...gw.main, ...gw.accessories]; // show both in "Main Workout" section

  const parts = [
    header,
    "",
    "🔥 Warm-up:",
    ...gw.warmup.map((it, i) => line(it, i + 1)),
    "",
    "💪 Main Workout:",
    ...mainPlusAcc.map((it, i) => line(it, i + 1)),
    "",
    "🧘 Cool-down:",
    ...gw.cooldown.map((it, i) => line(it, i + 1)),
  ].filter(Boolean);

  return parts.join("\n");
};

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

export default function TodaysWorkoutPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [selectedTime, setSelectedTime] = useState(45);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedWorkout, setGeneratedWorkout] = useState<GeneratedWorkout | null>(null);
  const [previousWorkoutData, setPreviousWorkoutData] = useState<any>({});
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

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
          workoutNumber = parseInt(nikeMatch[1]);
          // Ensure workout number is within valid range (1-24)
          if (workoutNumber < 1) workoutNumber = 1;
          if (workoutNumber > 24) workoutNumber = 24;
        }
        
        // Call Nike API with specific workout number
        const nikeResponse = await fetch('/api/nike-workout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workout: workoutNumber })
        });
        
        if (nikeResponse.ok) {
          const nikeData = await nikeResponse.json();
          
          // Add Nike response to chat
          setChatMessages(prev => [...prev, { 
            role: 'assistant', 
            content: `Here's your Nike workout: ${nikeData.workout_name} (Workout #${nikeData.workout_number})` 
          }]);
          
          // Update workout display
          setGeneratedWorkout({
            name: nikeData.workout_name,
            warmup: nikeData.exercises.warmup.map((e: any) => e.exercise),
            main: nikeData.exercises.main.map((e: any) => e.exercise),
            accessories: nikeData.exercises.accessory.map((e: any) => e.exercise),
            cooldown: nikeData.exercises.cooldown.map((e: any) => e.exercise)
          });
        } else {
          setChatMessages(prev => [...prev, { 
            role: 'assistant', 
            content: "Sorry, I couldn't fetch a Nike workout right now. Please try again later." 
          }]);
        }
      } else {
        // Use regular chat endpoint for other requests
        const response = await fetch(`/api/chat-workout?user=${user?.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            message: userMessage,
            currentWorkout: generatedWorkout || null,
            sessionId: null, // We can add session tracking later if needed
            userId: user?.id
          })
        });

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
            if (data.workout) {
              const gw = llmToGeneratedWorkout(data.workout);
              setGeneratedWorkout(gw);
            }
            
            // Show just the modification message
            setChatMessages(prev => [...prev, {
              role: 'assistant',
              content: data.message
            }]);
            
          } else if (data.workout && !data.isModification) {
            // New workout generated
            let gw: GeneratedWorkout;
            if (data.workout) {
              gw = llmToGeneratedWorkout(data.workout);
              setGeneratedWorkout(gw);
            }
            
            setChatMessages(prev => [
              ...prev,
              { role: 'assistant', content: asCoachMessage(gw, data?.plan?.name || gw.name, gw.duration) },
            ]);
            
          } else {
            // Regular message without workout
            setChatMessages(prev => [...prev, {
              role: 'assistant',
              content: data.message || data.response
            }]);
          }
          
          // If workout data is returned, update the display
          if (data.workout) {
            const gw = llmToGeneratedWorkout(data.workout);
            setGeneratedWorkout(gw);
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "Sorry, I encountered an error. Please try again." 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWorkoutSelect = async (workoutType: string) => {
    setIsLoading(true);
    try {
      const url = `/api/chat-workout?user=${user?.id}&split=${encodeURIComponent(
        workoutType
      )}&minutes=${selectedTime}&style=${workoutType === 'hiit' ? 'hiit' : 'strength'}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `${workoutType} ${selectedTime} min — use only my equipment.` }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      // Prefer legacy workout; otherwise shape from plan.phases
      const legacy = data?.workout
        ? data.workout
        : {
            name: data?.plan?.name,
            warmup: data?.plan?.phases?.find((p: any) => p.phase === 'warmup')?.items ?? [],
            main: data?.plan?.phases?.find((p: any) => p.phase === 'main')?.items ?? [],
            cooldown: data?.plan?.phases?.find((p: any) => p.phase === 'cooldown')?.items ?? [],
            est_total_minutes: data?.plan?.est_total_minutes ?? data?.plan?.duration_min,
          };

      const gw = llmToGeneratedWorkout(legacy);
      setGeneratedWorkout(gw);

      // Pretty multi-line coach message (no giant paragraph)
      setChatMessages(prev => [
        ...prev,
        { role: 'assistant', content: asCoachMessage(gw, legacy?.name, selectedTime) },
      ]);
    } catch (error) {
      console.error('Error generating workout:', error);
      setChatMessages(prev => [
        ...prev,
        { role: 'assistant', content: `Sorry, I had trouble generating your ${workoutType} workout. Please try again.` },
      ]);
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
              
              {/* Nike Test Button - REMOVED - Now integrated into chat */}
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
                            <div key={exerciseIndex} className="mb-4">
                              <div className="flex items-center mb-3">
                                <h4 className="text-md font-semibold text-gray-300">
                                  {exerciseName}
                                </h4>
                                <span className={`ml-2 px-2 py-1 text-xs text-white rounded ${ (exercise as any).isAccessory ? 'bg-blue-600' : 'bg-green-600' }`}>
                                  {(exercise as any).isAccessory ? 'Accessory' : 'Main Lift'}
                                </span>
                              </div>
                              <div className="bg-gray-800 rounded-lg p-4">
                                {/* Column headers */}
                                <div className="grid grid-cols-5 gap-4 text-sm text-gray-400 mb-2">
                                  <span>Set</span>
                                  <span>Previous</span>
                                  <span>lbs</span>
                                  <span>Reps</span>
                                  <span>Complete</span>
                                </div>
                                
                                {/* Sets */}
                                {[...Array(targetSets)].map((_, setIndex) => (
                                  <div key={setIndex} className="grid grid-cols-5 gap-4 items-center mb-2">
                                    <span className="text-gray-300">
                                      {setIndex + 1}
                                    </span>
                                    <span className="text-gray-500 text-sm">
                                      {/* Previous weight x reps - from DB or default */}
                                      {previous ? `${previous.weight} lbs × ${previous.reps}` : 'N/A'}
                                    </span>
                                    <input
                                      type="number"
                                      className="bg-gray-700 rounded px-2 py-1 text-white"
                                      placeholder="0"
                                    />
                                    <input
                                      type="number"
                                      className="bg-gray-700 rounded px-2 py-1 text-white"
                                      placeholder={targetReps.toString()}
                                      defaultValue={targetReps}
                                    />
                                    <input type="checkbox" className="w-5 h-5 cursor-pointer" />
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })
                    }
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
                            <span>lbs</span>
                            <span>Reps</span>
                            <span>Complete</span>
                          </div>
                          {[1, 2, 3].map((setNum) => (
                            <div key={setNum} className="grid grid-cols-5 gap-4 items-center mb-2">
                              <span className="text-gray-300">{setNum}</span>
                              <span className="text-gray-500">N/A</span>
                              <input
                                type="number"
                                className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-gray-200"
                                placeholder="0"
                              />
                              <input
                                type="number"
                                className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-gray-200"
                                placeholder="0"
                              />
                              <input type="checkbox" className="w-5 h-5 cursor-pointer" />
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
              
              {/* Auto-scroll target */}
              <div ref={chatEndRef} />
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
