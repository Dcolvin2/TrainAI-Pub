'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { generateWorkoutForType, getWorkoutSuggestions, saveWorkout } from '@/lib/workoutGenerator';
import { WorkoutDisplay } from '../components/WorkoutDisplay';
import { WorkoutCard } from '../components/WorkoutCard';

// Simple icon components
const ChevronRight = ({ className, ...props }: any) => (
  <span className={className} {...props}>›</span>
);
const Clock = ({ className, ...props }: any) => (
  <span className={className} {...props}>🕐</span>
);
const Dumbbell = ({ className, ...props }: any) => (
  <span className={className} {...props}>🏋️</span>
);
const Target = ({ className, ...props }: any) => (
  <span className={className} {...props}>🎯</span>
);
const Zap = ({ className, ...props }: any) => (
  <span className={className} {...props}>⚡</span>
);
const MessageSquare = ({ className, ...props }: any) => (
  <span className={className} {...props}>💬</span>
);
const X = ({ className, ...props }: any) => (
  <span className={className} {...props}>✕</span>
);

interface WorkoutSelection {
  type: string;
  id: string;
  label: string;
  category?: string;
  timeAvailable: number;
}

interface WorkoutTypeSelectorProps {
  onSelect: (selection: WorkoutSelection) => void;
  timeAvailable: number;
  suggestedType: string | null;
  setShowChat: (show: boolean) => void;
}

interface TimeSelectorProps {
  timeAvailable: number;
  onTimeChange: (time: number) => void;
}

interface GeneratedWorkout {
  warmup: any[];
  mainLift: any;
  accessories: any[];
  cooldown: any[];
  sessionId?: string;
}

// Time Selector Component
const TimeSelector = ({ timeAvailable, onTimeChange }: TimeSelectorProps) => {
  return (
    <div className="bg-gray-900 rounded-lg p-6 mb-8">
      <label className="flex items-center justify-between mb-4">
        <span className="text-lg font-medium text-white">Time Available</span>
        <span className="text-2xl font-bold text-green-400">{timeAvailable} minutes</span>
      </label>
      <div className="grid grid-cols-4 gap-4">
        {[15, 30, 45, 60].map(time => (
          <button
            key={time}
            onClick={() => onTimeChange(time)}
            className={`p-4 rounded-lg font-bold text-white transition-colors ${
              timeAvailable === time ? 'bg-green-600' : 'bg-gray-800 hover:bg-gray-700'
            }`}
          >
            {time} min
          </button>
        ))}
      </div>
    </div>
  );
};

