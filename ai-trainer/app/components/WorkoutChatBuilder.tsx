'use client'
/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { WorkoutTimer } from './WorkoutTimer'
import { WorkoutExerciseCard, LogSet } from './WorkoutExerciseCard'

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

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface WorkoutExercise {
  exercise: string
  sets: number
  reps: number
  weight: number
  rest: number
}

interface WorkoutSet extends LogSet {
  exerciseName: string
  setNumber: number
}

interface UserContext {
  name: string
  goals: string[]
  currentWeight: string
  equipment: string[]
  recentWorkouts: string[]
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function WorkoutChatBuilder({ userId }: { userId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [editableWorkout, setEditableWorkout] = useState<WorkoutExercise[]>([])
  const [workoutSets, setWorkoutSets] = useState<WorkoutSet[]>([])
  const [workoutTimer, setWorkoutTimer] = useState(0)
  const [isWorkoutActive, setIsWorkoutActive] = useState(false)
  const [dbg, setDbg] = useState<string>('')

  // Convert exercises to sets when editableWorkout changes
  useEffect(() => {
    const newSets: WorkoutSet[] = [];
    editableWorkout.forEach(exercise => {
      for (let i = 1; i <= exercise.sets; i++) {
        // Determine rest time based on exercise type
        const isStrengthExercise = exercise.exercise.toLowerCase().includes('squat') || 
                                  exercise.exercise.toLowerCase().includes('deadlift') || 
                                  exercise.exercise.toLowerCase().includes('bench') || 
                                  exercise.exercise.toLowerCase().includes('press') ||
                                  exercise.exercise.toLowerCase().includes('row') ||
                                  exercise.exercise.toLowerCase().includes('pull');
        
        const defaultRest = isStrengthExercise ? 180 : 90; // 3 min for strength, 1.5 min for accessory
        
        newSets.push({
          exerciseName: exercise.exercise,
          setNumber: i,
          setNumberLabel: i <= 2 ? 'W' : i.toString(),
          previousWeight: undefined,
          prescribedWeight: exercise.weight,
          actualWeight: undefined,
          reps: exercise.reps,
          restSeconds: exercise.rest || defaultRest,
          rpe: 7,
          done: false
        });
      }
    });
    setWorkoutSets(newSets);
  }, [editableWorkout]);
  const chatContainerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    chatContainerRef.current?.scrollTo({
      top: chatContainerRef.current.scrollHeight,
      behavior: 'smooth'
    });
  }, [messages]);

