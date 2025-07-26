'use client'
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import WorkoutTable from '../components/WorkoutTable';
import ChatBubble from '../components/ChatBubble';
import { supabase } from '@/lib/supabaseClient';





interface WorkoutData {
  warmup: string[];
  workout: string[];
  cooldown: string[];
  prompt?: string;
}

interface NikeExercise {
  Workout: number;
  'Upper / Lower body': string;
  Sets: number;
  Reps: string;
  Exercise: string;
  'Exercise Type': string;
}

interface NikeWorkout {
  exercises: NikeExercise[];
  workoutNumber: number;
}





// Simple Timer Component - Counts UP from 0
function WorkoutTimer({ elapsedTime, running, onToggle, className = '' }: { 
  elapsedTime: number; 
  running: boolean; 
  onToggle: () => void;
  className?: string;
}) {
  const hh = String(Math.floor(elapsedTime / 3600)).padStart(2, '0');
  const mm = String(Math.floor((elapsedTime % 3600) / 60)).padStart(2, '0');
  const ss = String(elapsedTime % 60).padStart(2, '0');

  return (
    <div className={`bg-[#1E293B] rounded-xl p-6 shadow-md ${className}`}>
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-white">Workout Timer</h2>
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
          <span className="font-mono text-2xl text-white">{`${hh}:${mm}:${ss}`}</span>
        </div>
      </div>
    </div>
  );
}



