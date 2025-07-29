'use client'
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import WorkoutTable from '../components/WorkoutTable';
import ChatBubble from '../components/ChatBubble';
import { supabase } from '@/lib/supabaseClient';
import { useWorkoutStore, WorkoutProvider } from '@/lib/workoutStore';
import { fetchNikeWorkout } from '@/lib/nikeWorkoutHelper';
import { buildWorkoutByDay } from "@/lib/buildWorkoutByDay";
import { getExerciseInstructions } from '@/lib/getExerciseInstructions';
import { fetchInstructions } from '@/lib/fetchInstructions';
import { isQuickEntry, parseQuickEntry } from '@/utils/parseQuickEntry';
import { quickEntryHandler } from '@/lib/quickEntryHandler';
import { getInstructionRequest } from '@/utils/detectInstructionRequest';
import { getExerciseInstruction } from '@/lib/getExerciseInstruction';





interface WorkoutData {
  planId: string;
  warmup: string[];
  workout: string[];
  cooldown: string[];
  accessories?: string[];
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

interface PreviousSetData {
  weight: number;
  reps: number;
}

interface PreviousExerciseData {
  [setNumber: number]: PreviousSetData;
}

interface EnrichedNikeExercise extends NikeExercise {
  previousSets?: PreviousExerciseData;
}

// Simple Timer Component - Counts UP from 0
function WorkoutTimer({ elapsedTime, running, onToggle, className = '' }: { 
  elapsedTime: number; 
  running: boolean; 
  onToggle: () => void;
  className?: string;
}): React.JSX.Element {
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



function TodaysWorkoutPageContent() {
  const { user } = useAuth();
  const router = useRouter();
  
  // Timer state - counts UP from 0
  const [elapsedTime, setElapsedTime] = useState(0); // seconds
  const [mainTimerRunning, setMainTimerRunning] = useState(false);

  // Workout store
  const {
    active: activeWorkout,
    pending: pendingWorkout,
    timeAvailable,
    lastInit,
    setActive: setActiveWorkout,
    setPending: setPendingWorkout,
    setTimeAvailable,
    reset: resetWorkout,
    setQuickEntrySets,
    quickEntrySets,
    clearQuickEntrySets,
    addOrUpdateSet,
    addLocalSet,
    setFirstPostWarmupExercise
  } = useWorkoutStore();

  const [chatMessages, setChatMessages] = useState<Array<{sender: 'user' | 'assistant', text: string, timestamp?: string}>>([]);
  const [showPrevious, setShowPrevious] = useState(false);
  const [inputText, setInputText] = useState('');
  const chatHistoryRef = useRef<HTMLDivElement>(null);

  // ── CHAT MEMORY & PLAN STATE ──
  const [messages, setMessages] = useState<{role:'user'|'assistant',content:string}[]>([]);
  const [currentPlan, setCurrentPlan] = useState<any[]>([]);

  // ── HELPER FUNCTIONS ──
  function shortenPlan(plan: any[], minutes: number): any[] {
    const coreLift = plan.find((p: any) => p.is_main_lift);
    const warmups = plan.filter((p: any) => p.exercise_phase === 'warmup');
    const cooldown = plan.filter((p: any) => p.exercise_phase === 'cooldown');
    const accessories = plan.filter(
      (p: any) => !p.is_main_lift && p.exercise_phase === 'main'
    );

    const slots = Math.max(0, Math.floor((minutes - 10) / 5));
    return [
      ...warmups.slice(0, 2),
      coreLift,
      ...accessories.slice(0, slots),
      ...cooldown.slice(0, 1),
    ].filter(Boolean) as any[];
  }

  function formatPlanChat(plan: any[], minutes: number): string {
    const warmups = plan.filter((p: any) => p.exercise_phase === 'warmup');
    const coreLift = plan.find((p: any) => p.is_main_lift);
    const accessories = plan.filter((p: any) => !p.is_main_lift && p.exercise_phase === 'main');
    const cooldown = plan.filter((p: any) => p.exercise_phase === 'cooldown');

    return `**${minutes}-Minute Workout**\n\n` +
           `*Warm-up*: ${warmups.map((w: any) => w.name || w.exercise).join(", ") || "—"}\n` +
           (coreLift ? `*Core Lift*: ${coreLift.name || coreLift.exercise}\n` : "") +
           `*Accessories*: ${accessories.map((a: any) => a.name || a.exercise).join(", ") || "—"}\n` +
           `*Cooldown*: ${cooldown.map((c: any) => c.name || c.exercise).join(", ") || "—"}`;
  }


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
    if (activeWorkout && !mainTimerRunning) {
      setMainTimerRunning(true);
    }
  }, [activeWorkout, mainTimerRunning]);

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
      const { data, error } = await fetchNikeWorkout(1);

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
          
