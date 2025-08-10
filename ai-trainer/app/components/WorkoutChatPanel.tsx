'use client';

import { useState, useEffect, useRef } from 'react';
import { useWorkoutStore } from '@/lib/workoutStore';
import { useAuth } from '@/context/AuthContext';
import PlanRenderer from './PlanRenderer';

// Simple icon components (since we don't have lucide-react)
const Send = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
  </svg>
);

const MessageCircle = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);

const X = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 6L6 18M6 6l12 12"/>
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

export function WorkoutChatPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { setPending } = useWorkoutStore();
  const { user } = useAuth();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!message.trim() || isLoading) return;

    // Get the signed-in user id
    const userId = user?.id;
    
    // Guard - check if user ID is available
    if (!userId) {
      console.warn('No user id available for chat-workout');
      setMessages(prev => [...prev, {
        type: 'error',
        content: 'Please sign in to use the workout chat.'
      }]);
      return;
    }

    const userMessage = { type: 'user', content: message };
    setMessages(prev => [...prev, userMessage]);
    setMessage('');
    setIsLoading(true);

    try {
      // Call the new chat-workout endpoint with narration
      const response = await fetch(`/api/chat-workout?user=${userId}&narrate=1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          q: message,
          user: userId,
          narrate: 1
        })
      });

      const data = await response.json();

      if (data.ok) {
        // Add assistant message with narrative and plan
        setMessages(prev => [...prev, {
          type: 'assistant',
          content: data.narrative || data.message,
          plan: data.plan || null,
          debug: data.debug || null
        }]);
        
        // If we have a plan, also set it as pending workout
        if (data.plan) {
          // Convert the new plan format to the expected format
          const warmup = data.plan.phases.find((p: any) => p.phase === 'warmup')?.items.map((e: any) => e.name) || [];
          const main = data.plan.phases.find((p: any) => p.phase === 'main')?.items.map((e: any) => e.name) || [];
          const cooldown = data.plan.phases.find((p: any) => p.phase === 'cooldown')?.items.map((e: any) => e.name) || [];
          const accessories = data.plan.phases.find((p: any) => p.phase === 'accessory')?.items.map((e: any) => e.name) || [];
          
          setPending({
            planId: `chat-${Date.now()}`,
            warmup,
            workout: main,
            cooldown,
            accessories
          });
        }
      } else {
        // Handle error response
        setMessages(prev => [...prev, {
          type: 'error',
          content: data.error || 'Sorry, I had trouble generating that workout. Please try again.'
        }]);
      }
    } catch (error) {
      console.error('Chat workout error:', error);
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
        content: `✅ Generated Nike Workout #${workoutNumber}: ${data.workoutName}`
      }]);

      // Set as pending workout
      setPending({
        planId: data.sessionId,
        warmup: data.exercises.filter((e: any) => e.phase === 'warmup').map((e: any) => e.name),
        workout: data.exercises.filter((e: any) => e.phase === 'main').map((e: any) => e.name),
        cooldown: data.exercises.filter((e: any) => e.phase === 'cooldown').map((e: any) => e.name),
        accessories: data.exercises.filter((e: any) => e.phase === 'accessory').map((e: any) => e.name)
      });
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
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <Card className="fixed bottom-24 right-6 w-96 h-[500px] shadow-xl z-40 flex flex-col">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Workout Assistant</h3>
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
                    <div className="bg-gray-100 rounded-lg p-3 max-w-[80%] whitespace-pre-wrap">
                      {msg.content}
                      {msg.plan && (
                        <div className="mt-3">
                          <PlanRenderer plan={msg.plan} />
                        </div>
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
                    <div className="bg-red-100 text-red-800 rounded-lg p-3 max-w-[80%]">
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
            <div className="flex gap-2 mb-2">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="Ask for a workout..."
                className="flex-1"
              />
              <Button onClick={handleSend} disabled={isLoading}>
                <Send size={20} />
              </Button>
            </div>
            
            {/* Quick Actions */}
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMessage("kettlebell workout 30 min")}
              >
                Kettlebell
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMessage("joe holder style mobility")}
              >
                Joe Holder
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMessage("upper body strength 45 min")}
              >
                Upper Body
              </Button>
            </div>
          </div>
        </Card>
      )}
    </>
  );
} 