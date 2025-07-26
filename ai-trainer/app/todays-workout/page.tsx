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
  previousWeight?: number;
  previousReps?: number;
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
function WorkoutTimer({ duration, running, onExpire, className = '' }: { 
  duration: number; 
  running: boolean; 
  onExpire: () => void;
  className?: string;
}) {
  const [seconds, setSeconds] = useState(duration);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) {
          onExpire();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, onExpire]);

  const hh = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const mm = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  return (
    <div className={`bg-[#1E293B] rounded-xl p-6 shadow-md ${className}`}>
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-white">Workout Timer</h2>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => {/* Timer toggle handled by parent */}}
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
          <span className="font-mono text-2xl text-white">{`${hh}:${mm}:${ss}`}</span>
        </div>
      </div>
    </div>
  );
}

// Simple WorkoutChat Component
function WorkoutChat({ concise = false }: { concise?: boolean }) {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    { role: 'assistant', content: 'Ready to help with your workout! How are you feeling today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;
    
    const userMessage = { role: 'user' as const, content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Simulate AI response
    setTimeout(() => {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Great work! Keep pushing through those sets. Remember to maintain proper form.'
      }]);
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div className="space-y-4">
      <div className="max-h-40 overflow-y-auto space-y-2">
        {messages.map((msg, i) => (
          <div key={i} className={`p-2 rounded-lg ${
            msg.role === 'user' 
              ? 'bg-[#22C55E]/20 text-white ml-4' 
              : 'bg-[#1E293B] text-gray-300'
          }`}>
            {msg.content}
          </div>
        ))}
        {isLoading && (
          <div className="bg-[#1E293B] text-gray-300 p-2 rounded-lg">
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-[#22C55E]"></div>
              <span>AI is thinking...</span>
            </div>
          </div>
        )}
      </div>
      
      {!concise && (
        <div className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Ask about your workout..."
            className="flex-1 bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-white text-sm focus:border-[#22C55E] focus:outline-none"
          />
          <button
            onClick={sendMessage}
            disabled={isLoading}
            className="bg-[#22C55E] hover:bg-[#16a34a] text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}

export default function TodaysWorkoutPage() {
  const { user } = useAuth();
  const router = useRouter();
  
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

  const [isLoadingWorkout, setIsLoadingWorkout] = useState(true);
  const [workoutError, setWorkoutError] = useState('');
  const [mainTimerRunning, setMainTimerRunning] = useState(false);
  const [restTimerRunning, setRestTimerRunning] = useState(false);
  const [restTimerDuration, setRestTimerDuration] = useState(60);
  const [duration] = useState(45 * 60); // 45 minutes default

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

    const loadWorkout = async () => {
      try {
        const response = await fetch('/api/currentWorkout');
        const data = await response.json();
        
        if (data.error) {
          setWorkoutError(data.error);
          return;
        }
        
        if (data.details && data.details.length > 0) {
          // Convert to Exercise format for tracking
          const exerciseList: Exercise[] = data.details.map((ex: { name: string; sets: Array<{ reps: number; prescribed: number; rest: number }> }, index: number) => ({
            id: `${ex.name}-${index}`,
            name: ex.name,
            sets: ex.sets.length,
            reps: ex.sets[0]?.reps || 8,
            prescribedWeight: ex.sets[0]?.prescribed || 0,
            previousWeight: ex.sets[0]?.prescribed ? ex.sets[0].prescribed - 5 : undefined,
            previousReps: ex.sets[0]?.reps || 8,
            restSeconds: ex.sets[0]?.rest ?? 60,
          }));
          
          setExercises(exerciseList);
        } else {
          // No workout found, could prompt for AI generation
          setWorkoutError('No workout found for today');
        }
      } catch (err) {
        console.error('Error fetching workout:', err);
        setWorkoutError('Failed to load workout');
      } finally {
        setIsLoadingWorkout(false);
      }
    };

    loadWorkout();
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
      
      // Convert the generated workout to exercises format
      const exerciseList: Exercise[] = data.workout.map((item: string, index: number) => {
        // Parse workout items like "Back Squat: 3x8 @ 100lb rest 90s"
        const match = item.match(/^(.+?):\s*(\d+)x(\d+)\s*@\s*(\d+)lb\s*rest\s*(\d+)s?$/i);
        if (match) {
          const prescribedWeight = parseInt(match[4]);
          return {
            id: `${match[1]}-${index}`,
            name: match[1],
            sets: parseInt(match[2]),
            reps: parseInt(match[3]),
            prescribedWeight: prescribedWeight,
            previousWeight: prescribedWeight - 5,
            previousReps: parseInt(match[3]),
            restSeconds: parseInt(match[5]),
          };
        }
        // Fallback for non-standard format
        return {
          id: `${item}-${index}`,
          name: item,
          sets: 3,
          reps: 8,
          prescribedWeight: 0,
          previousWeight: undefined,
          previousReps: 8,
          restSeconds: 60,
        };
      });
      
      setExercises(exerciseList);
      
    } catch (err) {
      console.error('Workout generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate workout');
    } finally {
      setIsLoading(false);
    }
  };



  // Log a set and start rest timer
  const logSet = (exIdx: number, setIdx: number, weight: number, reps: number, rpe = 8): void => {
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
  };

  // Add a set to an exercise
  const addSet = (exIdx: number): void => {
    setExercises(prev =>
      prev.map((ex, i) =>
        i === exIdx ? { ...ex, sets: ex.sets + 1 } : ex
      )
    );
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
    <div className="p-6 max-w-md mx-auto bg-[#0F172A] min-h-screen">
      {/* Header */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 space-y-2 sm:space-y-0">
        <h1 className="text-3xl font-bold text-white">Today&apos;s Workout</h1>
        <div className="flex items-center space-x-4">
          <span className="text-white">Time Available: 45 min</span>
          <button
            onClick={() => setMainTimerRunning((prev) => !prev)}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg"
          >
            {mainTimerRunning ? 'Pause' : 'Start'}
          </button>
          <button 
            onClick={startListening} 
            className="p-2 bg-transparent"
            aria-label="Voice input"
          >
            🎤
          </button>
        </div>
      </header>

      {/* Main Workout Timer */}
      <WorkoutTimer 
        duration={duration} 
        running={mainTimerRunning} 
        onExpire={() => setMainTimerRunning(false)} 
        className="mb-6" 
      />

      {/* Rest Timer */}
      {restTimerRunning && (
        <div className="bg-[#1E293B] rounded-xl p-6 shadow-md border-l-4 border-orange-500 mb-6">
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

      {/* AI Chat Agent Section */}
      <section className="mb-6">
        <h2 className="text-xl font-semibold text-white mb-4">AI Workout Builder</h2>
        
        {/* Time Selection */}
        <div className="flex items-center gap-4 mb-4">
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
          <div className="bg-red-900/20 border border-red-500 text-red-400 px-4 py-3 rounded-xl mb-4">
            {error}
          </div>
        )}

        {/* Prompt Box */}
        <div className="bg-[#1E293B] rounded-xl p-4 shadow-md mb-4">
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Tell me what workout you want to do today. For example: 'I want a chest and triceps workout with dumbbells' or 'Give me a 30-minute cardio session'..."
              className="w-full h-24 bg-[#0F172A] border border-[#334155] rounded-lg p-3 text-white resize-none focus:border-[#22C55E] focus:outline-none text-sm"
            />
            <button
              onClick={startListening}
              disabled={isListening}
              className={`absolute bottom-3 right-3 p-1 rounded transition-colors ${
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
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={resetTranscript}
                className="text-gray-400 hover:text-white text-xs transition-colors"
              >
                Clear
              </button>
            </div>
          )}

          <button
            onClick={generateWorkout}
            disabled={isLoading || (!prompt.trim() && !transcript)}
            className="mt-3 bg-[#22C55E] px-4 py-2 rounded-lg text-white font-semibold hover:bg-[#16a34a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                Creating workout...
              </span>
            ) : (
              'Generate My Workout'
            )}
          </button>
        </div>

        {/* Generated Workout Display */}
        {workoutData && (
          <div className="bg-[#1E293B] rounded-xl p-4 shadow-md space-y-3 mb-4">
            <h3 className="text-md font-semibold text-white">Your Generated Workout</h3>
            
            {workoutData.prompt && (
              <div className="bg-[#0F172A] p-3 rounded-lg">
                <h4 className="text-xs font-medium text-gray-400 mb-1">Your Request:</h4>
                <p className="text-white text-xs">{workoutData.prompt}</p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3">
              <div>
                <h4 className="text-white font-medium mb-1 text-sm">Warm-up</h4>
                <ul className="space-y-1">
                  {workoutData.warmup.map((item, i) => (
                    <li key={i} className="text-gray-300 text-xs">• {item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-white font-medium mb-1 text-sm">Main Workout</h4>
                <ul className="space-y-1">
                  {workoutData.workout.map((item, i) => (
                    <li key={i} className="text-gray-300 text-xs">• {item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-white font-medium mb-1 text-sm">Cool-down</h4>
                <ul className="space-y-1">
                  {workoutData.cooldown.map((item, i) => (
                    <li key={i} className="text-gray-300 text-xs">• {item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Workout Tracking Section */}
      <section className="space-y-6 mb-6">
        {isLoadingWorkout ? (
          <div className="text-center text-white">Loading workout...</div>
        ) : workoutError ? (
          <div className="text-center">
            <div className="text-red-400 mb-4">{workoutError}</div>
            <p className="text-gray-400">No workout found for today.</p>
          </div>
        ) : exercises.length === 0 ? (
          <div className="text-center text-gray-400 py-4">
            <p className="mb-4">No workout found for today.</p>
            <p className="text-sm">Use the AI builder above to create your first workout!</p>
          </div>
        ) : (
          exercises.map((ex, exIdx) => (
            <article key={ex.id} className="bg-[#1F2937] p-4 rounded-lg">
              <h2 className="text-2xl font-semibold text-white mb-3">{ex.name}</h2>
              <table className="w-full text-white">
                <thead>
                  <tr className="border-b border-gray-600">
                    <th className="py-2 text-left">Set</th>
                    <th className="py-2 text-left">Previous</th>
                    <th className="py-2 text-left">Lbs</th>
                    <th className="py-2 text-left">Reps</th>
                    <th className="py-2 text-center">✓</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: ex.sets }).map((_, si) => {
                    const done = logs.some(l => l.exerciseId === ex.id && l.setIndex === si);
                    const prevLabel = ex.previousWeight
                      ? `${ex.previousWeight} lb x ${ex.previousReps ?? ex.reps}`
                      : `—`;
                    
                    return (
                      <tr key={si} className="border-b border-gray-700">
                        <td className="py-2">{si + 1}</td>
                        <td className="py-2">{prevLabel}</td>
                        <td className="py-2">
                          <input
                            type="number"
                            defaultValue={ex.prescribedWeight}
                            disabled={done}
                            onBlur={e => logSet(exIdx, si, Number(e.target.value), ex.reps)}
                            className="w-16 p-1 bg-transparent border border-gray-600 rounded text-white"
                          />
                        </td>
                        <td className="py-2">
                          <input
                            type="number"
                            defaultValue={ex.reps}
                            disabled={done}
                            onBlur={e => logSet(exIdx, si, ex.prescribedWeight, Number(e.target.value))}
                            className="w-12 p-1 bg-transparent border border-gray-600 rounded text-white"
                          />
                        </td>
                        <td className="py-2 text-center">
                          <input
                            type="checkbox"
                            checked={done}
                            disabled={done}
                            onChange={() => logSet(exIdx, si, ex.prescribedWeight, ex.reps)}
                            className="w-4 h-4 text-green-400"
                          />
                        </td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td colSpan={5} className="py-2 text-center">
                      <button
                        onClick={() => addSet(exIdx)}
                        className="text-green-400 hover:underline"
                      >
                        + ADD SET
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </article>
          ))
        )}
      </section>

      {/* Complete Workout Button */}
      <button
        onClick={finishWorkout}
        className="w-full bg-red-500 hover:bg-red-600 text-white py-3 rounded-lg mb-8"
      >
        Finish Workout
      </button>

      {/* WorkoutChat Section */}
      <section className="bg-[#1F2937] p-4 rounded-lg">
        <h2 className="text-xl font-semibold text-white mb-2">Your Generated Workout</h2>
        <WorkoutChat concise />
      </section>
    </div>
  );
} 