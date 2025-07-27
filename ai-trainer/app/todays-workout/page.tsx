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
  workout: number;
  workout_type: string;
  sets: number;
  reps: string;
  exercise: string;
  exercise_type: string;
  instructions?: string;
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

  

  const [workoutData, setWorkoutData] = useState<WorkoutData | NikeWorkout | null>(null);
  const [chatMessages, setChatMessages] = useState<Array<{sender: 'user' | 'assistant', text: string, timestamp?: string}>>([]);

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
        .select('workout, workout_type, sets, reps, exercise, instructions, exercise_type')
        .eq('workout', 1);

      console.log('Nike Workout 1:', data);

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

  // Build day-of-week workout using day_core_lifts table
  const buildDayWorkout = async (day: string, userId: string, minutes: number = 45) => {
    try {
      /* 1️⃣  look up the core lift for that day */
      const { data: coreRow } = await supabase
        .from('day_core_lifts')
        .select('core_lift')
        .eq('day_of_week', day)
        .single();

      if (!coreRow) {
        setChatMessages(prev => [
          ...prev,
          { sender: 'assistant', text: `I don't have a core lift configured for ${day}.`, timestamp: new Date().toLocaleTimeString() },
        ]);
        return;
      }

      const coreLiftName = coreRow.core_lift;

      /* 2️⃣  fetch the core-lift row (is_main_lift = TRUE) */
      const { data: coreLift } = await supabase
        .from('exercises')
        .select('*')
        .eq('name', coreLiftName)
        .eq('is_main_lift', true)
        .single();

      if (!coreLift) {
        setChatMessages(prev => [
          ...prev,
          { sender: 'assistant', text: `Core lift ${coreLiftName} not found.`, timestamp: new Date().toLocaleTimeString() },
        ]);
        return;
      }

      /* 3️⃣  get user equipment */
      const { data: profile } = await supabase
        .from('profiles')
        .select('equipment')
        .eq('id', userId)
        .single();

      const gear = profile?.equipment ?? [];

      /* 4️⃣  pull matching accessories
             – same primary_muscle group
             – NOT main lifts
             – equipment_required ⊆ user gear (or empty)         */
      const { data: accessories } = await supabase
        .from('exercises')
        .select('*')
        .eq('is_main_lift', false)
        .eq('primary_muscle', coreLift.primary_muscle);

      // Filter accessories by equipment availability
      let filteredAccessories = accessories || [];
      if (gear.length > 0) {
        filteredAccessories = filteredAccessories.filter(acc => 
          !acc.equipment_required || 
          acc.equipment_required.length === 0 ||
          gear.some((eq: string) => acc.equipment_required.includes(eq))
        );
      }

      /* 5️⃣  time-box: assume 10 min core lift warm-up
             + 5 min per accessory set group                    */
      const slots = Math.max(0, Math.floor((minutes - 10) / 5));
      const chosen = filteredAccessories.sort(() => 0.5 - Math.random()).slice(0, slots);

      const fullPlan = [coreLift, ...chosen];

      /* 6️⃣  save to workouts / workout_log_entries */
      const { data: workout } = await supabase
        .from('workouts')
        .insert({
          user_id: userId,
          program_name: 'DayOfWeek',
          workout_type: `${day} – ${coreLift.primary_muscle}`,
          main_lifts: JSON.stringify([coreLift.name]),
          accessory_lifts: JSON.stringify(chosen.map(c => c.name))
        })
        .select('id')
        .single();

      /* 7️⃣  return chat summary */
      let reply = `**${day} Workout (${minutes} min)**\n`;
      reply += `• **Core lift:** ${coreLift.name}\n`;
      chosen.forEach(a => reply += `• ${a.name}\n`);

      setChatMessages(prev => [
        ...prev,
        { sender: 'assistant', text: reply, timestamp: new Date().toLocaleTimeString() },
      ]);

      // Convert to workout data format for the table
      const workoutData: WorkoutData = {
        warmup: [],
        workout: fullPlan.map(ex => `${ex.name}: ${ex.is_main_lift ? '4x8' : '3x12'}`),
        cooldown: [],
        prompt: `${day} Day-of-Week Workout`
      };

      setWorkoutData(workoutData);

    } catch (err) {
      console.error('Error building day workout:', err);
      setChatMessages(prev => [
        ...prev,
        { sender: 'assistant', text: `Sorry, I couldn't create your ${day} workout. Please try again.`, timestamp: new Date().toLocaleTimeString() },
      ]);
    }
  };



  // Handle chat messages
  const handleChatMessage = async (message: string) => {
    const lower = message.toLowerCase();

    // 1. Append user message to chat history
    setChatMessages(prev => [...prev, { sender: 'user', text: message, timestamp: new Date().toLocaleTimeString() }]);

    // 2. Handle Nike workout request
    if (lower.includes('nike')) {
      if (!user?.id) {
        setChatMessages(prev => [
          ...prev,
          { sender: 'assistant', text: "Please log in to access your Nike workout.", timestamp: new Date().toLocaleTimeString() },
        ]);
        return;
      }

      try {
        // 1. Query profiles.last_nike_workout to find the last one completed
        const { data: profile } = await supabase
          .from('profiles')
          .select('last_nike_workout')
          .eq('id', user.id)
          .single();

        const lastWorkout = profile?.last_nike_workout || 0;
        const nextWorkout = lastWorkout + 1;

        console.log('⚡ Nike workout number being requested:', nextWorkout);

        // 2. Query nike_workouts where workout = nextWorkout
        const { data: rows, error } = await supabase
          .from('nike_workouts')
          .select('workout, workout_type, sets, reps, exercise, instructions, exercise_type')
          .eq('workout', nextWorkout);

        console.log(`Nike Workout ${nextWorkout}:`, rows);

        console.log('📊 Nike workout result:', { rows: rows?.length, error, nextWorkout });

        if (error || !rows || rows.length === 0) {
          setChatMessages(prev => [
            ...prev,
            { sender: 'assistant', text: "Sorry, I couldn't load your Nike workout.", timestamp: new Date().toLocaleTimeString() },
          ]);
          return;
        }

        // 3. Extract workout_type from first row
        const workoutType = rows[0].workout_type || 'Workout';

        // 4. Display in chat with progression info
        const summary = rows
          .map((ex) => `• ${ex.exercise}: ${ex.sets}x${ex.reps} (${ex.exercise_type})`)
          .join('\n');

        setChatMessages(prev => [
          ...prev,
          {
            sender: 'assistant',
            text: `You last completed Nike workout #${lastWorkout}. Here's #${nextWorkout}: ${workoutType}\n\n${summary}`,
            timestamp: new Date().toLocaleTimeString()
          },
        ]);

        // Set workout data for the table
        const nikeWorkout: NikeWorkout = {
          exercises: rows as NikeExercise[],
          workoutNumber: nextWorkout
        };
        setWorkoutData(nikeWorkout);

      } catch (err) {
        console.error('Error loading Nike workout:', err);
        setChatMessages(prev => [
          ...prev,
          { sender: 'assistant', text: "Sorry, there was an error loading your Nike workout.", timestamp: new Date().toLocaleTimeString() },
        ]);
      }
      return;
    }

    // 3. Handle exercise guidance: "How should I perform Romanian Deadlift?"
    if (lower.startsWith('how should i perform') || lower.startsWith('how do i do')) {
      const exerciseName = message.split('perform ')[1] || message.split('do ')[1];

      if (!exerciseName) {
        setChatMessages(prev => [
          ...prev,
          { sender: 'assistant', text: "Can you tell me the exercise you're asking about?", timestamp: new Date().toLocaleTimeString() },
        ]);
        return;
      }

      const { data } = await supabase
        .from('exercise')
        .select('instruction_text')
        .ilike('name', `%${exerciseName.trim()}%`)
        .limit(1);

      if (data && data[0]?.instruction_text) {
        setChatMessages(prev => [
          ...prev,
          { sender: 'assistant', text: data[0].instruction_text, timestamp: new Date().toLocaleTimeString() },
        ]);
      } else {
        // fallback
        setChatMessages(prev => [
          ...prev,
          {
            sender: 'assistant',
            text: `I couldn't find that in the database, but generally: maintain good form, start light, and control the movement. Let me know the exact name if you want more detail.`,
            timestamp: new Date().toLocaleTimeString()
          },
        ]);
      }
      return;
    }

    // 4. Handle day-of-week workout requests
    const dayMatch = lower.match(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/);
    if (dayMatch && user?.id) {
      const day = dayMatch[1];
      await buildDayWorkout(day, user.id, timeAvailable);
      return;
    }

    // 5. Default fallback
    setChatMessages(prev => [
      ...prev,
      { sender: 'assistant', text: "I'm still learning. Try asking me for your Nike workout, a day of the week, or how to perform an exercise.", timestamp: new Date().toLocaleTimeString() },
    ]);
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



        {/* Integrated Chat Container */}
        <div className="bg-[#1E293B] rounded-xl shadow-md mb-4">
          <div className="p-3 border-b border-[#334155]">
            <h3 className="text-sm font-semibold text-white">AI Workout Coach</h3>
          </div>
          
          <div className="chat-wrapper max-h-[300px] flex flex-col">
            <div className="chat-history flex-1 overflow-y-auto p-3" ref={chatHistoryRef}>
              {chatMessages.length === 0 ? (
                <div className="text-center text-gray-400 py-4">
                  <p className="text-sm">Ask your coach anything...</p>
                  <p className="text-xs mt-1">Try: &quot;I only have 30 minutes&quot; or &quot;Nike&quot;</p>
                </div>
              ) : (
                <div className="space-y-2">
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

            <div className="p-3 border-t border-[#334155] flex-shrink-0">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && inputText.trim()) {
                    const message = inputText.trim();
                    setInputText('');
                    handleChatMessage(message);
                  }
                }}
                placeholder="Ask your coach anything..."
                className="w-full bg-[#0F172A] border border-[#334155] rounded-lg p-2 text-sm text-white focus:border-[#22C55E] focus:outline-none disabled:opacity-50"
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
            elapsedTime={elapsedTime}
          />
        )}
      </section>


    </div>
  );
} 