          // Explicitly pick phases for proper warm-up/cool-down recognition
          const warmups = data.filter(r => r.exercise_phase === 'warmup');
          const cooldowns = data.filter(r => r.exercise_phase === 'cooldown');
          const mains = data.filter(r => r.exercise_phase === 'main');
          
          // Convert NikeWorkout to WorkoutData format for the store
          const workoutData: WorkoutData = {
            planId: crypto.randomUUID(),
            warmup: warmups.map(ex => `${ex.exercise}: ${ex.sets}x${ex.reps}`),
            workout: mains.map(ex => `${ex.exercise}: ${ex.sets}x${ex.reps}`),
            cooldown: cooldowns.map(ex => `${ex.exercise}: ${ex.sets}x${ex.reps}`),
            prompt: `Nike Workout ${nikeWorkout.workoutNumber}`
          };
          setPendingWorkout(workoutData);
        }
      }
    };

    loadNikeWorkout();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll chat to bottom when new messages are added
  useEffect(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Auto-reset on day change
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    if (lastInit !== today) {
      resetWorkout();
    }
  }, [lastInit, resetWorkout]);

  // Clear state on auth change
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        resetWorkout();
        setShowPrevious(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [resetWorkout]);

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

    const { data: rows } = await fetchNikeWorkout(workoutNo);

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

    // Explicitly pick phases for proper warm-up/cool-down recognition
    const warmups = rows.filter(r => r.exercise_phase === 'warmup');
    const cooldowns = rows.filter(r => r.exercise_phase === 'cooldown');
    const mains = rows.filter(r => r.exercise_phase === 'main');

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
    
    // Convert NikeWorkout to WorkoutData format for the store
    const workoutData: WorkoutData = {
      planId: crypto.randomUUID(),
      warmup: warmups.map(ex => `${ex.exercise}: ${ex.sets}x${ex.reps}`),
      workout: mains.map(ex => `${ex.exercise}: ${ex.sets}x${ex.reps}`),
      cooldown: cooldowns.map(ex => `${ex.exercise}: ${ex.sets}x${ex.reps}`),
      prompt: `Nike Workout ${nikeWorkout.workoutNumber}`
    };
    setPendingWorkout(workoutData);
  };

  const handleChatMessage = async (message: string) => {
    // ── TRACE STEP 1: Input logging ──
    console.log('[TRACE] input raw:', message);
    
    // ── TRACE STEP 2: Normalized input ──
    const input = (message ?? '').trim().toLowerCase();
    console.log('[TRACE] input:', input);
    
    // ── TRACE STEP 3: Early debug exit ──
    if (input === '/debug') {
      console.log('[TRACE] matched /debug early-exit');
      setChatMessages(prev => [
        ...prev,
        { sender: 'assistant', text: 'Model: gpt-4o-mini', timestamp: new Date().toLocaleTimeString() },
      ]);
      return;
    }

    // ── CLEAR STALE PLAN WHEN USER EXPLICITLY ASKS FOR NEW WORKOUT ──
    if (/generate workout/i.test(input) ||
        /(it's|its)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i.test(input) ||
        /nike\s*\d*/i.test(input)) {
      setPendingWorkout(null);  // clear table immediately
    }

    const lower = message.toLowerCase();

    // 1. Append user message to chat history
    setChatMessages(prev => [...prev, { sender: 'user', text: message, timestamp: new Date().toLocaleTimeString() }]);
    
    // ── UPDATE CHAT MEMORY ──
    setMessages(prev => [...prev, { role: 'user', content: message }]);

    // ── 3️⃣ HANDLE "I ONLY HAVE X MINUTES" LOCALLY ──
    if (/(\d+)\s*minutes?/i.test(message) && currentPlan.length) {
      const mins = parseInt(RegExp.$1, 10);
      const newPlan = shortenPlan(currentPlan, mins);
      setCurrentPlan(newPlan);
      
      const formattedResponse = formatPlanChat(newPlan, mins);
      setChatMessages(prev => [
        ...prev,
        { sender: 'assistant', text: formattedResponse, timestamp: new Date().toLocaleTimeString() },
      ]);
      setMessages(prev => [...prev, { role: 'assistant', content: formattedResponse }]);
      return; // skip OpenAI
    }

    // ── 1️⃣ DAY-OF-WEEK FIRST ──
    console.log('[TRACE] hit day-of-week branch');
    const dayMatch = lower.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
    if (dayMatch && user?.id) {
      console.log('[TRACE] matched day route:', dayMatch[1]);
      const day = dayMatch[1][0].toUpperCase() + dayMatch[1].slice(1).toLowerCase();

      // look for explicit minutes: "i have 25 minutes"
      const minMatch = message.match(/(\d{2})\s*minutes?/i);
      const minutes = minMatch ? parseInt(minMatch[1], 10) : timeAvailable;

      try {
        const plan = await buildWorkoutByDay(user.id, day, minutes);
        
        // Convert to WorkoutData format for the table
        const workoutData: WorkoutData = {
          planId: crypto.randomUUID(),
          warmup: plan.warmupArr.map(ex => `${ex.name}: 1x5`),
          workout: plan.coreLift ? [`${plan.coreLift.name}: 3x8`] : [],
          cooldown: plan.cooldownArr.map(ex => `${ex.name}: 1x5`),
          accessories: plan.accessories.map(a => `${a.name}: 3x10`),
          prompt: `${day} Workout (${minutes} min)`
        };
        
        setPendingWorkout(workoutData);
        
        const workoutText = 
          `**${day} Workout (${minutes} min)**\n\n` +
          `*Warm-up*: ${plan.warmupArr.map(ex => ex.name).join(", ") || "—"}\n` +
          (plan.coreLift ? `*Core Lift*: ${plan.coreLift.name}\n` : "") +
          `*Accessories*: ${plan.accessories.map(a => a.name).join(", ") || "—"}\n` +
          `*Cooldown*: ${plan.cooldownArr.map(ex => ex.name).join(", ") || "—"}`;

        setChatMessages(prev => [
          ...prev,
          { sender: 'assistant', text: workoutText, timestamp: new Date().toLocaleTimeString() },
        ]);
        
        // ── STORE CURRENT PLAN ──
        const planRows = [
          ...plan.warmupArr.map(ex => ({ ...ex, exercise_phase: 'warmup' })),
          ...(plan.coreLift ? [{ ...plan.coreLift, exercise_phase: 'main', is_main_lift: true }] : []),
          ...plan.accessories.map(ex => ({ ...ex, exercise_phase: 'main' })),
          ...plan.cooldownArr.map(ex => ({ ...ex, exercise_phase: 'cooldown' }))
        ];
        setCurrentPlan(planRows);
        setMessages(prev => [...prev, { role: 'assistant', content: workoutText }]);
        
        return;
      } catch (error) {
        console.error('Day workout generation error:', error);
        setChatMessages(prev => [
          ...prev,
          { sender: 'assistant', text: `Sorry, I couldn't generate a ${day} workout. Please try again.`, timestamp: new Date().toLocaleTimeString() },
        ]);
        return;
      }
    }

    // ── 2️⃣ NIKE SECOND ──
    console.log('[TRACE] hit Nike branch');
    if (lower.includes('nike')) {
      console.log('[TRACE] matched Nike branch');
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

    // ── 3️⃣ QUICK-ENTRY SETS THIRD ──
    console.log('[TRACE] hit quick-entry sets branch');
    if (isQuickEntry(input)) {
      console.log('[TRACE] matched quick-entry sets:', input);
      
      const setEntries = parseQuickEntry(input);

      if (setEntries.length > 0) {
        // Find the first post-warm-up exercise
        const firstMainExercise = currentPlan.find(ex => ex.exercise_phase === 'main');
        
        if (firstMainExercise) {
          // Set the first post-warmup exercise for future quick entries
          setFirstPostWarmupExercise(firstMainExercise.name);
          
          // Create helper function to add chat messages
          const addChatMessage = (message: { id: string; role: 'assistant'; content: string; createdAt: string }) => {
            setChatMessages(prev => [
              ...prev,
              { sender: 'assistant', text: message.content, timestamp: new Date().toLocaleTimeString() },
            ]);
            setMessages(prev => [...prev, { role: 'assistant', content: message.content }]);
          };
          
          // Use the new quick entry handler with chat confirmation
          quickEntryHandler(setEntries, firstMainExercise.name, addLocalSet, addChatMessage);
          
          return;
        }
      }
    }

    // ── 4️⃣ INSTRUCTION LOOK-UP FOURTH ──
    console.log('[TRACE] hit instruction look-up branch');
    const instrReq = getInstructionRequest(message);
    if (instrReq) {
      console.log('[TRACE] matched instruction request:', instrReq.exercise);
      const instruction = await getExerciseInstruction(instrReq.exercise);
      
      const response = instruction
        ? `**${instrReq.exercise} – How to**\n\n${instruction}`
        : `Sorry, I couldn't find instructions for **${instrReq.exercise}** in the database.`;

      setChatMessages(prev => [
        ...prev,
        { sender: 'assistant', text: response, timestamp: new Date().toLocaleTimeString() },
      ]);
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
      return;                      // stop further routing
    }

    // ── 6️⃣ REGENERATE WORKOUT SIXTH ──
    if (/regenerate workout/i.test(input)) {
      console.log('[TRACE] matched regenerate workout');
      // clear current state first
      setPendingWorkout(null);
      setActiveWorkout(null);
      setCurrentPlan([]);
      
      // reuse today's weekday
      const dayNames = ["sunday","monday","tuesday","wednesday",
                        "thursday","friday","saturday"];
      const today = dayNames[new Date().getDay()];
      handleChatMessage(`it's ${today}`);       // triggers day-of-week builder
      return;
    }

    // ── 7️⃣ CATCH-ALL GPT LAST ──
    try {
      console.log('[TRACE] catch-all GPT route fires');
      const coachReply = await fetch('/api/workoutChat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id || 'anonymous',
          messages: [
            { role: 'system', content: 'You are a concise fitness coach. Reply in ≤120 words.' },
            ...messages.slice(-10),  // ── KEEP CHAT MEMORY ──
            { role: 'user', content: message }
          ]
        })
      });

      if (coachReply.ok) {
        const data = await coachReply.json();
        console.log('[TRACE] coach reply OK');
        setChatMessages(prev => [
          ...prev,
          { sender: 'assistant', text: data.assistantMessage, timestamp: new Date().toLocaleTimeString() },
        ]);
        
        // ── UPDATE CHAT MEMORY ──
        setMessages(prev => [...prev, { role: 'assistant', content: data.assistantMessage }]);
        
        // ── ALWAYS EXPECT FUNCTION CALL (forced updateWorkout) ──
        if (data.plan) {
          console.log('[TRACE] workout data received:', data.plan);
          const updatedWorkout: WorkoutData = {
            planId: crypto.randomUUID(),  // ← fresh planId forces re-render
            warmup: data.plan.warmup || [],
            workout: data.plan.workout || [],
            cooldown: data.plan.cooldown || [],
            accessories: (data.plan as any).accessories || [],
            prompt: data.plan.prompt || 'Updated workout'
          };
          setPendingWorkout(updatedWorkout);
          
          // ── UPDATE CURRENT PLAN STATE ──
          const planRows = [
            ...(data.plan.warmup || []).map((ex: string) => ({ name: ex, exercise_phase: 'warmup' })),
            ...(data.plan.workout || []).map((ex: string) => ({ name: ex, exercise_phase: 'main', is_main_lift: true })),
            ...(data.plan.accessories || []).map((ex: string) => ({ name: ex, exercise_phase: 'main' })),
            ...(data.plan.cooldown || []).map((ex: string) => ({ name: ex, exercise_phase: 'cooldown' }))
          ];
          setCurrentPlan(planRows);
        }
        
        return;                                  // stop; no fallback
      }
    } catch (err) {
      console.error('[TRACE] OpenAI error ↓↓↓', err); // log full error
      setChatMessages(prev => [
        ...prev,
        { sender: 'assistant', text: '⚠️ OpenAI error — see console for details', timestamp: new Date().toLocaleTimeString() },
      ]);
      return;                                  // still stop fallback
    }
    // ─────────────────────────────────────────────────────────────
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

      {/* Regenerate Workout Button */}
      <section className="mb-4">
        <button
          onClick={() => {
            // clear current state first
            setPendingWorkout(null);
            setActiveWorkout(null);
            setCurrentPlan([]);
            
            // reuse today's weekday
            const dayNames = ["sunday","monday","tuesday","wednesday",
                              "thursday","friday","saturday"];
            const today = dayNames[new Date().getDay()];
            handleChatMessage(`it's ${today}`);       // triggers day-of-week builder
          }}
          className="w-full bg-[#22C55E] hover:bg-[#16a34a] text-white px-6 py-3 rounded-xl font-semibold transition-colors"
        >
          Regenerate Workout
        </button>
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
          <>
            <WorkoutTable 
              key={(activeWorkout as any)?.planId || 'no-plan'}  // ← use planId for guaranteed refresh
              workout={activeWorkout!} 
              onFinishWorkout={() => {
                setActiveWorkout(null);
                setShowPrevious(false);
                clearQuickEntrySets(); // Clear quick entry sets after workout is finished
              }}
              onStopTimer={() => {
                setMainTimerRunning(false);
              }}
              elapsedTime={elapsedTime}
              showPrevious={showPrevious}
              quickEntrySets={quickEntrySets}
            />
            <button
              onClick={resetWorkout}
              className="mt-4 bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-2 rounded-xl font-semibold transition-colors"
            >
              Reset Workout
            </button>
          </>
        )}
      </section>


    </div>
  );
} 

export default function TodaysWorkoutPage() {
  return (
    <WorkoutProvider>
      <TodaysWorkoutPageContent />
    </WorkoutProvider>
  );
} 