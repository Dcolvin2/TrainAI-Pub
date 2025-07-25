'use client'
/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState, useEffect } from 'react'
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
      const res = await fetch('/api/workoutChat', {
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

  return (
    <div className="space-y-6">
      {/* Chat window */}
      <div className="bg-[#1E293B] p-4 rounded-xl shadow h-64 overflow-auto">
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

      {/* Workout Table */}
      {editableWorkout.length > 0 && (
        <div className="bg-[#1E293B] rounded-xl overflow-hidden shadow-md">
          <div className="p-4 border-b border-[#334155] flex justify-between items-center">
            <h3 className="text-lg font-semibold text-white">Your Workout Plan</h3>
            <button
              onClick={addExercise}
              className="bg-[#22C55E] px-3 py-1 rounded text-white text-sm hover:bg-[#16a34a] transition-colors"
            >
              + Add Exercise
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#0F172A]">
                <tr>
                  <th className="p-3 text-left text-white font-medium">Exercise</th>
                  <th className="p-3 text-left text-white font-medium">Sets</th>
                  <th className="p-3 text-left text-white font-medium">Reps</th>
                  <th className="p-3 text-left text-white font-medium">Weight</th>
                  <th className="p-3 text-left text-white font-medium">Rest (s)</th>
                  <th className="p-3 text-left text-white font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {editableWorkout.map((item, i) => (
                  <tr key={i} className="border-b border-[#334155]/50">
                    <td className="p-3">
                      <input 
                        value={item.exercise}
                        onChange={(e) => updateExercise(i, 'exercise', e.target.value)}
                        className="w-full bg-[#0F172A] border border-[#334155] px-2 py-1 rounded text-white"
                        placeholder="Exercise name"
                      />
                    </td>
                    <td className="p-3">
                      <input 
                        type="number"
                        value={item.sets}
                        onChange={(e) => updateExercise(i, 'sets', parseInt(e.target.value) || 0)}
                        className="w-16 bg-[#0F172A] border border-[#334155] px-2 py-1 rounded text-white text-center"
                      />
                    </td>
                    <td className="p-3">
                      <input 
                        type="number"
                        value={item.reps}
                        onChange={(e) => updateExercise(i, 'reps', parseInt(e.target.value) || 0)}
                        className="w-16 bg-[#0F172A] border border-[#334155] px-2 py-1 rounded text-white text-center"
                      />
                    </td>
                    <td className="p-3">
                      <input 
                        type="number"
                        value={item.weight}
                        onChange={(e) => updateExercise(i, 'weight', parseInt(e.target.value) || 0)}
                        className="w-16 bg-[#0F172A] border border-[#334155] px-2 py-1 rounded text-white text-center"
                      />
                    </td>
                    <td className="p-3">
                      <input 
                        type="number"
                        value={item.rest}
                        onChange={(e) => updateExercise(i, 'rest', parseInt(e.target.value) || 0)}
                        className="w-16 bg-[#0F172A] border border-[#334155] px-2 py-1 rounded text-white text-center"
                      />
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => removeExercise(i)}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
} 