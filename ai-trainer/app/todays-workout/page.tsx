'use client'
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import WorkoutTable from '../components/WorkoutTable';
import ChatBubble from '../components/ChatBubble';
import { supabase } from '@/lib/supabaseClient';
import { dayCoreLifts } from '../constants/dayCoreLifts';





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

interface Exercise {
  name: string;
  primary_muscle: string;
  is_main_lift: boolean;
  exercise_phase?: string;
  equipment_required?: string[];
  [key: string]: unknown;
}

interface PreviousSetData {
  weight: number;
  reps: number;
}

interface PreviousExerciseData {
  [setNumber: number]: PreviousSetData;
}

interface PreviousWorkoutData {
  [exerciseName: string]: PreviousExerciseData;
}

interface EnrichedNikeExercise extends NikeExercise {
  previousSets?: PreviousExerciseData;
}

interface EnrichedWorkoutData extends WorkoutData {
  previousData?: PreviousWorkoutData;
}

interface BaseExercise {
  id: number;
  name: string;
  primary_muscle: string;
  exercise_phase: string;
  instruction?: string;
}

interface MobilityDrill extends BaseExercise {
  source: 'nike' | 'exercises';
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
  const [pendingWorkout, setPendingWorkout] = useState<WorkoutData | NikeWorkout | null>(null);
  const [activeWorkout, setActiveWorkout] = useState<WorkoutData | NikeWorkout | null>(null);
  const [showPrevious, setShowPrevious] = useState(false);
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