  // Workout timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isWorkoutActive) {
      interval = setInterval(() => {
        setWorkoutTimer(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isWorkoutActive]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startWorkout = () => {
    setIsWorkoutActive(true);
    setWorkoutTimer(0);
  };

  const finishWorkout = () => {
    setIsWorkoutActive(false);
    // Here you could save the workout data
  };

  // Fetch user context on mount
  useEffect(() => {
    const fetchUserContext = async () => {
      try {
        const [
          { data: profile }, 
          { data: equipment }, 
          { data: goals }, 
          { data: logs },
          { data: weightLogs }
        ] = await Promise.all([
          supabase.from('profiles').select('*').eq('user_id', userId).single(),
          supabase.from('user_equipment').select('equipment_id, custom_name').eq('user_id', userId),
          supabase.from('goals').select('goal_type').eq('user_id', userId),
          supabase.from('workouts').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(5),
          supabase.from('weight_logs').select('weight').eq('user_id', userId).order('created_at', { ascending: false }).limit(1)
        ])



        const context: UserContext = {
          name: profile?.first_name || 'Unknown',
          goals: goals?.map(g => g.goal_type) || [],
          currentWeight: weightLogs?.[0]?.weight?.toString() || 'Not logged',
          equipment: equipment?.map(e => e.custom_name || e.equipment_id) || [],
          recentWorkouts: logs?.map(w => `${new Date(w.created_at).toLocaleDateString()} - ${w.workout_title || 'Workout'}`) || []
        }

        // Initialize with system message
        const systemMessage: ChatMessage = {
          role: 'system',
          content: `You are TrainAI, an AI fitness coach. 

User context: ${context.goals.length > 0 ? `Goals: ${context.goals.join(', ')}. ` : ''}${context.equipment.length > 0 ? `Equipment: ${context.equipment.join(', ')}. ` : ''}${context.currentWeight !== 'Not logged' ? `Current weight: ${context.currentWeight} lbs. ` : ''}

Have a natural conversation about workouts. Only generate a workout plan when specifically requested.`
        }

        setMessages([systemMessage])
      } catch (error) {
        console.error('Error fetching user context:', error)
      }
    }

    fetchUserContext()
  }, [userId])



  // Speech recognition functionality
  const startListening = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      setIsListening(true)
      const SpeechRecognitionCtor: new () => SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      const recognition = new SpeechRecognitionCtor()

      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = 'en-US'

      recognition.onstart = () => setIsListening(true)

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = Array.from(event.results)
          .map((result: SpeechRecognitionResult) => result[0])
          .map((alt: SpeechRecognitionAlternative) => alt.transcript)
          .join('')
        setTranscript(transcript)
        setInput(transcript)
      }

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error)
        setIsListening(false)
      }

      recognition.onend = () => setIsListening(false)

      recognition.start()
    } else {
      alert('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari over HTTPS.')
    }
  }

  const resetTranscript = () => {
    setTranscript('')
    setInput('')
  }

  async function sendMessage(content: string) {
    if (!content.trim()) return

    const newMsg: ChatMessage = { role: 'user', content }
    const updated = [...messages, newMsg]
    setMessages(updated)
    setInput('')
    resetTranscript()
    setIsLoading(true)

    try {
      console.log('DBG: starting workout request');
      
      const res = await fetch('/api/workoutChat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, messages: updated })
      })

      let data: any = null;
      try {
        data = await res.json();
      } catch (e) {
        console.error('DBG: failed to parse JSON', e);
      }
      console.log('DEBUG WORKOUT CHAT BUILDER', { ok: res.ok, status: res.status, data });
      
      // Set debug data to display in UI
      setDbg(JSON.stringify(data, null, 2));
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send message')
      }

      // Add assistant message to chat
      setMessages(msgs => [...msgs, { 
        role: 'assistant', 
        content: data.assistantMessage 
      }])

      // Set editable workout
      if (data.plan) {
        setEditableWorkout(data.plan.workout || [])
      }
    } catch (error) {
      console.error('Chat error:', error)
      setMessages(msgs => [...msgs, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again.' 
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const addExercise = () => {
    const newExercise: WorkoutExercise = {
      exercise: '',
      sets: 0,
      reps: 0,
      weight: 0,
      rest: 0
    }
    setEditableWorkout([...editableWorkout, newExercise])
  }

  const updateExercise = (index: number, field: keyof WorkoutExercise, value: string | number) => {
    const updated = [...editableWorkout]
    updated[index] = { ...updated[index], [field]: value }
    setEditableWorkout(updated)
  }

  const removeExercise = (index: number) => {
    setEditableWorkout(editableWorkout.filter((_, i) => i !== index))
  }

  const updateSet = (originalSet: WorkoutSet, changes: Partial<WorkoutSet>) => {
    setWorkoutSets(prev => prev.map(set => 
      set.exerciseName === originalSet.exerciseName && set.setNumber === originalSet.setNumber
        ? { ...set, ...changes }
        : set
    ));
  };

  // Group sets by exercise name
  const groupedSets = workoutSets.reduce((acc, set) => {
    (acc[set.exerciseName] ||= []).push(set);
    return acc;
  }, {} as Record<string, WorkoutSet[]>);

  return (
    <div className="pt-4 pb-6 px-4 max-w-lg mx-auto min-h-screen bg-black text-white">
      {/* Header Section */}
      <div className="bg-black p-4">
        <div className="flex justify-between items-center mb-4">
          <button className="p-2 rounded-full bg-gray-800 hover:bg-gray-700 transition-colors">
            <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          {isWorkoutActive && (
            <button
              onClick={finishWorkout}
              className="bg-[#22C55E] px-6 py-2 rounded-lg text-white font-medium hover:bg-[#16a34a] transition-colors"
            >
              Finish
            </button>
          )}
        </div>
        
        {/* Date */}
        <div className="text-center mb-4">
          <div className="flex items-center justify-center gap-2 text-gray-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>
        </div>
      </div>

      {/* Chat Section - Collapsible */}
      {!isWorkoutActive && (
        <div className="bg-[#1E293B] p-4">
          <div 
            ref={chatContainerRef}
            className="h-[300px] overflow-y-auto space-y-2 p-4 bg-[#1E293B] rounded-xl border border-[#334155]"
          >
            {messages.length === 0 && (
              <div className="text-gray-400 text-center py-8">
                Loading your profile...
              </div>
            )}
            {messages.length === 1 && messages[0].role === 'system' && (
              <div className="text-center py-4">
                <p className="text-white mb-4">Tell me what you want to do today:</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  <button
                    onClick={() => sendMessage('I want a strength workout')}
                    className="bg-[#22C55E] px-4 py-2 rounded-lg text-white hover:bg-[#16a34a] transition-colors"
                  >
                    💪 Strength
                  </button>
                  <button
                    onClick={() => sendMessage('I want a HIIT workout')}
                    className="bg-[#22C55E] px-4 py-2 rounded-lg text-white hover:bg-[#16a34a] transition-colors"
                  >
                    🔥 HIIT
                  </button>
                  <button
                    onClick={() => sendMessage('I want an endurance workout')}
                    className="bg-[#22C55E] px-4 py-2 rounded-lg text-white hover:bg-[#16a34a] transition-colors"
                  >
                    🏃 Endurance
                  </button>
                  <button
                    onClick={() => sendMessage('I want a general fitness workout')}
                    className="bg-[#22C55E] px-4 py-2 rounded-lg text-white hover:bg-[#16a34a] transition-colors"
                  >
                    🎯 General Fitness
                  </button>
                </div>
              </div>
            )}
            {messages.filter(m => m.role !== 'system').map((m, i) => (
              <div key={i} className={`mb-3 ${m.role === 'user' ? 'text-right' : 'text-left'}`}>
                <span className={`inline-block p-3 rounded-lg max-w-xs break-words ${
                  m.role === 'user' 
                    ? 'bg-[#22C55E] text-white' 
                    : 'bg-[#334155] text-white'
                }`}>
                  {m.content}
                </span>
              </div>
            ))}
            {isLoading && (
              <div className="text-left mb-3">
                <span className="inline-block p-3 rounded-lg bg-[#334155] text-white">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    AI is thinking...
                  </div>
                </span>
              </div>
            )}
          </div>

          {/* Input area */}
          <div className="flex gap-2 mt-4">
            <textarea
              value={input || transcript}
              onChange={e => setInput(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input || transcript)}
              className="flex-1 bg-[#0F172A] border border-[#334155] p-3 rounded-lg text-white resize-none"
              placeholder="Type or speak your workout needs..."
              rows={2}
            />
            <div className="flex flex-col gap-2">
              <button
                onClick={startListening}
                disabled={isListening}
                className={`p-3 bg-[#22C55E] rounded-lg text-white hover:bg-[#16a34a] disabled:opacity-50 transition-colors ${
                  isListening ? 'animate-pulse' : ''
                }`}
                title="Voice input"
              >
                🎤
              </button>
              <button
                onClick={() => sendMessage(input || transcript)}
                disabled={isLoading || (!input.trim() && !transcript)}
                className="bg-[#22C55E] px-4 py-3 rounded-lg text-white hover:bg-[#16a34a] disabled:opacity-50 transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}



      {/* Workout Timer */}
      {isWorkoutActive && <WorkoutTimer />}

      {/* Workout Logging Section */}
      {workoutSets.length > 0 && (
        <div className="space-y-4">
          {Object.entries(groupedSets).map(([exerciseName, sets]) => (
            <WorkoutExerciseCard
              key={exerciseName}
              exerciseName={exerciseName}
              sets={sets as LogSet[]}
              updateSet={(s, changes) => updateSet(s as WorkoutSet, changes)}
            />
          ))}
        </div>
      )}

      {/* Start Workout Button */}
      {workoutSets.length > 0 && !isWorkoutActive && (
        <div className="p-4">
          <button
            onClick={startWorkout}
            className="w-full bg-[#22C55E] py-4 rounded-lg text-white font-medium hover:bg-[#16a34a] transition-colors text-lg"
          >
            Start Workout
          </button>
        </div>
      )}

      {/* Debug Panel */}
      {dbg && (
        <div className="p-4 mt-4">
          <h3 className="text-white font-semibold mb-2">Debug Response:</h3>
          <pre style={{whiteSpace:'pre-wrap', fontSize:12, background:'#111', color:'#0f0', padding:8, borderRadius:8}}>
            {dbg}
          </pre>
        </div>
      )}
    </div>
  )
} 