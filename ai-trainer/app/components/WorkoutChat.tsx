'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Simple icon components to replace lucide-react
const MessageCircle = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);

const Send = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
);

const X = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

// Simple UI components
const Button = ({ 
  children, 
  onClick, 
  disabled = false, 
  variant = "default", 
  size = "default",
  className = "" 
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "default" | "outline";
  size?: "default" | "sm";
  className?: string;
}) => {
  const baseClasses = "px-4 py-2 rounded-lg font-medium transition-colors";
  const variantClasses = {
    default: "bg-blue-500 text-white hover:bg-blue-600 disabled:bg-gray-400",
    outline: "border border-gray-300 text-gray-700 hover:bg-gray-50"
  };
  const sizeClasses = {
    default: "px-4 py-2",
    sm: "px-3 py-1 text-sm"
  };
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {children}
    </button>
  );
};

const Input = ({ 
  value, 
  onChange, 
  onKeyPress, 
  placeholder, 
  className = "" 
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyPress?: (e: React.KeyboardEvent) => void;
  placeholder?: string;
  className?: string;
}) => (
  <input
    value={value}
    onChange={onChange}
    onKeyPress={onKeyPress}
    placeholder={placeholder}
    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
  />
);

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white border border-gray-200 rounded-lg shadow-lg ${className}`}>
    {children}
  </div>
);

export function WorkoutChat() {
  const [isOpen, setIsOpen] = useState(false);
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

    setMessages(prev => [...prev, { type: 'user', content: message }]);
    setMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat-workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message,
          context: messages.slice(-5)
        })
      });

      const data = await response.json();

      if (data.type === 'nike_list') {
        setMessages(prev => [...prev, {
          type: 'nike_list',
          content: data.message,
          workouts: data.workouts
        }]);
      } else if (data.type === 'custom_workout') {
        setMessages(prev => [...prev, {
          type: 'assistant',
          content: data.formattedResponse,
          sessionId: data.sessionId
        }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, {
        type: 'error',
        content: 'Sorry, I had trouble generating that workout. Please try again.'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNikeSelect = async (workoutNumber: number) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/generate-nike-wod', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workoutNumber })
      });

      const data = await response.json();
      
      setMessages(prev => [...prev, {
        type: 'assistant',
        content: `✅ Generated Nike Workout #${workoutNumber}: ${data.workoutName}\n\nClick "Start Workout" to begin!`,
        sessionId: data.sessionId
      }]);

      // Optional: Navigate to workout page
      // router.push(`/workout/${data.sessionId}`);
    } catch (error) {
      console.error('Nike workout error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Chat Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 bg-blue-500 text-white rounded-full p-4 shadow-lg hover:bg-blue-600 transition-all z-50"
      >
        {isOpen ? <X /> : <MessageCircle />}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <Card className="fixed bottom-24 right-6 w-96 h-[500px] shadow-xl z-40 flex flex-col">
          <div className="p-4 border-b">
            <h3 className="font-semibold">AI Workout Assistant</h3>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, idx) => (
              <div key={idx}>
                {msg.type === 'user' && (
                  <div className="flex justify-end">
                    <div className="bg-blue-500 text-white rounded-lg p-3 max-w-[80%]">
                      {msg.content}
                    </div>
                  </div>
                )}
                
                {msg.type === 'assistant' && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 rounded-lg p-3 max-w-[80%]">
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                      {msg.sessionId && (
                        <Button
                          size="sm"
                          className="mt-2"
                          onClick={() => router.push(`/workout/${msg.sessionId}`)}
                        >
                          Start Workout
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {msg.type === 'nike_list' && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 rounded-lg p-3 max-w-[80%]">
                      <p className="mb-3">{msg.content}</p>
                      <div className="space-y-2">
                        {msg.workouts.map((w: any) => (
                          <Button
                            key={w.number}
                            variant={w.isCurrent ? "default" : "outline"}
                            size="sm"
                            className="w-full text-left justify-start"
                            onClick={() => handleNikeSelect(w.number)}
                            disabled={isLoading}
                          >
                            {w.isCurrent && "➡️ "}
                            Workout #{w.number}: {w.name}
                          </Button>
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
                <div className="bg-gray-100 rounded-lg p-3">
                  <div className="animate-pulse">Generating workout...</div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t">
            <div className="flex gap-2">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask for a workout..."
                className="flex-1"
              />
              <Button onClick={handleSend} disabled={isLoading}>
                <Send />
              </Button>
            </div>
            
            {/* Quick Actions */}
            <div className="flex gap-2 flex-wrap mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMessage("Nike workouts")}
              >
                Nike Program
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMessage("45 min upper body workout, sore lower back")}
              >
                Upper (Sore Back)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMessage("30 minute HIIT")}
              >
                Quick HIIT
              </Button>
            </div>
          </div>
        </Card>
      )}
    </>
  );
} 