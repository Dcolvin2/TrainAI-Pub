'use client'
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import WorkoutTable from '../components/WorkoutTable';
import ChatBubble from '../components/ChatBubble';
import TimeSelector from '../components/TimeSelector';
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

// DEV ONLY: Smoke test helper
if (typeof window !== 'undefined') {
  (window as any).__showPlan = async (day = 'Monday') => {
    const plan = await buildWorkoutByDay('test-user', day, 45);
    console.table([
      ['Target (min)', day, plan.estimatedMinutes?.toFixed(1) || 'N/A'],
      ...plan.accessories.map(a => ['accessory', a.name])
    ]);
    return plan;
  };
  console.info('👋  call  __showPlan("Monday")  in DevTools');
}

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

// Compact Timer Component - MM:SS format
function CompactTimer({ elapsedTime, running, className = '' }: { 
  elapsedTime: number; 
  running: boolean; 
  className?: string;
}): React.JSX.Element {
  const mm = String(Math.floor(elapsedTime / 60)).padStart(2, '0');
  const ss = String(elapsedTime % 60).padStart(2, '0');

  return (
    <div className={`text-sm font-mono text-white ${className}`} style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
      {running ? `${mm}:${ss}` : '00:00'}
    </div>
  );
}

function TodaysWorkoutPageContent() {
  const { user } = useAuth();
  const router = useRouter();
  
  // Timer state - counts UP from 0
  const [elapsedTime, setElapsedTime] = useState(0);
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

  // Debug timeAvailable changes
  useEffect(() => {
    console.log('TodaysWorkoutPage: timeAvailable changed to', timeAvailable);
  }, [timeAvailable]);

  // Handle time updates from TimeSelector
  const handleTimeUpdate = (newTime: number) => {
    console.log('Workout time updated to:', newTime);
    setTimeAvailable(newTime);
  };

  // ── HELPER FUNCTIONS ──
  function shortenPlan(plan: any[], minutes: number): any[] {
    const coreLift = plan.find((p: any) => p.exercise_phase === 'core_lift');
    const warmups = plan.filter((p: any) => p.exercise_phase === 'warmup');
    const cooldown = plan.filter((p: any) => p.exercise_phase === 'cooldown');
    const accessories = plan.filter(
      (p: any) => p.exercise_phase === 'accessory'
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
    const coreLift = plan.find((p: any) => p.exercise_phase === 'core_lift');
    const accessories = plan.filter((p: any) => p.exercise_phase === 'accessory');
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

  // Auto-generate workout on page load
  useEffect(() => {
    if (user?.id && !pendingWorkout && !activeWorkout) {
      const dayNames = ["sunday","monday","tuesday","wednesday",
                        "thursday","friday","saturday"];
      const today = dayNames[new Date().getDay()];
      
      // Auto-generate today's workout
      buildWorkoutByDay(user.id, today, timeAvailable).then(plan => {
        const workoutData: WorkoutData = {
          planId: crypto.randomUUID(),
          warmup: plan.warmupArr.map(ex => `${ex.name}: 1x5`),
          workout: plan.coreLift ? [`${plan.coreLift.name}: 3x8`] : [],
          cooldown: plan.cooldownArr.map(ex => `${ex.name}: 1x5`),
          accessories: plan.accessories.map(a => `${a.name}: 3x10`),
          prompt: `${today} Workout (${timeAvailable} min)`
        };
        
        setPendingWorkout(workoutData);
        
        // Store current plan for chat interactions
        const planRows = [
          ...plan.warmupArr.map(ex => ({ ...ex, exercise_phase: 'warmup' })),
          ...(plan.coreLift ? [{ ...plan.coreLift, exercise_phase: 'core_lift' }] : []),
          ...plan.accessories.map(ex => ({ ...ex, exercise_phase: 'accessory' })),
          ...plan.cooldownArr.map(ex => ({ ...ex, exercise_phase: 'cooldown' }))
        ];
        setCurrentPlan(planRows);
      }).catch(error => {
        console.error('Auto-workout generation error:', error);
      });
    }
  }, [user?.id, pendingWorkout, activeWorkout, timeAvailable, setPendingWorkout]);

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

    // ── INSTRUCTION LOOKUP (EARLY RETURN) ──
    const maybe = await getExerciseInstruction(message);
    if (maybe) {
      console.log('[TRACE] instruction found, early return');
      const response = `**Exercise Instructions**\n\n${maybe}`;
      setChatMessages(prev => [
        ...prev,
        { sender: 'assistant', text: response, timestamp: new Date().toLocaleTimeString() },
      ]);
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
      return;                      // early return stops other branches
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

    // ── TIME ADJUSTMENT VIA CHAT ──
    const timeMatch = message.match(/(?:i have|only|just)\s+(\d+)\s*minutes?/i);
    if (timeMatch) {
      const newTime = parseInt(timeMatch[1], 10);
      if (newTime >= 5 && newTime <= 120) {
        console.log('Chat: Setting timeAvailable to', newTime);
        setTimeAvailable(newTime);
        setChatMessages(prev => [
          ...prev,
          { sender: 'assistant', text: `Got it! Adjusting workout for ${newTime} minutes.`, timestamp: new Date().toLocaleTimeString() },
        ]);
        return; // Don't regenerate workout unless explicitly requested
      }
    }

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
          ...(plan.coreLift ? [{ ...plan.coreLift, exercise_phase: 'core_lift' }] : []),
          ...plan.accessories.map(ex => ({ ...ex, exercise_phase: 'accessory' })),
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
            ...(data.plan.workout || []).map((ex: string) => ({ name: ex, exercise_phase: 'core_lift' })),
            ...(data.plan.accessories || []).map((ex: string) => ({ name: ex, exercise_phase: 'accessory' })),
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
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center w-full max-w-full overflow-x-hidden" style={{ width: '100%', maxWidth: '100vw', overflowX: 'hidden', boxSizing: 'border-box' }}>
        <div className="text-center px-4" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
          <div className="text-white text-xl mb-4">Please log in to access your workout</div>
          <button
            onClick={() => router.push('/login')}
            className="bg-[#22C55E] px-6 py-3 rounded-xl text-white font-semibold hover:bg-[#16a34a] transition-colors"
            style={{ maxWidth: '100%', boxSizing: 'border-box' }}
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden bg-[#0F172A] min-h-screen workout-container" style={{ width: '100%', maxWidth: '100vw', overflowX: 'hidden', boxSizing: 'border-box' }}>
      <div className="p-4 max-w-md mx-auto" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
        {/* Header with Title and Timer */}
        <header className="flex justify-between items-center mb-4" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
          <h1 className="text-2xl font-bold text-white" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>Today's Workout</h1>
          <CompactTimer 
            elapsedTime={elapsedTime}
            running={mainTimerRunning} 
          />
        </header>

        {/* Chat Interface - Prominent with Fixed Height */}
        <section className="mb-4" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
          <div className="bg-[#1E293B] rounded-xl shadow-md" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
            <div className="p-3 border-b border-[#334155]" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
              <h3 className="text-sm font-semibold text-white" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>AI Workout Coach</h3>
            </div>
            
            <div className="flex flex-col h-[200px]" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
              <div 
                className="flex-1 overflow-y-auto p-3" 
                ref={chatHistoryRef}
                style={{ 
                  maxHeight: '200px', 
                  maxWidth: '100%', 
                  boxSizing: 'border-box',
                  wordWrap: 'break-word',
                  overflowWrap: 'break-word'
                }}
              >
                {chatMessages.length === 0 ? (
                  <div className="text-center text-gray-400 py-4" style={{ 
                    maxWidth: '100%', 
                    boxSizing: 'border-box',
                    wordWrap: 'break-word',
                    overflowWrap: 'break-word'
                  }}>
                    <p className="text-sm">Ask your coach anything...</p>
                    <p className="text-xs mt-1">Try: "I have 30 minutes" or "Nike"</p>
                  </div>
                ) : (
                  <div className="space-y-2" style={{ 
                    maxWidth: '100%', 
                    boxSizing: 'border-box',
                    wordWrap: 'break-word',
                    overflowWrap: 'break-word'
                  }}>
                    {chatMessages.map((message, index) => (
                      <div key={index} style={{
                        maxWidth: '100%',
                        boxSizing: 'border-box',
                        wordWrap: 'break-word',
                        overflowWrap: 'break-word',
                        whiteSpace: 'pre-wrap'
                      }}>
                        <ChatBubble 
                          sender={message.sender} 
                          message={message.text}
                          timestamp={message.timestamp}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-3 border-t border-[#334155] flex-shrink-0" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
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
                  style={{ maxWidth: '100%', boxSizing: 'border-box' }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Time Selector - Using new TimeSelector component */}
        <section className="mb-4" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
          <TimeSelector onTimeChange={handleTimeUpdate} />
        </section>

        {/* Regenerate Workout Button */}
        <section className="mb-4" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
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
            style={{ maxWidth: '100%', boxSizing: 'border-box' }}
          >
            Regenerate Workout
          </button>
        </section>

        {/* Workout Table Section */}
        <section className="mb-6" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
          {!pendingWorkout && !activeWorkout ? (
            <div className="text-center text-gray-400 py-8" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
              <p className="mb-4">Loading today's workout...</p>
              <div className="animate-pulse">
                <div className="h-4 bg-gray-600 rounded mb-2" style={{ maxWidth: '100%', boxSizing: 'border-box' }}></div>
                <div className="h-4 bg-gray-600 rounded mb-2" style={{ maxWidth: '100%', boxSizing: 'border-box' }}></div>
                <div className="h-4 bg-gray-600 rounded" style={{ maxWidth: '100%', boxSizing: 'border-box' }}></div>
              </div>
            </div>
          ) : pendingWorkout && !activeWorkout ? (
            <div className="text-center py-8" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
              <div className="bg-[#1E293B] rounded-xl p-6 mb-4" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
                <h3 className="text-xl font-semibold text-white mb-4">Workout Ready!</h3>
                <p className="text-gray-300 mb-6">Your workout has been generated and is ready to start.</p>
                <button
                  onClick={() => {
                    setActiveWorkout(pendingWorkout);
                    setPendingWorkout(null);
                    setShowPrevious(true);
                  }}
                  className="bg-[#22C55E] hover:bg-[#16a34a] text-white px-8 py-3 rounded-xl font-semibold transition-colors"
                  style={{ maxWidth: '100%', boxSizing: 'border-box' }}
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
            </>
          )}
        </section>
      </div>
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