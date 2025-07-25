'use client'

import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'

// Type declarations for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any
    webkitSpeechRecognition: any
  }
}

interface WorkoutRow {
  id: string
  exercise: string
  sets: string
  reps: string
  weight: string
  rest: string
}

interface WorkoutData {
  warmup: string[]
  workout: string[]
  cooldown: string[]
  prompt?: string
}

export default function WorkoutBuilderPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [prompt, setPrompt] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [workoutData, setWorkoutData] = useState<WorkoutData | null>(null)
  const [tableRows, setTableRows] = useState<WorkoutRow[]>([])
  const [minutes, setMinutes] = useState(30)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Speech recognition state
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')

  // Redirect if not authenticated
  useEffect(() => {
    if (!user) {
      router.push('/login')
    }
  }, [user, router])

  // Handle speech recognition
  const startListening = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      setIsListening(true)
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      const recognition = new SpeechRecognition()
      
      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = 'en-US'
      
      recognition.onstart = () => {
        setIsListening(true)
      }
      
      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0])
          .map((result: any) => result.transcript)
          .join('')
        setTranscript(transcript)
        setPrompt(transcript) // Replace instead of append for better UX
      }
      
      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error)
        setIsListening(false)
      }
      
      recognition.onend = () => {
        setIsListening(false)
      }
      
      recognition.start()
    } else {
      alert('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari over HTTPS.')
    }
  }

  // Reset transcript
  const resetTranscript = () => {
    setTranscript('')
    setPrompt('')
  }

  // Parse workout string to row object
  const parseWorkoutString = (workoutString: string): WorkoutRow => {
    const id = Math.random().toString(36).substr(2, 9)
    
    // Try to parse structured format like "Exercise: 3x8 @ 100lb rest 90s"
    const match = workoutString.match(/^(.+?):\s*(\d+)x(\d+)\s*@\s*(\d+lb)\s*rest\s*(\d+s)/i)
    if (match) {
      return {
        id,
        exercise: match[1].trim(),
        sets: match[2],
        reps: match[3],
        weight: match[4],
        rest: match[5]
      }
    }
    
    // Fallback: just put the whole string in exercise
    return {
      id,
      exercise: workoutString,
      sets: '',
      reps: '',
      weight: '',
      rest: ''
    }
  }

  // Update table row
  const updateTableRow = (id: string, field: keyof WorkoutRow, value: string) => {
    setTableRows(prev => prev.map(row => 
      row.id === id ? { ...row, [field]: value } : row
    ))
  }

  // Add new row
  const addRow = () => {
    const newRow: WorkoutRow = {
      id: Math.random().toString(36).substr(2, 9),
      exercise: '',
      sets: '',
      reps: '',
      weight: '',
      rest: ''
    }
    setTableRows(prev => [...prev, newRow])
  }

  // Remove row
  const removeRow = (id: string) => {
    setTableRows(prev => prev.filter(row => row.id !== id))
  }

  // Generate workout
  const generateWorkout = async () => {
    if (!user?.id) return
    
    setIsLoading(true)
    setError('')
    
    try {
      const finalPrompt = transcript || prompt
      if (!finalPrompt.trim()) {
        throw new Error('Please enter a prompt or use voice input')
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
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate workout')
      }

      setWorkoutData(data)
      
      // Parse workout data into table rows
      const workoutRows = data.workout.map(parseWorkoutString)
      setTableRows(workoutRows)
      
    } catch (err) {
      console.error('Workout generation error:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate workout')
    } finally {
      setIsLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0F172A] p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-2">Workout Builder</h1>
          <p className="text-gray-400">Create personalized workouts with AI assistance</p>
        </div>

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
              placeholder="Describe your workout goals, available equipment, or specific exercises you want to include..."
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
                AI is thinking...
              </span>
            ) : (
              'Submit'
            )}
          </button>
        </div>

        {/* Workout Table */}
        <div className="bg-[#1E293B] rounded-xl p-6 shadow-md overflow-hidden">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-white">Workout Plan</h2>
            <button
              onClick={addRow}
              className="bg-[#22C55E] px-4 py-2 rounded-lg text-white font-medium hover:bg-[#16a34a] transition-colors"
            >
              + Add Exercise
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#334155]">
                  <th className="text-left p-3 text-white font-medium">Exercise</th>
                  <th className="text-left p-3 text-white font-medium">Sets</th>
                  <th className="text-left p-3 text-white font-medium">Reps</th>
                  <th className="text-left p-3 text-white font-medium">Weight</th>
                  <th className="text-left p-3 text-white font-medium">Rest</th>
                  <th className="text-left p-3 text-white font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row) => (
                  <tr key={row.id} className="border-b border-[#334155]/50">
                    <td className="p-3">
                      <input
                        type="text"
                        value={row.exercise}
                        onChange={(e) => updateTableRow(row.id, 'exercise', e.target.value)}
                        className="w-full bg-[#0F172A] border border-[#334155] px-3 py-2 rounded text-white focus:border-[#22C55E] focus:outline-none"
                        placeholder="Exercise name"
                      />
                    </td>
                    <td className="p-3">
                      <input
                        type="text"
                        value={row.sets}
                        onChange={(e) => updateTableRow(row.id, 'sets', e.target.value)}
                        className="w-full bg-[#0F172A] border border-[#334155] px-3 py-2 rounded text-white focus:border-[#22C55E] focus:outline-none"
                        placeholder="3"
                      />
                    </td>
                    <td className="p-3">
                      <input
                        type="text"
                        value={row.reps}
                        onChange={(e) => updateTableRow(row.id, 'reps', e.target.value)}
                        className="w-full bg-[#0F172A] border border-[#334155] px-3 py-2 rounded text-white focus:border-[#22C55E] focus:outline-none"
                        placeholder="8"
                      />
                    </td>
                    <td className="p-3">
                      <input
                        type="text"
                        value={row.weight}
                        onChange={(e) => updateTableRow(row.id, 'weight', e.target.value)}
                        className="w-full bg-[#0F172A] border border-[#334155] px-3 py-2 rounded text-white focus:border-[#22C55E] focus:outline-none"
                        placeholder="100lb"
                      />
                    </td>
                    <td className="p-3">
                      <input
                        type="text"
                        value={row.rest}
                        onChange={(e) => updateTableRow(row.id, 'rest', e.target.value)}
                        className="w-full bg-[#0F172A] border border-[#334155] px-3 py-2 rounded text-white focus:border-[#22C55E] focus:outline-none"
                        placeholder="90s"
                      />
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => removeRow(row.id)}
                        className="text-red-400 hover:text-red-300 transition-colors"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {tableRows.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              No exercises yet. Generate a workout or add exercises manually.
            </div>
          )}
        </div>

        {/* Generated Workout Display */}
        {workoutData && (
          <div className="bg-[#1E293B] rounded-xl p-6 shadow-md space-y-4">
            <h3 className="text-lg font-semibold text-white">Generated Workout</h3>
            
            {workoutData.prompt && (
              <div className="bg-[#0F172A] p-4 rounded-lg">
                <h4 className="text-sm font-medium text-gray-400 mb-2">AI Prompt Used:</h4>
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
          </div>
        )}
      </div>
    </div>
  )
} 