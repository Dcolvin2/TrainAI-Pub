'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Simple icon components to replace lucide-react
const SendIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
);

const LoaderIcon = () => (
  <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

export function WorkoutChatPanel({ onClose }: { onClose?: () => void }) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!message.trim() || isLoading) return;

    const userMessage = { type: 'user', content: message };
    setMessages(prev => [...prev, userMessage]);
    const currentMessage = message;
    setMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat-workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: currentMessage,
          context: messages.slice(-5)
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }
      
      const data = await response.json();
      console.log('Chat response:', data);

      if (data.type === 'workout') {
        // Display workout summary
        setMessages(prev => [...prev, {
          type: 'workout',
          content: formatWorkoutDisplay(data.workout),
          workout: data.workout,
          sessionId: data.sessionId
        }]);
      } else if (data.type === 'nike_list') {
        setMessages(prev => [...prev, {
          type: 'nike_list',
          content: data.message,
          workouts: data.workouts
        }]);
      } else {
        setMessages(prev => [...prev, {
          type: 'assistant',
          content: data.message
        }]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        type: 'error',
        content: '❌ Sorry, I had trouble with that request. Please try again.'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatWorkoutDisplay = (workout: any) => {
    if (!workout.exercises) return 'Workout generated!';

    return `
📋 **${workout.name}** (${workout.duration} min)

${workout.exercises.map((ex: any) => `
**${ex.name}**
${ex.sets?.map((set: any) => 
  `Set ${set.setNumber}: ${set.reps} reps @ ${set.weight || 'bodyweight'} lbs${set.previousWeight ? ` (prev: ${set.previousWeight} lbs)` : ''}`
).join('\n') || `${ex.sets} sets x ${ex.reps} reps`}
${ex.instructions ? `💡 ${ex.instructions}` : ''}
`).join('\n---\n')}

${workout.notes ? `\n📝 Notes: ${workout.notes}` : ''}
`;
  };

  const handleStartWorkout = (sessionId: string) => {
    router.push(`/workout/${sessionId}`);
    onClose?.();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            <p className="mb-4">Ask me to create a workout! Try:</p>
            <div className="space-y-2 text-sm">
              <p>"I have 20 minutes and only kettlebells"</p>
              <p>"Create a push workout with dumbbells"</p>
              <p>"Nike workouts"</p>
              <p>"30 minute leg day"</p>
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className="animate-fadeIn">
            {msg.type === 'user' && (
              <div className="flex justify-end">
                <div className="bg-blue-600 text-white rounded-lg p-3 max-w-[80%]">
                  {msg.content}
                </div>
              </div>
            )}
            
            {msg.type === 'assistant' && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3 max-w-[80%]">
                  {msg.content}
                </div>
              </div>
            )}

            {msg.type === 'workout' && (
              <div className="flex justify-start">
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 max-w-[90%]">
                  <pre className="whitespace-pre-wrap font-sans text-sm">
                    {msg.content}
                  </pre>
                  {msg.sessionId && (
                    <button
                      onClick={() => handleStartWorkout(msg.sessionId)}
                      className="mt-4 w-full bg-green-600 text-white rounded-lg py-2 hover:bg-green-700"
                    >
                      Start Workout
                    </button>
                  )}
                </div>
              </div>
            )}

            {msg.type === 'nike_list' && (
              <div className="flex justify-start">
                <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4 max-w-[80%]">
                  <p className="mb-3 font-semibold">{msg.content}</p>
                  <div className="space-y-2">
                    {msg.workouts?.map((w: any) => (
                      <button
                        key={w.number}
                        className={`w-full text-left p-3 rounded-lg ${
                          w.isCurrent 
                            ? 'bg-indigo-600 text-white' 
                            : 'bg-white dark:bg-gray-700 hover:bg-gray-100'
                        }`}
                        onClick={() => setMessage(`Generate Nike workout ${w.number}`)}
                      >
                        {w.isCurrent && "➡️ "}
                        Workout #{w.number}: {w.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {msg.type === 'error' && (
              <div className="flex justify-start">
                <div className="bg-red-100 text-red-700 rounded-lg p-3 max-w-[80%]">
                  {msg.content}
                </div>
              </div>
            )}
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3 flex items-center gap-2">
              <LoaderIcon />
              <span>Generating your workout...</span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Type your workout request..."
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !message.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <SendIcon />
          </button>
        </div>

        {/* Quick prompts */}
        <div className="flex gap-2 mt-3 flex-wrap">
          <button
            onClick={() => setMessage("I have 20 minutes and only have kettlebells, please generate a workout")}
            className="text-xs px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded-full hover:bg-gray-300"
          >
            20 min KB workout
          </button>
          <button
            onClick={() => setMessage("Nike workouts")}
            className="text-xs px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded-full hover:bg-gray-300"
          >
            Nike workouts
          </button>
          <button
            onClick={() => setMessage("Create a push day workout")}
            className="text-xs px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded-full hover:bg-gray-300"
          >
            Push day
          </button>
        </div>
      </div>
    </div>
  );
} 