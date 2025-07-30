'use client'

import { useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'
import WorkoutChatBuilder from '@/app/components/WorkoutChatBuilder'
import ClaudeChatPanel from '@/app/components/ClaudeChatPanel'

export default function AIComparisonPage(): React.JSX.Element {
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
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-2">🤖 AI Comparison Test</h1>
          <p className="text-gray-400">Test ChatGPT vs Claude side by side</p>
          <div className="mt-4 flex justify-center gap-4">
            <div className="bg-[#22C55E] text-white px-4 py-2 rounded-lg">
              🧠 ChatGPT (OpenAI)
            </div>
            <div className="bg-[#8B5CF6] text-white px-4 py-2 rounded-lg">
              🧠 Claude (Anthropic)
            </div>
          </div>
        </div>

        {/* Side by Side Chat Interfaces */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ChatGPT Panel */}
          <div className="bg-[#1E293B] rounded-lg p-6 border-2 border-[#22C55E]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <span className="text-[#22C55E]">🤖</span>
                ChatGPT (OpenAI)
              </h2>
              <div className="text-xs text-gray-400">GPT-4o-mini</div>
            </div>
            <div className="h-96 overflow-y-auto mb-4 bg-[#0F172A] rounded-lg p-4">
              <WorkoutChatBuilder userId={user.id} />
            </div>
          </div>

          {/* Claude Panel */}
          <div className="bg-[#1E293B] rounded-lg p-6 border-2 border-[#8B5CF6]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <span className="text-[#8B5CF6]">🧠</span>
                Claude (Anthropic)
              </h2>
              <div className="text-xs text-gray-400">Claude 3.5 Sonnet</div>
            </div>
            <div className="h-96 overflow-y-auto mb-4 bg-[#0F172A] rounded-lg p-4">
              <ClaudeChatPanel userId={user.id} />
            </div>
          </div>
        </div>

        {/* Test Questions */}
        <div className="bg-[#1E293B] rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">🧪 Test Questions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              "Create a Monday workout plan",
              "How do I do a barbell squat?",
              "I want to build muscle, what should I focus on?",
              "Create a 30-minute HIIT workout",
              "What's the proper form for deadlifts?",
              "Help me create a beginner workout routine"
            ].map((question, index) => (
              <div key={index} className="bg-[#0F172A] p-3 rounded-lg border border-[#334155]">
                <p className="text-white text-sm">{question}</p>
                <p className="text-gray-400 text-xs mt-1">Copy and paste into both chats</p>
              </div>
            ))}
          </div>
        </div>

        {/* Comparison Notes */}
        <div className="bg-[#1E293B] rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">📊 Comparison Metrics</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-[#22C55E] font-medium mb-2">ChatGPT (OpenAI)</h4>
              <ul className="text-gray-300 text-sm space-y-1">
                <li>• Faster response times</li>
                <li>• Lower cost per request</li>
                <li>• Established integration</li>
                <li>• Function calling support</li>
              </ul>
            </div>
            <div>
              <h4 className="text-[#8B5CF6] font-medium mb-2">Claude (Anthropic)</h4>
              <ul className="text-gray-300 text-sm space-y-1">
                <li>• More detailed responses</li>
                <li>• Better context understanding</li>
                <li>• Improved instruction clarity</li>
                <li>• Enhanced explanations</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-[#1E293B] rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">⚡ Quick Actions</h3>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => {
                // Copy test question to clipboard
                navigator.clipboard.writeText("Create a Monday workout plan");
                alert("Test question copied to clipboard!");
              }}
              className="bg-[#22C55E] text-white px-4 py-2 rounded-lg hover:bg-[#16a34a] transition-colors"
            >
              📋 Copy Test Question
            </button>
            <button
              onClick={() => {
                // Clear both chats
                window.location.reload();
              }}
              className="bg-[#EF4444] text-white px-4 py-2 rounded-lg hover:bg-[#DC2626] transition-colors"
            >
              🗑️ Clear Both Chats
            </button>
            <button
              onClick={() => {
                // Open swap scripts info
                alert("Use ./swap-to-claude.sh to switch to Claude\nUse ./swap-to-openai.sh to switch back");
              }}
              className="bg-[#8B5CF6] text-white px-4 py-2 rounded-lg hover:bg-[#7C3AED] transition-colors"
            >
              🔄 Switch Systems
            </button>
          </div>
        </div>
      </div>
    </div>
  )
} 