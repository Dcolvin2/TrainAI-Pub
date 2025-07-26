'use client'
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

// Type declarations for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionEvent extends Event {
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  isFinal: boolean;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: number;
  prescribedWeight: number;
  restSeconds: number;
}

interface LogEntry {
  exerciseId: string;
  setIndex: number;
  actualWeight: number;
  actualReps: number;
  restSeconds: number;
  rpe: number;
}

interface WorkoutData {
  warmup: string[];
  workout: string[];
  cooldown: string[];
  prompt?: string;
}

// Simple Timer Component
function WorkoutTimer({ running, onToggle }: { running: boolean; onToggle: () => void }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const hh = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const mm = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  return (
    <div className="flex items-center space-x-3">
      <button
        onClick={onToggle}
        className="p-2 text-white bg-green-500 rounded-full hover:bg-green-600 transition-colors"
      >
        {running ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <polygon points="5,3 19,12 5,21" />
          </svg>
        )}
      </button>
      <span className="font-mono text-lg text-white">{`${hh}:${mm}:${ss}`}</span>
    </div>
  );
}

export default function TodaysWorkoutPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<'chat' | 'workout'>('chat');
  
  // Chat agent state
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [workoutData, setWorkoutData] = useState<WorkoutData | null>(null);
  const [minutes, setMinutes] = useState(30);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');

  // Workout tracking state
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [currentSet, setCurrentSet] = useState<{ exIdx: number; setIdx: number }>({ exIdx: 0, setIdx: 0 });
  const [isLoadingWorkout, setIsLoadingWorkout] = useState(true);
  const [workoutError, setWorkoutError] = useState('');
  const [mainTimerRunning, setMainTimerRunning] = useState(false);
  const [restTimerRunning, setRestTimerRunning] = useState(false);
  const [restTimerDuration, setRestTimerDuration] = useState(60);
  const [currentExercise, setCurrentExercise] = useState<Exercise | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
  }, [user, router]);

  // Load today's workout
  useEffect(() => {
    if (!user?.id) return;

    fetch('/api/currentWorkout')
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setWorkoutError(data.error);
          return;
        }
        
        // Convert to Exercise format for tracking
        const exerciseList: Exercise[] = data.details?.map((ex: { name: string; sets: Array<{ reps: number; prescribed: number; rest: number }> }, index: number) => ({
          id: `${ex.name}-${index}`,
          name: ex.name,
          sets: ex.sets.length,
          reps: ex.sets[0]?.reps || 8,
          prescribedWeight: ex.sets[0]?.prescribed || 0,
          restSeconds: ex.sets[0]?.rest ?? 60,
        })) || [];
        
        setExercises(exerciseList);
        if (exerciseList.length > 0) {
          setCurrentExercise(exerciseList[0]);
        }
      })
      .catch(err => {
        console.error('Error fetching workout:', err);
        setWorkoutError('Failed to load workout');
      })
      .finally(() => {
        setIsLoadingWorkout(false);
      });
  }, [user?.id]);

  // Handle speech recognition
  const startListening = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      setIsListening(true);
      const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition: SpeechRecognition = new SpeechRecognitionCtor();

      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsListening(true);

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = Array.from(event.results)
          .map((result: SpeechRecognitionResult) => result[0])
          .map((alt: SpeechRecognitionAlternative) => alt.transcript)
          .join('');
        setTranscript(transcript);
        setPrompt(transcript);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => setIsListening(false);

      recognition.start();
    } else {
      alert('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari over HTTPS.');
    }
  };

  const resetTranscript = () => {
    setTranscript('');
    setPrompt('');
  };

  // Generate workout
  const generateWorkout = async () => {
    if (!user?.id) {
      setError('Please log in to generate a workout');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      const finalPrompt = transcript || prompt;
      if (!finalPrompt.trim()) {
        throw new Error('Please enter a prompt or use voice input');
      }

      const response = await fetch('/api/generateWorkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          minutes,
          prompt: finalPrompt
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate workout');
      }

      setWorkoutData(data);
      setActiveSection('workout');
      
    } catch (err) {
      console.error('Workout generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate workout');
    } finally {
      setIsLoading(false);
    }
  };

  // Advance to next set or finish
  const next = (): void => {
    setCurrentSet(({ exIdx, setIdx }) => {
      if (exIdx < exercises.length) {
        if (setIdx + 1 < exercises[exIdx].sets) {
          return { exIdx, setIdx: setIdx + 1 };
        }
        if (exIdx + 1 < exercises.length) {
          const nextExercise = exercises[exIdx + 1];
          setCurrentExercise(nextExercise);
          return { exIdx: exIdx + 1, setIdx: 0 };
        }
      }
      // End of workout
      setMainTimerRunning(false);
      setRestTimerRunning(false);
      return { exIdx, setIdx };
    });
  };

  // Log a set and start rest timer
  const logSet = (weight: number, reps: number, rpe = 8): void => {
    const { exIdx, setIdx } = currentSet;
    const ex = exercises[exIdx];
    
    setLogs((prev) => [
      ...prev,
      {
        exerciseId: ex.id,
        setIndex: setIdx,
        actualWeight: weight,
        actualReps: reps,
        restSeconds: ex.restSeconds,
        rpe,
      },
    ]);
    
    // Start rest timer
    setRestTimerDuration(ex.restSeconds);
    setRestTimerRunning(true);
    setMainTimerRunning(false);
    
    next();
  };

  // Finish workout and save to Supabase
  const finishWorkout = async (): Promise<void> => {
    if (!user?.id) {
      alert('Please log in to save your workout');
      return;
    }
    
    try {
      // Save workout session to Supabase
      const response = await fetch('/api/saveWorkoutSession', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          logs: logs,
          workoutData: workoutData,
          completedAt: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save workout session');
      }

      console.log('Workout session saved successfully');
      router.push('/dashboard');
    } catch (err) {
      console.error('Save failed:', err);
      alert('Failed to save workout. Please try again.');
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
        <div className="text-center">
          <div className="text-white text-xl mb-4">Please log in to access your workout</div>
          <button
            onClick={() => router.push('/login')}
            className="bg-[#22C55E] px-6 py-3 rounded-xl text-white font-semibold hover:bg-[#16a34a] transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F172A] p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-2">Today&apos;s Workout</h1>
          <p className="text-gray-400">Build and track your workouts</p>
        </div>

        {/* Section Navigation */}
        <div className="flex justify-center">
          <div className="bg-[#1E293B] rounded-xl p-1">
            <button
              onClick={() => setActiveSection('chat')}
              className={`px-6 py-2 rounded-lg transition-colors ${
                activeSection === 'chat'
                  ? 'bg-[#22C55E] text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              AI Chat Agent
            </button>
            <button
              onClick={() => setActiveSection('workout')}
              className={`px-6 py-2 rounded-lg transition-colors ${
                activeSection === 'workout'
                  ? 'bg-[#22C55E] text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Today&apos;s Workout
            </button>
          </div>
        </div>

        {/* AI Chat Agent Section */}
        {activeSection === 'chat' && (
          <div className="space-y-6">
            {/* Time Selection */}
            <div className="flex items-center justify-center gap-4">
              <label className="text-white text-sm">Time Available:</label>
              <input
                type="number"
                min={5}
                max={120}
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
                className="w-20 bg-[#1E293B] border border-[#334155] px-3 py-2 rounded-lg text-white text-center"
              />
              <span className="text-gray-400 text-sm">minutes</span>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="bg-red-900/20 border border-red-500 text-red-400 px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            {/* Prompt Box */}
            <div className="bg-[#1E293B] rounded-xl p-6 shadow-md">
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Tell me what workout you want to do today. For example: 'I want a chest and triceps workout with dumbbells' or 'Give me a 30-minute cardio session'..."
                  className="w-full h-32 bg-[#0F172A] border border-[#334155] rounded-lg p-4 text-white resize-none focus:border-[#22C55E] focus:outline-none"
                />
                <button
                  onClick={startListening}
                  disabled={isListening}
                  className={`absolute bottom-4 right-4 p-2 rounded-lg transition-colors ${
                    isListening 
                      ? 'bg-red-500 text-white' 
                      : 'bg-[#22C55E] text-white hover:bg-[#16a34a]'
                  }`}
                  title="Voice input"
                >
                  🎤
                </button>
              </div>
              
              {(transcript || prompt) && (
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={resetTranscript}
                    className="text-gray-400 hover:text-white text-sm transition-colors"
                  >
                    Clear
                  </button>
                </div>
              )}

              <button
                onClick={generateWorkout}
                disabled={isLoading || (!prompt.trim() && !transcript)}
                className="mt-4 bg-[#22C55E] px-6 py-3 rounded-xl text-white font-semibold hover:bg-[#16a34a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    AI is creating your workout...
                  </span>
                ) : (
                  'Generate My Workout'
                )}
              </button>
            </div>

            {/* Generated Workout Display */}
            {workoutData && (
              <div className="bg-[#1E293B] rounded-xl p-6 shadow-md space-y-4">
                <h3 className="text-lg font-semibold text-white">Your Generated Workout</h3>
                
                {workoutData.prompt && (
                  <div className="bg-[#0F172A] p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-400 mb-2">Your Request:</h4>
                    <p className="text-white text-sm">{workoutData.prompt}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <h4 className="text-white font-medium mb-2">Warm-up</h4>
                    <ul className="space-y-1">
                      {workoutData.warmup.map((item, i) => (
                        <li key={i} className="text-gray-300 text-sm">• {item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-white font-medium mb-2">Main Workout</h4>
                    <ul className="space-y-1">
                      {workoutData.workout.map((item, i) => (
                        <li key={i} className="text-gray-300 text-sm">• {item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-white font-medium mb-2">Cool-down</h4>
                    <ul className="space-y-1">
                      {workoutData.cooldown.map((item, i) => (
                        <li key={i} className="text-gray-300 text-sm">• {item}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <button
                  onClick={() => setActiveSection('workout')}
                  className="bg-[#22C55E] px-6 py-3 rounded-xl text-white font-semibold hover:bg-[#16a34a] transition-colors"
                >
                  Start This Workout
                </button>
              </div>
            )}
          </div>
        )}

        {/* Today's Workout Section */}
        {activeSection === 'workout' && (
          <div className="space-y-6">
            {/* Main Workout Timer */}
            <div className="bg-[#1E293B] rounded-xl p-6 shadow-md">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-white">Workout Timer</h2>
                <WorkoutTimer 
                  running={mainTimerRunning} 
                  onToggle={() => setMainTimerRunning(!mainTimerRunning)} 
                />
              </div>
            </div>

            {/* Rest Timer */}
            {restTimerRunning && (
              <div className="bg-[#1E293B] rounded-xl p-6 shadow-md border-l-4 border-orange-500">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-white">Rest Timer</h2>
                  <span className="text-orange-400 font-medium">Take a break!</span>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-orange-400 mb-2">
                    {Math.floor(restTimerDuration / 60)}:{(restTimerDuration % 60).toString().padStart(2, '0')}
                  </div>
                  <p className="text-gray-400">Next set coming up...</p>
                </div>
              </div>
            )}

            {/* Workout Content */}
            {isLoadingWorkout ? (
              <div className="text-center text-white">Loading workout...</div>
            ) : workoutError ? (
              <div className="text-center">
                <div className="text-red-400 mb-4">{workoutError}</div>
                <p className="text-gray-400">No workout found for today.</p>
                <button
                  onClick={() => setActiveSection('chat')}
                  className="mt-4 bg-[#22C55E] px-6 py-3 rounded-xl text-white font-semibold hover:bg-[#16a34a] transition-colors"
                >
                  Create New Workout
                </button>
              </div>
            ) : exercises.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                <p className="mb-4">No workout found for today.</p>
                <button
                  onClick={() => setActiveSection('chat')}
                  className="bg-[#22C55E] px-6 py-3 rounded-xl text-white font-semibold hover:bg-[#16a34a] transition-colors"
                >
                  Create your first workout
                </button>
              </div>
            ) : (
              <div className="bg-[#1E293B] rounded-xl p-6 shadow-md">
                {/* Current Exercise Highlight */}
                {currentExercise && (
                  <div className="mb-6 p-4 bg-[#22C55E]/10 border border-[#22C55E]/20 rounded-lg">
                    <h3 className="text-lg font-semibold text-[#22C55E] mb-2">
                      Current: {currentExercise.name}
                    </h3>
                    <p className="text-gray-300 text-sm">
                      Set {currentSet.setIdx + 1} of {currentExercise.sets} • {currentExercise.reps} reps
                    </p>
                  </div>
                )}

                {/* Exercise List */}
                {exercises.map((ex, exIdx) => (
                  <article key={ex.id} className="mb-6">
                    <h2 className="text-xl font-semibold text-white mb-2">{ex.name}</h2>

                    {Array.from({ length: ex.sets }, (_, setIdx) => {
                      const completed = logs.some((l) => l.exerciseId === ex.id && l.setIndex === setIdx);
                      const isCurrent = exIdx === currentSet.exIdx && setIdx === currentSet.setIdx;
                      
                      return (
                        <div
                          key={setIdx}
                          className={`flex items-center space-x-2 p-3 rounded mb-2 transition-all ${
                            completed 
                              ? 'opacity-50 bg-gray-800' 
                              : isCurrent
                              ? 'bg-[#22C55E]/20 border border-[#22C55E]/30'
                              : 'bg-[#111827]'
                          }`}
                        >
                          <span className={`w-6 text-center font-medium ${
                            isCurrent ? 'text-[#22C55E]' : 'text-white'
                          }`}>
                            {setIdx + 1}
                          </span>
                          <input
                            type="number"
                            defaultValue={ex.prescribedWeight}
                            disabled={completed}
                            onBlur={(e) => logSet(Number(e.target.value), ex.reps)}
                            className="w-16 p-1 bg-transparent border border-gray-600 rounded text-white text-center focus:border-[#22C55E] focus:outline-none"
                            placeholder="0"
                          />
                          <span className="text-white">×</span>
                          <span className="w-8 text-center text-white">{ex.reps}</span>
                          <button
                            type="button"
                            onClick={() => logSet(ex.prescribedWeight, ex.reps)}
                            disabled={completed}
                            className={`ml-auto px-3 py-1 rounded transition-colors ${
                              completed
                                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                : isCurrent
                                ? 'bg-[#22C55E] hover:bg-[#16a34a] text-white'
                                : 'bg-green-500 hover:bg-green-600 text-white'
                            }`}
                          >
                            {completed ? 'Done' : 'Complete'}
                          </button>
                        </div>
                      );
                    })}
                  </article>
                ))}

                {/* Complete Workout Button */}
                <footer className="flex justify-end pt-4 border-t border-gray-700">
                  <button
                    type="button"
                    onClick={finishWorkout}
                    className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg transition-colors"
                  >
                    Complete Workout
                  </button>
                </footer>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 