// Workout Type Selector Component
const WorkoutTypeSelector = ({ onSelect, timeAvailable, suggestedType, setShowChat }: WorkoutTypeSelectorProps) => {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const workoutCategories = {
    'Muscle Groups': {
      icon: <Target className="w-5 h-5" />,
      description: 'Target specific muscles',
      options: [
        { id: 'chest', label: 'Chest', muscles: 'Pectorals', color: 'bg-blue-600' },
        { id: 'back', label: 'Back', muscles: 'Lats, Rhomboids, Traps', color: 'bg-green-600' },
        { id: 'shoulders', label: 'Shoulders', muscles: 'Deltoids', color: 'bg-yellow-600' },
        { id: 'arms', label: 'Arms', muscles: 'Biceps & Triceps', color: 'bg-purple-600' },
        { id: 'core', label: 'Core', muscles: 'Abs & Obliques', color: 'bg-red-600' }
      ]
    },
    'Specific Focus': {
      icon: <Zap className="w-5 h-5" />,
      description: 'Isolate individual muscles',
      options: [
        { id: 'biceps', label: 'Biceps', muscles: 'Bicep focus', color: 'bg-indigo-500' },
        { id: 'triceps', label: 'Triceps', muscles: 'Tricep focus', color: 'bg-indigo-600' },
        { id: 'glutes', label: 'Glutes', muscles: 'Glute focus', color: 'bg-pink-600' },
        { id: 'calves', label: 'Calves', muscles: 'Calf focus', color: 'bg-gray-600' }
      ]
    }
  };

  const handleSelection = (selection: any) => {
    console.log('Selected workout:', selection); // Add this
    onSelect({
      type: selection.id,
      id: selection.id,
      label: selection.label,
      category: expandedCategory || 'split', // Make sure this is included
      timeAvailable: timeAvailable
    });
  };

  return (
    <div className="w-full">
      <h3 className="text-xl font-bold mb-4 text-white">What are we training today?</h3>
      
      {/* Quick popular selections */}
      <div className="mb-6">
        <p className="text-sm text-gray-400 mb-2">Popular choices:</p>
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'push', label: 'Push', muscles: 'Chest, Shoulders, Triceps', color: 'bg-blue-500' },
            { id: 'pull', label: 'Pull', muscles: 'Back, Biceps', color: 'bg-green-500' },
            { id: 'legs', label: 'Legs', muscles: 'Quads, Hamstrings, Glutes', color: 'bg-purple-500' },
            { id: 'upper', label: 'Upper Body', muscles: 'All upper body muscles', color: 'bg-orange-500' },
            { id: 'full_body', label: 'Full Body', muscles: 'Complete workout', color: 'bg-red-500' },
            { id: 'hiit', label: 'HIIT', muscles: 'Full body cardio', color: 'bg-yellow-500' }
          ].map(option => (
            <button
              key={option.id}
              onClick={() => handleSelection(option)}
              className={`px-4 py-2 rounded-lg text-white font-medium transition-all ${option.color} hover:opacity-90`}
            >
              {option.label}
            </button>
          ))}
          <button
            onClick={() => setShowChat(true)}
            className="px-4 py-2 rounded-lg text-white font-medium transition-all bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
          >
            <MessageSquare className="w-4 h-4" />
            Chat with AI
          </button>
        </div>
      </div>

      {/* Expandable categories */}
      <div className="space-y-2">
        {Object.entries(workoutCategories).map(([category, data]) => (
          <div key={category} className="border border-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setExpandedCategory(expandedCategory === category ? null : category)}
              className="w-full px-4 py-3 flex items-center justify-between bg-gray-800 hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="text-gray-400">{data.icon}</div>
                <div className="text-left">
                  <h4 className="font-semibold text-white">{category}</h4>
                  <p className="text-sm text-gray-400">{data.description}</p>
                </div>
              </div>
              <ChevronRight 
                className={`w-5 h-5 text-gray-400 transition-transform ${
                  expandedCategory === category ? 'rotate-90' : ''
                }`} 
              />
            </button>
            
            {expandedCategory === category && (
              <div className="p-4 bg-gray-800 grid grid-cols-2 gap-3">
                {data.options.map(option => (
                  <button
                    key={option.id}
                    onClick={() => handleSelection(option)}
                    className="p-3 rounded-lg border border-gray-700 hover:border-gray-500 transition-all text-left group"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="font-medium text-white group-hover:text-blue-400 transition-colors">
                          {option.label}
                        </h5>
                        <p className="text-xs text-gray-400">{option.muscles}</p>
                      </div>
                      <div className={`w-2 h-2 rounded-full ${option.color}`} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* AI suggestion */}
      {suggestedType && (
        <div className="mt-6 p-4 bg-blue-900/20 border border-blue-800 rounded-lg">
          <p className="text-sm text-blue-400">
            💡 Based on your recent workouts, we suggest <strong>{suggestedType.replace('_', ' ')} Day</strong> to maintain balance
          </p>
        </div>
      )}
    </div>
  );
};

interface ChatPanelProps {
  workout: any;
  onClose: () => void;
  onUpdate: (updated: any) => void;
}

// Chat Panel Component
const ChatPanel = ({ workout, onClose, onUpdate }: ChatPanelProps) => {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'How would you like to modify your workout? Try "add face pulls" or "make it harder"' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (message: string) => {
    if (!message.trim() || isLoading) return;
    
    // Clear input immediately to prevent double-send
    const userMessage = message;
    setInput(''); // Clear input field
    
    // Add user message only once
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage })
      });

      const data = await response.json();
      
      // Add assistant response
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
      
      // Parse workout from response and update the workout display
      if (userMessage.toLowerCase().includes('workout')) {
        // You can add workout parsing logic here if needed
        console.log('Workout-related message detected');
      }
      
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: '❌ Sorry, I had trouble processing your message. Please try again.' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    
    const userMessage = input.trim();
    // Don't add user message here - handleSendMessage will do it
    handleSendMessage(userMessage);
  };

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-gray-900 shadow-2xl z-50 flex flex-col">
      <div className="p-6 border-b border-gray-800 flex justify-between items-center">
        <h3 className="text-xl font-bold text-white">Chat with AI</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4 chat-container">
        {messages.map((msg, i) => (
          <div key={i} className={`${
            msg.role === 'user' ? 'ml-8' : 'mr-8'
          }`}>
            <div className={`p-4 rounded-lg chat-message ${
              msg.role === 'user' ? 'bg-blue-900/50 text-white' : 'bg-gray-800 text-gray-300'
            }`}>
              <div className="whitespace-pre-wrap break-words max-w-full">
                {msg.content}
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="mr-8">
            <div className="bg-gray-800 text-gray-300 p-4 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                <span>Processing your message...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-6 border-t border-gray-800">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask me anything..."
            disabled={isLoading}
            className="flex-1 bg-gray-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg text-white font-medium transition-colors disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

// Workout Summary Component
const WorkoutSummary = ({ workout, selectedType, timeAvailable, setShowChat }: { 
  workout: GeneratedWorkout; 
  selectedType: WorkoutSelection; 
  timeAvailable: number;
  setShowChat: (show: boolean) => void;
}) => {
  return (
    <div className="bg-gray-900 rounded-lg p-6 space-y-6">
      {/* Warmup */}
      <div>
        <h3 className="text-green-400 font-bold mb-2">🔥 Warm-up</h3>
        {workout.warmup && workout.warmup.map((ex, i) => (
          <div key={i} className="bg-gray-800 p-2 rounded mb-1">
            {ex.name} - {ex.reps || ex.duration}
          </div>
        ))}
      </div>

      {/* Main Lift */}
      <div>
        <h3 className="text-blue-400 font-bold mb-2">💪 Main Lift</h3>
        {workout.mainLift && (
          <div className="bg-gray-800 p-4 rounded border-2 border-blue-400">
            <h4 className="font-bold text-lg text-white">{workout.mainLift.name}</h4>
            <p className="text-gray-400">{workout.mainLift.sets} sets × {workout.mainLift.reps}</p>
            <p className="text-sm text-gray-400">Rest: {workout.mainLift.rest}</p>
          </div>
        )}
      </div>

      {/* Accessories */}
      <div>
        <h3 className="text-orange-400 font-bold mb-2">🎯 Accessories</h3>
        {workout.accessories && workout.accessories.length > 0 ? (
          workout.accessories.map((ex, i) => (
            <div key={i} className="bg-gray-800 p-3 rounded mb-2">
              {ex.name} - {ex.sets} × {ex.reps}
            </div>
          ))
        ) : (
          <p className="text-gray-500">No accessories for this workout</p>
        )}
      </div>

      {/* Cooldown */}
      <div>
        <h3 className="text-purple-400 font-bold mb-2">🧘 Cool-down</h3>
        {workout.cooldown && workout.cooldown.map((ex, i) => (
          <div key={i} className="bg-gray-800 p-2 rounded mb-1">
            {ex.name} - {ex.duration || ex.reps}
          </div>
        ))}
      </div>

      {/* Buttons */}
      <div className="flex gap-4">
        <button className="bg-green-600 px-6 py-3 rounded-lg text-white font-medium hover:bg-green-700 transition-colors">
          Start Workout
        </button>
        <button onClick={() => setShowChat(true)} className="bg-blue-600 px-6 py-3 rounded-lg text-white font-medium hover:bg-blue-700 transition-colors">
          Chat with AI
        </button>
      </div>
    </div>
  );
};

// Main Workout Page Component
export default function TodaysWorkout() {
  const { user } = useAuth();
  const router = useRouter();
  const [timeAvailable, setTimeAvailable] = useState(45);
  const [selectedType, setSelectedType] = useState<WorkoutSelection | null>(null);
  const [generatedWorkout, setGeneratedWorkout] = useState<GeneratedWorkout | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [suggestedType, setSuggestedType] = useState<string | null>(null);
  const [userId] = useState('demo-user-id'); // In real app, get from auth

  useEffect(() => {
    fetchWorkoutSuggestion();
  }, []);

  const fetchWorkoutSuggestion = async () => {
    try {
      const suggestion = await getWorkoutSuggestions(userId);
      if (suggestion) {
        setSuggestedType(suggestion.type);
      }
    } catch (error) {
      console.error('Error fetching workout suggestion:', error);
    }
  };

    const handleWorkoutSelect = async (selection: WorkoutSelection) => {
    // Clear previous workout for ANY selection (not just popular ones)
    setGeneratedWorkout(null);
    setSelectedType(selection);
    setIsGenerating(true);
    
    try {
      if (selection.id === 'nike') {
        // Call Nike WOD endpoint
        const response = await fetch('/api/generate-nike-wod', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})  // Will use next sequential workout
        });
        
        if (!response.ok) {
          throw new Error('Failed to generate Nike workout');
        }
        
        const data = await response.json();
        // Nike WOD returns sessionId in the response
        setGeneratedWorkout({
          ...data,
          sessionId: data.sessionId
        });
      } else {
        // Existing workout generation logic
        const response = await fetch('/api/generate-workout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: selection.id,        // This should be 'chest', 'biceps', etc.
            category: selection.category, // Add this - tells if it's 'muscle_group' or 'specific_focus'
            timeMinutes: timeAvailable,
            userId: user?.id
          })
        });

        if (!response.ok) {
          throw new Error('Failed to generate workout');
        }
        
        const workout = await response.json();
        // Standard workout generation might not return sessionId, so we'll use a fallback
        setGeneratedWorkout({
          ...workout,
          sessionId: workout.sessionId || `workout-${Date.now()}`
        });
      }
    } catch (error) {
      console.error('Error generating workout:', error);
      // Fallback to mock data
      setGeneratedWorkout({
        warmup: [
          { name: 'High Knees', duration: '2 min' },
          { name: 'Treadmill Walking', duration: '3 min' }
        ],
        mainLift: { name: 'Bench Press', sets: 4, reps: '8-10' },
        accessories: [
          { name: 'Dips', sets: 3, reps: '12-15' },
          { name: 'Lateral Raises', sets: 3, reps: '15-20' }
        ],
        cooldown: [
          { name: 'Foam Roll Quads', duration: '2 min' },
          { name: 'Stretching', duration: '3 min' }
        ],
        sessionId: `mock-${Date.now()}`
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStartWorkout = () => {
    // Navigate to workout execution screen
    console.log('Starting workout...');
  };

  const handleTimeChange = (time: number) => {
    setTimeAvailable(time);
  };

  // Redirect if not authenticated
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-white text-xl mb-4">Please log in to access your workout</div>
          <button
            onClick={() => router.push('/login')}
            className="bg-green-600 px-6 py-3 rounded-xl text-white font-semibold hover:bg-green-700 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Clean Header */}
      <div className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-xl font-semibold text-white">TrainAI</h1>
          <h2 className="text-lg font-medium text-white">Dashboard</h2>
          <button className="text-white hover:text-gray-300 transition-colors">Profile</button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Time Selection */}
        <div className="mb-8">
          <h3 className="text-lg font-medium text-white mb-4">Time Available</h3>
          <div className="flex gap-4">
            {[15, 30, 45, 60].map((time) => (
              <button
                key={time}
                onClick={() => handleTimeChange(time)}
                className={`px-6 py-3 rounded-lg font-medium transition-all ${
                  timeAvailable === time
                    ? 'bg-gray-800 text-white border border-gray-700'
                    : 'bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                {time === 60 ? '60+' : `${time} min`}
              </button>
            ))}
          </div>
        </div>

        {/* Workout Type Cards - Two Rows */}
        <div className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* First Row */}
            <WorkoutCard
              type="PUSH"
              primaryMuscles="Chest, Shoulders"
              accentColor="#3B82F6"
              onClick={() => handleWorkoutSelect({
                type: 'push',
                id: 'push',
                label: 'Push',
                timeAvailable: timeAvailable
              })}
            />
            <WorkoutCard
              type="PULL"
              primaryMuscles="Back, Biceps"
              accentColor="#059669"
              onClick={() => handleWorkoutSelect({
                type: 'pull',
                id: 'pull',
                label: 'Pull',
                timeAvailable: timeAvailable
              })}
            />
            <WorkoutCard
              type="LEGS"
              primaryMuscles="Quads, Glutes"
              accentColor="#7C3AED"
              onClick={() => handleWorkoutSelect({
                type: 'legs',
                id: 'legs',
                label: 'Legs',
                timeAvailable: timeAvailable
              })}
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            {/* Second Row */}
            <WorkoutCard
              type="UPPER"
              primaryMuscles="Body"
              accentColor="#DC2626"
              onClick={() => handleWorkoutSelect({
                type: 'upper',
                id: 'upper',
                label: 'Upper',
                timeAvailable: timeAvailable
              })}
            />
            <WorkoutCard
              type="FULL"
              primaryMuscles="Body"
              accentColor="#EA580C"
              onClick={() => handleWorkoutSelect({
                type: 'full',
                id: 'full',
                label: 'Full',
                timeAvailable: timeAvailable
              })}
            />
            <WorkoutCard
              type="HIIT"
              primaryMuscles="Intervals"
              accentColor="#CA8A04"
              onClick={() => handleWorkoutSelect({
                type: 'hiit',
                id: 'hiit',
                label: 'HIIT',
                timeAvailable: timeAvailable
              })}
            />
          </div>
        </div>

        {/* Separator */}
        <div className="border-t border-gray-800 mb-8"></div>

        {/* AI Workout Assistant */}
        <div className="bg-gray-900 rounded-lg p-6">
          <h3 className="text-lg font-medium text-white mb-4">AI Workout Assistant</h3>
          <div className="flex gap-4">
            <input
              type="text"
              placeholder="Describe your workout goals or say 'Nike workouts'..."
              className="flex-1 bg-gray-800 text-white px-4 py-3 rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              onKeyPress={(e) => e.key === 'Enter' && setShowChat(true)}
            />
            <button
              onClick={() => setShowChat(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Send
            </button>
          </div>
        </div>

        {/* Loading State */}
        {isGenerating && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-xl text-white">Generating your {selectedType?.label} workout...</p>
          </div>
        )}

        {/* Generated Workout Display */}
        {generatedWorkout && selectedType && !isGenerating && (
          <WorkoutDisplay 
            workout={{
              name: selectedType.label,
              warmup: generatedWorkout.warmup.map((ex: any) => ex.name || ex),
              main: generatedWorkout.accessories.map((ex: any) => ({
                name: ex.name || ex,
                previous: ex.previous || 'N/A'
              })),
              cooldown: generatedWorkout.cooldown.map((ex: any) => ex.name || ex)
            }}
            onFinish={() => {
              console.log('Workout finished!');
              setGeneratedWorkout(null);
              setSelectedType(null);
            }}
          />
        )}
      </div>

      {/* Chat Panel */}
      {showChat && (
        <ChatPanel 
          workout={generatedWorkout}
          onClose={() => setShowChat(false)}
          onUpdate={(updated) => setGeneratedWorkout(updated)}
        />
      )}
    </div>
  );
} 