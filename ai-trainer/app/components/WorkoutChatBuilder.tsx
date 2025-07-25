'use client'
import { useState } from 'react'

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface WorkoutPlan {
  warmup: string[]
  workout: string[]
  cooldown: string[]
}

export default function WorkoutChatBuilder({ userId }: { userId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [plan, setPlan] = useState<WorkoutPlan | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Speech recognition functionality
  const startListening = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      setIsListening(true)
      const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition
      const recognition = new SpeechRecognitionCtor()

      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = 'en-US'

      recognition.onstart = () => setIsListening(true)

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0])
          .map((result: any) => result.transcript)
          .join('')
        setTranscript(transcript)
        setInput(transcript)
      }

      recognition.onerror = (event: any) => {
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

      setMessages(msgs => [...msgs, data.assistant])
      if (data.plan) setPlan(data.plan)
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

  return (
    <div className="space-y-6">
      {/* Chat window */}
      <div className="bg-[#1E293B] p-4 rounded-xl shadow h-64 overflow-auto">
        {messages.length === 0 && (
          <div className="text-gray-400 text-center py-8">
            Start a conversation to build your workout!
          </div>
        )}
        {messages.map((m, i) => (
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
      {plan && (
        <div className="bg-[#1E293B] rounded-xl overflow-hidden shadow-md">
          <div className="p-4 border-b border-[#334155]">
            <h3 className="text-lg font-semibold text-white">Generated Workout Plan</h3>
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
                </tr>
              </thead>
              <tbody>
                {plan.workout.map((item, i) => {
                  // Parse workout string: "Back Squat: 3x8 @ 100lb rest 90s"
                  const [name, restPart] = item.split(' rest ')
                  const [setsReps, weightPart] = name.split(' @ ')
                  const [sets, reps] = setsReps.split('x')
                  const weight = weightPart?.replace(/lb/, '') || ''
                  const rest = restPart?.replace('s', '') || ''
                  const exerciseName = name.split(':')[0]
                  
                  return (
                    <tr key={i} className="border-b border-[#334155]/50">
                      <td className="p-3 text-white">{exerciseName}</td>
                      <td className="p-3">
                        <input 
                          defaultValue={sets} 
                          className="w-12 bg-[#0F172A] border border-[#334155] px-2 py-1 rounded text-white text-center"
                        />
                      </td>
                      <td className="p-3">
                        <input 
                          defaultValue={reps} 
                          className="w-12 bg-[#0F172A] border border-[#334155] px-2 py-1 rounded text-white text-center"
                        />
                      </td>
                      <td className="p-3">
                        <input 
                          defaultValue={weight} 
                          className="w-16 bg-[#0F172A] border border-[#334155] px-2 py-1 rounded text-white text-center"
                        />
                      </td>
                      <td className="p-3">
                        <input 
                          defaultValue={rest} 
                          className="w-16 bg-[#0F172A] border border-[#334155] px-2 py-1 rounded text-white text-center"
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
} 