'use client'

import { useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'
import ClaudeChatPanel from '@/app/components/ClaudeChatPanel'

export default function ClaudeTestPage(): React.JSX.Element {
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
          <h1 className="text-3xl font-bold text-white mb-2">🧠 Claude AI Test</h1>
          <p className="text-gray-400">Testing the new Claude-powered workout chat system</p>
        </div>

        {/* Claude Chat Panel */}
        <ClaudeChatPanel userId={user.id} />
      </div>
    </div>
  )
} 