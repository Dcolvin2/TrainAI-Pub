'use client'

import { useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'
import WorkoutChatBuilder from '@/app/components/WorkoutChatBuilder'

export default function WorkoutChatPage(): React.JSX.Element {
  const { user } = useAuth()
  const router = useRouter()

  // Redirect if not authenticated
  useEffect(() => {
    if (!user) {
      router.push('/login')
    }
  }, [user, router])

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0F172A] p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-2">AI Workout Chat</h1>
          <p className="text-gray-400">Chat with TrainAI to create personalized workouts</p>
        </div>

        {/* Chat Builder Component */}
        <WorkoutChatBuilder userId={user.id} />
      </div>
    </div>
  )
} 