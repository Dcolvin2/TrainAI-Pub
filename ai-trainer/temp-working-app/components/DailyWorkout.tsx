'use client'
import { useState } from 'react'

interface WorkoutData {
  warmup: string[]
  workout: string[]
  cooldown: string[]
  accessories?: string[]
  prompt?: string
}

export function DailyWorkout({ userId }: { userId: string }) {
  const [minutes, setMinutes] = useState(30)
  const [data, setData] = useState<WorkoutData | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [error, setError] = useState<string>('')

  const generateWorkout = async () => {
    setIsValidating(true)
    setError('')
    
    try {
      const response = await fetch(`/api/generateWorkout?userId=${userId}&minutes=${minutes}`)
      
      // Check if response is JSON
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        console.error('Non-JSON response:', text)
        throw new Error('Server returned an error page instead of JSON data')
      }
      
      const workoutData = await response.json()
      
      if (!response.ok) {
        throw new Error(workoutData.error || workoutData.details || 'Failed to generate workout')
      }
      
      setData(workoutData)
    } catch (err) {
      console.error('Workout generation error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate workout. Please try again.'
      setError(errorMessage)
    } finally {
      setIsValidating(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <label className="text-sm text-white">Time Available:</label>
        <input
          type="number" 
          min={5} 
          max={120}
          value={minutes}
          onChange={e => setMinutes(Number(e.target.value))}
          className="w-16 bg-[#0F172A] border border-[#334155] px-2 py-1 rounded-lg text-white"
        />
        <span className="text-sm text-gray-400">minutes</span>
      </div>

      <button
        onClick={generateWorkout}
        disabled={isValidating}
        className="bg-[#22C55E] px-5 py-3 rounded-xl text-white font-semibold hover:bg-[#16a34a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isValidating ? 'Generating…' : 'Generate Today\'s Workout'}
      </button>

      {error && (
        <p className="text-red-400 text-sm">{error}</p>
      )}

      {data && (
        <div className="space-y-4">
          {/* Prompt Display */}
          {data.prompt && (
            <div className="bg-[#1E293B] p-4 rounded-2xl">
              <h3 className="text-lg font-semibold text-white mb-3">ChatGPT Prompt Used:</h3>
              <textarea
                value={data.prompt}
                readOnly
                className="w-full h-32 bg-[#0F172A] border border-[#334155] rounded-lg p-3 text-sm text-gray-300 font-mono resize-none"
                placeholder="Prompt will appear here..."
              />
            </div>
          )}
          
          {/* Workout Display */}
          <div className="bg-[#1E293B] p-4 rounded-2xl space-y-3">
            <Section title="Warm-Up" items={data.warmup} />
            <Section title="Workout" items={data.workout} />
            <Section title="Cool-Down" items={data.cooldown} />
          </div>
        </div>
      )}
    </div>
  )
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <ul className="list-disc list-inside text-sm text-gray-200 space-y-1">
        {items.map((s, i) => <li key={i}>{s}</li>)}
      </ul>
    </div>
  )
} 