export default function TodaysWorkoutPage() {
  const { user } = useAuth();
  const router = useRouter();
  
  // Timer state - counts UP from 0
  const [elapsedTime, setElapsedTime] = useState(0); // seconds
  const [timeAvailable, setTimeAvailable] = useState(45); // minutes, default
  const [mainTimerRunning, setMainTimerRunning] = useState(false);

  
  // Chat agent state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [workoutData, setWorkoutData] = useState<WorkoutData | NikeWorkout | null>(null);
  const [chatMessages, setChatMessages] = useState<Array<{sender: 'user' | 'assistant', text: string, timestamp?: string}>>([]);
  const [waitingForNikeConfirmation, setWaitingForNikeConfirmation] = useState(false);
  const [inputText, setInputText] = useState('');
  const chatHistoryRef = useRef<HTMLDivElement>(null);



  // Timer effect - counts up when running
  useEffect(() => {
    if (!mainTimerRunning) return;
    
    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [mainTimerRunning]);

  // Start timer when workout data is generated
  useEffect(() => {
    if (workoutData && !mainTimerRunning) {
      setMainTimerRunning(true);
    }
  }, [workoutData, mainTimerRunning]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
  }, [user, router]);

  // Load Nike workout data
  useEffect(() => {
    const loadNikeWorkout = async () => {
      const { data, error } = await supabase
        .from('nike_workouts')
        .select('Workout, "Upper / Lower body", Sets, Reps, Exercise, "Exercise Type"')
        .eq('Workout', 1);

      if (error) {
        console.error('❌ Error querying nike_workouts:', error);
      } else {
        console.log('✅ Nike Workout 1:', data);
        // Convert to NikeWorkout format and set as workout data
        if (data && data.length > 0) {
          const nikeWorkout: NikeWorkout = {
            exercises: data as NikeExercise[],
            workoutNumber: 1
          };
          setWorkoutData(nikeWorkout);
        }
      }
    };

    loadNikeWorkout();
  }, []);

  // Auto-scroll chat to bottom when new messages are added
  useEffect(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  }, [chatMessages]);



  // Handle chat messages
  const handleChatMessage = async (message: string) => {
    if (!user?.id) {
      setError('Please log in to use the chat');
      return;
    }

    const timestamp = new Date().toLocaleTimeString();
    
    // Add user message to chat
    setChatMessages(prev => [...prev, { 
      sender: 'user', 
      text: message, 
      timestamp 
    }]);

    // Check for Nike keyword
    const isNike = message.toLowerCase().includes('nike');
    
    // Check for exercise instruction request
    const exerciseInstructionMatch = message.match(/how should i perform (.+?)\?|what is the correct form for (.+?)\?/i);
    
    if (isNike) {
      await handleNikeWorkout();
    } else if (exerciseInstructionMatch) {
      const exerciseName = exerciseInstructionMatch[1] || exerciseInstructionMatch[2];
      await handleExerciseInstruction(exerciseName);
    } else {
      await generateWorkoutFromMessage(message);
    }
  };

  // Handle Nike workout generation
  const handleNikeWorkout = async () => {
    if (!user?.id) return;
    
    const timestamp = new Date().toLocaleTimeString();
    
    // Get user's last Nike workout for confirmation
    const profileResponse = await fetch('/api/getNikeProgress', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: user.id
      })
    });
    
    if (profileResponse.ok) {
      const profileData = await profileResponse.json();
      const lastWorkout = profileData.lastWorkout || 0;
      const nextWorkout = lastWorkout + 1;
      
      // Add assistant response to chat
      setChatMessages(prev => [...prev, { 
        sender: 'assistant', 
        text: `You last completed Nike workout ${lastWorkout}. Would you like to do workout ${nextWorkout} today? (yes/no)`,
        timestamp 
      }]);
      
      setWaitingForNikeConfirmation(true);
    }
  };

  // Handle exercise instruction requests
  const handleExerciseInstruction = async (exerciseName: string) => {
    if (!user?.id) return;
    
    const timestamp = new Date().toLocaleTimeString();
    
    try {
      // First try to get instruction from database
      const { data: exerciseData, error } = await supabase
        .from('exercise')
        .select('instruction_text')
        .ilike('name', `%${exerciseName}%`)
        .single();
      
      let instruction = '';
      
      if (!error && exerciseData?.instruction_text) {
        instruction = exerciseData.instruction_text;
      } else {
        // Fallback to GPT for generic instruction
        const response = await fetch('/api/exerciseInstruction', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            exerciseName,
            userId: user.id
          })
        });
        
        if (response.ok) {
          const { instruction: gptInstruction } = await response.json();
          instruction = gptInstruction;
        } else {
          instruction = `For ${exerciseName}: Focus on proper form, controlled movement, and full range of motion. If you're unsure about technique, consider consulting a fitness professional.`;
        }
      }
      
      setChatMessages(prev => [...prev, {
        sender: 'assistant',
        text: instruction,
        timestamp
      }]);
      
    } catch {
      setChatMessages(prev => [...prev, {
        sender: 'assistant',
        text: `I couldn't find specific instructions for ${exerciseName}. Please consult a fitness professional for proper form guidance.`,
        timestamp
      }]);
    }
  };

  // Generate workout from chat message
  const generateWorkoutFromMessage = async (message: string) => {
    if (!user?.id) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const timestamp = new Date().toLocaleTimeString();
      
      const response = await fetch('/api/generateWorkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          minutes: timeAvailable,
          prompt: message
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate workout');
      }

      setWorkoutData(data);
      setChatMessages(prev => [...prev, { 
        sender: 'assistant', 
        text: 'Your workout has been generated! Check the workout table below.',
        timestamp 
      }]);
      
    } catch (err) {
      console.error('Workout generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate workout');
      setChatMessages(prev => [...prev, { 
        sender: 'assistant', 
        text: 'Sorry, there was an error generating your workout. Please try again.',
        timestamp: new Date().toLocaleTimeString()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Nike confirmation response
  const handleNikeConfirmation = async (response: string) => {
    if (!user?.id) return;
    
    const isYes = response.toLowerCase().includes('yes') || response.toLowerCase().includes('y');
    const timestamp = new Date().toLocaleTimeString();
    
    if (isYes) {
      // Add user response to chat
      setChatMessages(prev => [...prev, { 
        sender: 'user', 
        text: response,
        timestamp 
      }]);
      
      // Generate the Nike workout
      setIsLoading(true);
      setWaitingForNikeConfirmation(false);
      
      try {
        const workoutResponse = await fetch('/api/generateWorkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user.id,
            minutes: timeAvailable,
            prompt: 'nike'
          })
        });

        const data = await workoutResponse.json();
        
        if (!workoutResponse.ok) {
          throw new Error(data.error || 'Failed to generate workout');
        }

        setWorkoutData(data);
        setChatMessages(prev => [...prev, { 
          sender: 'assistant', 
          text: 'Great! Your Nike workout has been generated. Check the workout table below.',
          timestamp 
        }]);
        
      } catch (err) {
        console.error('Workout generation error:', err);
        setError(err instanceof Error ? err.message : 'Failed to generate workout');
        setChatMessages(prev => [...prev, { 
          sender: 'assistant', 
          text: 'Sorry, there was an error generating your workout. Please try again.',
          timestamp 
        }]);
      } finally {
        setIsLoading(false);
      }
    } else {
      // User declined
      setChatMessages(prev => [
        ...prev, 
        { sender: 'user', text: response, timestamp },
        { sender: 'assistant', text: 'No problem! You can ask for a different type of workout anytime.', timestamp }
      ]);
      setWaitingForNikeConfirmation(false);
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
          <span className="text-white">Time Available: {timeAvailable} min</span>
          <button
            onClick={() => setMainTimerRunning((prev) => !prev)}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg"
          >
            {mainTimerRunning ? 'Pause' : 'Start'}
          </button>

        </div>
      </header>

      {/* Main Workout Timer */}
      <WorkoutTimer 
        elapsedTime={elapsedTime}
        running={mainTimerRunning} 
        onToggle={() => setMainTimerRunning(!mainTimerRunning)} 
        className="mb-6" 
      />



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
            value={timeAvailable}
            onChange={(e) => setTimeAvailable(Number(e.target.value))}
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

        {/* Integrated Chat Container */}
        <div className="bg-[#1E293B] rounded-xl shadow-md mb-4">
          <div className="p-4 border-b border-[#334155]">
            <h3 className="text-md font-semibold text-white">AI Workout Coach</h3>
          </div>
          
          <div className="chat-container">
            <div className="chat-history" ref={chatHistoryRef}>
              {chatMessages.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  <p>Ask your coach anything...</p>
                  <p className="text-sm mt-2">Try: &quot;I only have 30 minutes&quot; or &quot;Nike&quot;</p>
                </div>
              ) : (
                <div className="space-y-3 p-4">
                  {chatMessages.map((message, index) => (
                    <ChatBubble 
                      key={index} 
                      sender={message.sender} 
                      message={message.text}
                      timestamp={message.timestamp}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-[#334155]">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && inputText.trim() && !isLoading) {
                    const message = inputText.trim();
                    setInputText('');
                                      if (waitingForNikeConfirmation) {
                    handleNikeConfirmation(message);
                  } else {
                      handleChatMessage(message);
                    }
                  }
                }}
                placeholder={waitingForNikeConfirmation 
                  ? "Type 'yes' or 'no' to confirm..." 
                  : "Ask your coach anything..."
                }
                disabled={isLoading}
                className="w-full bg-[#0F172A] border border-[#334155] rounded-lg p-3 text-white focus:border-[#22C55E] focus:outline-none disabled:opacity-50"
              />
            </div>
          </div>
        </div>


      </section>

      {/* Workout Table Section */}
      <section className="mb-6">
        {!workoutData ? (
          <div className="text-center text-gray-400 py-8">
            <p className="mb-4">No workout found for today.</p>
            <p className="text-sm">Use the AI builder above to create your first workout!</p>
          </div>
        ) : (
          <WorkoutTable 
            workout={workoutData} 
            onFinishWorkout={() => {
              setWorkoutData(null);
            }}
            onStopTimer={() => {
              setMainTimerRunning(false);
            }}
          />
        )}
      </section>


    </div>
  );
} 