  // Clear state on auth change
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setActiveWorkout(null);
        setPendingWorkout(null);
        setShowPrevious(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Helper to fetch previous sets data from most recent workout
  const fetchPrevSets = async (userId: string, exerciseNames: string[]) => {
    try {
      // Get the most recent workout session before today
      const today = new Date().toISOString().split('T')[0];
      const { data: recentSession } = await supabase
        .from('workout_sessions')
        .select('id, date')
        .eq('user_id', userId)
        .lt('date', today)
        .order('date', { ascending: false })
        .limit(1)
        .single();

      if (!recentSession) {
        return {};
      }

      // Get sets from that session
      const { data: prevSets } = await supabase
        .from('workout_log_entries')
        .select('exercise_name, set_number, weight, reps')
        .eq('session_id', recentSession.id)
        .in('exercise_name', exerciseNames);

      // Group by exercise name and set number
      const prevMap: Record<string, Record<number, { weight: number; reps: number }>> = {};
      prevSets?.forEach(set => {
        if (!prevMap[set.exercise_name]) {
          prevMap[set.exercise_name] = {};
        }
        prevMap[set.exercise_name][set.set_number] = {
          weight: set.weight,
          reps: set.reps
        };
      });

      return prevMap;
    } catch (error) {
      console.error('Error fetching previous sets:', error);
      return {};
    }
  };

  // NEW helper - Parse explicit Nike workout number
  const parseNikeRequest = (msg: string) => {
    const m = msg.match(/nike(?:\s+workout)?\s*[#]?(\d+)/i);
    return m ? parseInt(m[1], 10) : null;
  };

  // Enhanced Nike workout handler
  const handleNike = async (message: string, userId: string) => {
    const explicit = parseNikeRequest(message);
    let workoutNo: number;

    if (!explicit) {
      const { data: p } = await supabase
        .from('profiles')
        .select('last_nike_workout')
        .eq('id', userId)
        .single();
      workoutNo = (p?.last_nike_workout ?? 0) + 1;
    } else {
      workoutNo = explicit;
    }

    const { data: rows } = await supabase
      .from('nike_workouts')
      .select('workout, workout_type, sets, reps, exercise, instructions, exercise_type')
      .eq('workout', workoutNo);

    if (!rows?.length) {
      setChatMessages(prev => [
        ...prev,
        { sender: 'assistant', text: `I couldn't find Nike workout ${workoutNo}.`, timestamp: new Date().toLocaleTimeString() },
      ]);
      return;
    }

    if (!explicit) {
      await supabase
        .from('profiles')
        .update({ last_nike_workout: workoutNo })
        .eq('id', userId);
    }

    // Build chat reply
    const heading = explicit
      ? `Here's Nike workout ${workoutNo} as requested:`
      : `You're on the next one—Nike #${workoutNo}:`;

    const summary = rows
      .map(r => `• ${r.exercise} (${r.sets}x${r.reps})`)
      .join('\n');

    setChatMessages(prev => [
      ...prev,
      { sender: 'assistant', text: `${heading}\n${summary}`, timestamp: new Date().toLocaleTimeString() },
    ]);

    // Set workout data for the table
    const nikeWorkout: NikeWorkout = {
      exercises: rows as NikeExercise[],
      workoutNumber: workoutNo
    };
    
    // Fetch previous sets data and enrich the workout
    if (user?.id) {
      const exerciseNames = rows.map(row => row.exercise);
      const prevMap = await fetchPrevSets(user.id, exerciseNames);
      
      // Enrich the workout with previous data
      nikeWorkout.exercises.forEach(exercise => {
        const prevData = prevMap[exercise.exercise];
        if (prevData) {
          // Add previous data to the exercise (this will be used by WorkoutTable)
          (exercise as EnrichedNikeExercise).previousSets = prevData;
        }
      });
    }
    
    setPendingWorkout(nikeWorkout);
  };

  // Build day-of-week workout using new day configuration
  const buildDayWorkout = async (day: string, userId: string, minutes: number = 45) => {
    try {
      // Get day configuration
      const dayNumber = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.
      const dayCfg = dayCoreLifts[dayNumber];
      
      console.log('DAY asked for:', day, 'Day number:', dayNumber, 'Config:', dayCfg);

      if (!dayCfg) {
        setChatMessages(prev => [
          ...prev,
          { sender: 'assistant', text: `I don't have a workout pattern configured for ${day}.`, timestamp: new Date().toLocaleTimeString() },
        ]);
        return;
      }

      // Handle HIIT pattern (Thursday)
      if (dayCfg.pattern === 'hiit') {
        setChatMessages(prev => [
          ...prev,
          { sender: 'assistant', text: `Thursday is HIIT day! I'll build you a ${minutes}-minute circuit workout.`, timestamp: new Date().toLocaleTimeString() },
        ]);
        return;
      }

      // Handle cardio pattern (Wed, Fri, Sun)
      if (dayCfg.pattern === 'cardio') {
        setChatMessages(prev => [
          ...prev,
          { sender: 'assistant', text: `${day} is cardio day! I'll build you a ${minutes}-minute cardio session.`, timestamp: new Date().toLocaleTimeString() },
        ]);
        return;
      }

      // Handle strength pattern with core lift
      if (dayCfg.pattern === 'strength' && dayCfg.coreLift) {
        const coreLiftName = dayCfg.coreLift;

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

        // Continue with existing logic for strength workouts
        /* 3️⃣  get user equipment */
        const { data: profile } = await supabase
          .from('profiles')
          .select('equipment')
          .eq('id', userId)
          .single();

        const gear = profile?.equipment ?? [];

        /* 4️⃣  pull warm-up exercises from unified view */
        const { data: warmupExercises } = await supabase
          .from('vw_mobility_warmups')
          .select('*')
          .ilike('primary_muscle', `%${coreLift.primary_muscle}%`)
          .eq('exercise_phase', 'warmup');

        // Fallback to full body if not enough warm-ups found
        let finalWarmups = warmupExercises || [];
        if (finalWarmups.length < 2) {
          const { data: fallbackWarmups } = await supabase
            .from('vw_mobility_warmups')
            .select('*')
            .eq('primary_muscle', 'full_body')
            .eq('exercise_phase', 'warmup');
          finalWarmups = fallbackWarmups || [];
        }

        /* 5️⃣  pull matching accessories
               – same primary_muscle group
               – NOT main lifts
               – equipment_required ⊆ user gear (or empty)         */
        const { data: accessories } = await supabase
          .from('exercises')
          .select('*')
          .eq('is_main_lift', false)
          .eq('primary_muscle', coreLift.primary_muscle);

        /* 6️⃣  pull cool-down exercises from unified view */
        const { data: cooldownExercises } = await supabase
          .from('vw_mobility_warmups')
          .select('*')
          .ilike('primary_muscle', `%${coreLift.primary_muscle}%`)
          .eq('exercise_phase', 'cooldown');

        // Fallback to full body if not enough cool-downs found
        let finalCooldowns = cooldownExercises || [];
        if (finalCooldowns.length < 2) {
          const { data: fallbackCooldowns } = await supabase
            .from('vw_mobility_warmups')
            .select('*')
            .eq('primary_muscle', 'full_body')
            .eq('exercise_phase', 'cooldown');
          finalCooldowns = fallbackCooldowns || [];
        }

        // Filter accessories by equipment availability
        let filteredAccessories = accessories || [];
        if (gear.length > 0) {
          filteredAccessories = filteredAccessories.filter((acc: Exercise) => 
            !acc.equipment_required || 
            acc.equipment_required.length === 0 ||
            acc.equipment_required.some((req: string) => gear.includes(req))
          );
        }

        /* 7️⃣  time-box: assume 5 min warm-up + 10 min core lift + 5 min per accessory + 5 min cool-down */
        const warmupSlots = Math.min(2, finalWarmups.length);
        const accessorySlots = Math.max(0, Math.floor((minutes - 20) / 5)); // 20 = 5 warmup + 10 core + 5 cooldown
        const cooldownSlots = Math.min(2, finalCooldowns.length);

        const chosenWarmup = finalWarmups.sort(() => 0.5 - Math.random()).slice(0, warmupSlots);
        const chosenAccessories = filteredAccessories.sort(() => 0.5 - Math.random()).slice(0, accessorySlots);
        const chosenCooldown = finalCooldowns.sort(() => 0.5 - Math.random()).slice(0, cooldownSlots);

        /* 8️⃣  save to workouts / workout_log_entries */
        await supabase.from('workouts').insert({
          user_id: userId,
          program_name: 'DayOfWeek',
          workout_type: `${coreLiftName} – ${coreLift.primary_muscle}`,
          core_lift_id: coreLift.id, // Include core lift ID for strength workouts
          duration_minutes: minutes,
          main_lifts: JSON.stringify([coreLift.name]),
          accessory_lifts: JSON.stringify(chosenAccessories.map((c: Exercise) => c.name)),
          created_at: new Date().toISOString()
        });

        /* 9️⃣  return chat summary */
        let reply = `**${coreLiftName} Workout (${minutes} min)**\n`;
        if (chosenWarmup.length > 0) {
          reply += `**Warm-up:**\n`;
          chosenWarmup.forEach((a: MobilityDrill) => reply += `• ${a.name}\n`);
        }
        reply += `**Core lift:** ${coreLift.name}\n`;
        if (chosenAccessories.length > 0) {
          reply += `**Accessories:**\n`;
          chosenAccessories.forEach((a: Exercise) => reply += `• ${a.name}\n`);
        }
        if (chosenCooldown.length > 0) {
          reply += `**Cool-down:**\n`;
          chosenCooldown.forEach((a: MobilityDrill) => reply += `• ${a.name}\n`);
        }

        setChatMessages(prev => [
          ...prev,
          { sender: 'assistant', text: reply, timestamp: new Date().toLocaleTimeString() },
        ]);

        // Convert to workout data format for the table
        const workoutData: WorkoutData = {
          warmup: chosenWarmup.map((ex: MobilityDrill) => `${ex.name}: 1x5`),
          workout: [coreLift.name, ...chosenAccessories.map((ex: Exercise) => ex.name)].map(name => `${name}: ${name === coreLift.name ? '4x8' : '3x12'}`),
          cooldown: chosenCooldown.map((ex: MobilityDrill) => `${ex.name}: 1x5`),
          prompt: `${coreLiftName} Day-of-Week Workout`
        };

        // Fetch previous sets data and enrich the workout
        if (user?.id) {
          const exerciseNames = [
            ...chosenWarmup.map((ex: MobilityDrill) => ex.name),
            coreLift.name,
            ...chosenAccessories.map((ex: Exercise) => ex.name),
            ...chosenCooldown.map((ex: MobilityDrill) => ex.name)
          ];
          const prevMap = await fetchPrevSets(user.id, exerciseNames);
          
          // Enrich the workout data with previous information
          // This will be used by WorkoutTable to populate previous columns
          (workoutData as EnrichedWorkoutData).previousData = prevMap;
        }
        
        setPendingWorkout(workoutData);
        return;
      }

      // Fallback for unsupported patterns
      setChatMessages(prev => [
        ...prev,
        { sender: 'assistant', text: `No workout pattern available for ${day}.`, timestamp: new Date().toLocaleTimeString() },
      ]);
    } catch (error) {
      console.error('Error building day workout:', error);
      setChatMessages(prev => [
        ...prev,
        { sender: 'assistant', text: 'Sorry, I encountered an error building your workout.', timestamp: new Date().toLocaleTimeString() },
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

      await handleNike(message, user.id);
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
        {!pendingWorkout && !activeWorkout ? (
          <div className="text-center text-gray-400 py-8">
            <p className="mb-4">No workout found for today.</p>
            <p className="text-sm">Use the AI builder above to create your first workout!</p>
          </div>
        ) : pendingWorkout && !activeWorkout ? (
          <div className="text-center py-8">
            <div className="bg-[#1E293B] rounded-xl p-6 mb-4">
              <h3 className="text-xl font-semibold text-white mb-4">Workout Ready!</h3>
              <p className="text-gray-300 mb-6">Your workout has been generated and is ready to start.</p>
              <button
                onClick={() => {
                  setActiveWorkout(pendingWorkout);
                  setPendingWorkout(null);
                  setShowPrevious(true);
                }}
                className="bg-[#22C55E] hover:bg-[#16a34a] text-white px-8 py-3 rounded-xl font-semibold transition-colors"
              >
                Start Workout
              </button>
            </div>
          </div>
        ) : (
          <WorkoutTable 
            workout={activeWorkout!} 
            onFinishWorkout={() => {
              setActiveWorkout(null);
              setShowPrevious(false);
            }}
            onStopTimer={() => {
              setMainTimerRunning(false);
            }}
            elapsedTime={elapsedTime}
            showPrevious={showPrevious}
          />
        )}
      </section>


    </div>
  );
} 