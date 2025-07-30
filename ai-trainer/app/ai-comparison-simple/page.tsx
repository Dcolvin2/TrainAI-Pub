'use client'

import { useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'

export default function AISimpleComparisonPage(): React.JSX.Element {
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
                // Open ChatGPT test
                window.open('/workout/chat', '_blank');
              }}
              className="bg-[#22C55E] text-white px-4 py-2 rounded-lg hover:bg-[#16a34a] transition-colors"
            >
              🤖 Test ChatGPT
            </button>
            <button
              onClick={() => {
                // Open Claude test
                window.open('/claude-test', '_blank');
              }}
              className="bg-[#8B5CF6] text-white px-4 py-2 rounded-lg hover:bg-[#7C3AED] transition-colors"
            >
              🧠 Test Claude
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

        {/* Instructions */}
        <div className="bg-[#1E293B] rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">📋 Testing Instructions</h3>
          <div className="text-gray-300 space-y-2">
            <p>1. <strong>Copy a test question</strong> from the list above</p>
            <p>2. <strong>Open ChatGPT test</strong> in a new tab</p>
            <p>3. <strong>Open Claude test</strong> in another new tab</p>
            <p>4. <strong>Paste the same question</strong> into both chats</p>
            <p>5. <strong>Compare responses</strong> for quality, speed, and detail</p>
            <p>6. <strong>Repeat</strong> with different questions</p>
            <p>7. <strong>Choose your preferred system</strong> based on results</p>
          </div>
        </div>
      </div>
    </div>
  )
} 