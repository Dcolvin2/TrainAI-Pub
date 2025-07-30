'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

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

interface WorkoutSet {
  exerciseName: string
  setNumber: number
  setNumberLabel: string
  previousWeight?: number
  prescribedWeight: number
  actualWeight?: number
  reps: number
  restSeconds: number
  rpe: number
  done: boolean
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function ClaudeChatPanel({ userId }: { userId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [editableWorkout, setEditableWorkout] = useState<WorkoutExercise[]>([])
  const [workoutSets, setWorkoutSets] = useState<WorkoutSet[]>([])
  const [isWorkoutActive, setIsWorkoutActive] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Convert exercises to sets when editableWorkout changes
  useEffect(() => {
    const newSets: WorkoutSet[] = [];
    editableWorkout.forEach(exercise => {
      for (let i = 1; i <= exercise.sets; i++) {
        const isStrengthExercise = exercise.exercise.toLowerCase().includes('squat') || 
                                  exercise.exercise.toLowerCase().includes('deadlift') || 
                                  exercise.exercise.toLowerCase().includes('bench') || 
                                  exercise.exercise.toLowerCase().includes('press') ||
                                  exercise.exercise.toLowerCase().includes('row') ||
                                  exercise.exercise.toLowerCase().includes('pull');
        
        const defaultRest = isStrengthExercise ? 180 : 90;
        
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
      const res = await fetch('/api/claude-workout-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, messages: updated })
      })

      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send message')
      }

      // Add assistant message to chat
      setMessages(msgs => [...msgs, { 
        role: 'assistant', 
        content: data.assistantMessage 
      }])

      // Set editable workout if provided
      if (data.plan) {
        setEditableWorkout(data.plan.workout || [])
      }
    } catch (error) {
      console.error('Claude chat error:', error)
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
    setWorkoutSets(sets => 
      sets.map(set => 
        set === originalSet ? { ...set, ...changes } : set
      )
    )
  }

  const startWorkout = () => {
    setIsWorkoutActive(true)
  }

  const finishWorkout = async () => {
    try {
      // Save workout session
      const { data: session } = await supabase
        .from('workout_sessions')
        .insert({
          user_id: userId,
          workout_type: 'Claude Generated',
          duration_minutes: Math.floor(Date.now() / 1000 / 60), // Rough estimate
          notes: 'Workout completed via Claude chat'
        })
        .select()
        .single()

      if (session) {
        // Save workout sets
        const setsToSave = workoutSets.map(set => ({
          workout_session_id: session.id,
          exercise_name: set.exerciseName,
          set_number: set.setNumber,
          weight: set.actualWeight || set.prescribedWeight,
          reps: set.reps,
          rpe: set.rpe,
          rest_seconds: set.restSeconds
        }))

        await supabase
          .from('workout_sets')
          .insert(setsToSave)

        setMessages(msgs => [...msgs, { 
          role: 'assistant', 
          content: 'Great job completing your workout! Your progress has been saved.' 
        }])
      }
    } catch (error) {
      console.error('Error saving workout:', error)
    }

    setIsWorkoutActive(false)
    setWorkoutSets([])
    setEditableWorkout([])
  }

  const groupedSets = workoutSets.reduce((acc, set) => {
    if (!acc[set.exerciseName]) {
      acc[set.exerciseName] = []
    }
    acc[set.exerciseName].push(set)
    return acc
  }, {} as Record<string, WorkoutSet[]>)

  return (
    <div className="space-y-6">
      {/* Chat Interface */}
      <div className="bg-[#1E293B] rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">Claude AI Trainer</h2>
          <div className="flex gap-2">
            <button
              onClick={addExercise}
              className="px-3 py-1 bg-[#22C55E] text-white rounded text-sm hover:bg-[#16a34a] transition-colors"
            >
              Add Exercise
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="h-96 overflow-y-auto mb-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-center text-gray-400 py-8">
              <p>👋 Hi! I'm Claude, your AI fitness trainer.</p>
              <p className="mt-2">Ask me to create a workout, explain exercises, or help with your fitness goals!</p>
            </div>
          )}
          
          {messages.filter(m => m.role !== 'system').map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs lg:max-w-md p-3 rounded-lg ${
                m.role === 'user' 
                  ? 'bg-[#22C55E] text-white' 
                  : 'bg-[#334155] text-white'
              }`}>
                <div className="whitespace-pre-wrap">{m.content}</div>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-[#334155] text-white p-3 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Claude is thinking...
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="flex gap-2">
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

      {/* Workout Sets Display */}
      {workoutSets.length > 0 && (
        <div className="bg-[#1E293B] rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Workout Plan</h3>
            <div className="flex gap-2">
              <button
                onClick={startWorkout}
                disabled={isWorkoutActive}
                className="px-4 py-2 bg-[#22C55E] text-white rounded hover:bg-[#16a34a] disabled:opacity-50 transition-colors"
              >
                Start Workout
              </button>
              {isWorkoutActive && (
                <button
                  onClick={finishWorkout}
                  className="px-4 py-2 bg-[#EF4444] text-white rounded hover:bg-[#DC2626] transition-colors"
                >
                  Finish Workout
                </button>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {Object.entries(groupedSets).map(([exerciseName, sets]) => (
              <div key={exerciseName} className="bg-[#0F172A] rounded-lg p-4">
                <h4 className="text-white font-medium mb-3">{exerciseName}</h4>
                <div className="grid grid-cols-6 gap-2 text-sm text-gray-300 mb-2">
                  <div>Set</div>
                  <div>Weight</div>
                  <div>Reps</div>
                  <div>RPE</div>
                  <div>Rest</div>
                  <div>Done</div>
                </div>
                {sets.map((set, index) => (
                  <div key={index} className="grid grid-cols-6 gap-2 items-center py-2 border-b border-gray-700">
                    <div className="text-white">{set.setNumberLabel}</div>
                    <input
                      type="number"
                      value={set.actualWeight || set.prescribedWeight}
                      onChange={e => updateSet(set, { actualWeight: Number(e.target.value) })}
                      className="bg-[#1E293B] text-white px-2 py-1 rounded text-sm"
                    />
                    <div className="text-white">{set.reps}</div>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={set.rpe}
                      onChange={e => updateSet(set, { rpe: Number(e.target.value) })}
                      className="bg-[#1E293B] text-white px-2 py-1 rounded text-sm"
                    />
                    <div className="text-white">{set.restSeconds}s</div>
                    <input
                      type="checkbox"
                      checked={set.done}
                      onChange={e => updateSet(set, { done: e.target.checked })}
                      className="w-4 h-4"
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Editable Workout Builder */}
      {editableWorkout.length > 0 && (
        <div className="bg-[#1E293B] rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Edit Workout</h3>
          <div className="space-y-3">
            {editableWorkout.map((exercise, index) => (
              <div key={index} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={exercise.exercise}
                  onChange={e => updateExercise(index, 'exercise', e.target.value)}
                  placeholder="Exercise name"
                  className="flex-1 bg-[#0F172A] border border-[#334155] p-2 rounded text-white"
                />
                <input
                  type="number"
                  value={exercise.sets}
                  onChange={e => updateExercise(index, 'sets', Number(e.target.value))}
                  placeholder="Sets"
                  className="w-16 bg-[#0F172A] border border-[#334155] p-2 rounded text-white"
                />
                <input
                  type="number"
                  value={exercise.reps}
                  onChange={e => updateExercise(index, 'reps', Number(e.target.value))}
                  placeholder="Reps"
                  className="w-16 bg-[#0F172A] border border-[#334155] p-2 rounded text-white"
                />
                <input
                  type="number"
                  value={exercise.weight}
                  onChange={e => updateExercise(index, 'weight', Number(e.target.value))}
                  placeholder="Weight"
                  className="w-20 bg-[#0F172A] border border-[#334155] p-2 rounded text-white"
                />
                <input
                  type="number"
                  value={exercise.rest}
                  onChange={e => updateExercise(index, 'rest', Number(e.target.value))}
                  placeholder="Rest"
                  className="w-16 bg-[#0F172A] border border-[#334155] p-2 rounded text-white"
                />
                <button
                  onClick={() => removeExercise(index)}
                  className="px-3 py-2 bg-[#EF4444] text-white rounded hover:bg-[#DC2626] transition-colors"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
} 