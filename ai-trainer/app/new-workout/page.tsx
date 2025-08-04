'use client';

import React, { useState, useEffect } from 'react';
import { generateWorkoutForType, getWorkoutSuggestions, saveWorkout } from '@/lib/workoutGenerator';

// Simple icon components to replace lucide-react
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
  label: string;
  timeAvailable: number;
}

interface WorkoutTypeSelectorProps {
  onSelect: (selection: WorkoutSelection) => void;
  timeAvailable: number;
  suggestedType: string | null;
}

// Workout Type Selector Component
const WorkoutTypeSelector = ({ onSelect, timeAvailable, suggestedType }: WorkoutTypeSelectorProps) => {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const workoutCategories = {
    'Split Routines': {
      icon: <Dumbbell className="w-5 h-5" />,
      description: 'Popular training splits',
      options: [
        { id: 'push', label: 'Push', muscles: 'Chest, Shoulders, Triceps', color: 'bg-blue-500' },
        { id: 'pull', label: 'Pull', muscles: 'Back, Biceps', color: 'bg-green-500' },
        { id: 'legs', label: 'Legs', muscles: 'Quads, Hamstrings, Glutes', color: 'bg-purple-500' },
        { id: 'upper', label: 'Upper Body', muscles: 'All upper body muscles', color: 'bg-orange-500' },
        { id: 'lower', label: 'Lower Body', muscles: 'All lower body muscles', color: 'bg-pink-500' },
        { id: 'full_body', label: 'Full Body', muscles: 'Complete workout', color: 'bg-red-500' }
      ]
    },
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
    onSelect({
      type: selection.id,
      label: selection.label,
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
          {['push', 'pull', 'legs', 'upper', 'full_body'].map(type => {
            const option = Object.values(workoutCategories)
              .flatMap(cat => cat.options)
              .find(opt => opt.id === type);
            if (!option) return null;
            return (
              <button
                key={type}
                onClick={() => handleSelection(option)}
                className={`px-4 py-2 rounded-lg text-white font-medium transition-all ${option.color} hover:opacity-90`}
              >
                {option.label}
              </button>
            );
          })}
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

  const handleSend = () => {
    if (!input.trim()) return;
    
    setMessages([...messages, { role: 'user', content: input }]);
    // Simulate AI response
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `I'll help you ${input}. Updating your workout now...` 
      }]);
    }, 500);
    setInput('');
  };

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-gray-900 shadow-2xl z-50 flex flex-col">
      <div className="p-6 border-b border-gray-800 flex justify-between items-center">
        <h3 className="text-xl font-bold text-white">Modify Workout</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`${
            msg.role === 'user' ? 'ml-8' : 'mr-8'
          }`}>
            <div className={`p-4 rounded-lg ${
              msg.role === 'user' ? 'bg-blue-900/50 text-white' : 'bg-gray-800 text-gray-300'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
      </div>

      <div className="p-6 border-t border-gray-800">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type your modification..."
            className="flex-1 bg-gray-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button 
            onClick={handleSend}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg text-white font-medium transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

// Main Workout Page Component
export default function TodaysWorkout() {
  const [timeAvailable, setTimeAvailable] = useState(45);
  const [selectedWorkout, setSelectedWorkout] = useState<any>(null);
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
    setIsGenerating(true);
    try {
      // Create a mock workout type for the selected type
      const workoutType = {
        id: selection.type,
        name: selection.type,
        category: 'split',
        target_muscles: selection.type === 'push' ? ['chest', 'shoulders', 'triceps'] : 
                       selection.type === 'pull' ? ['back', 'biceps'] : 
                       selection.type === 'legs' ? ['quads', 'hamstrings', 'glutes'] : ['all'],
        movement_patterns: []
      };
      
      const workout = await generateWorkoutForType(workoutType, userId);
      setSelectedWorkout({
        type: selection.label,
        exercises: [
          ...workout.mainExercises.map((ex: any) => ({ ...ex, phase: 'main' })),
          ...workout.accessories.map((ex: any) => ({ ...ex, phase: 'accessory' }))
        ]
      });
    } catch (error) {
      console.error('Error generating workout:', error);
      // Fallback to mock data
      setSelectedWorkout({
        type: selection.label,
        exercises: [
          { name: 'Bench Press', sets: 4, reps: '8-10', phase: 'main' },
          { name: 'Overhead Press', sets: 3, reps: '10-12', phase: 'main' },
          { name: 'Dips', sets: 3, reps: '12-15', phase: 'accessory' },
          { name: 'Lateral Raises', sets: 3, reps: '15-20', phase: 'accessory' }
        ]
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStartWorkout = () => {
    // Navigate to workout execution screen
    console.log('Starting workout...');
  };

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white">Today's Workout</h1>
          <div className="text-gray-400">
            <Clock className="w-5 h-5 inline mr-2" />
            <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {!selectedWorkout ? (
          // Selection Screen
          <div className="max-w-3xl mx-auto">
            {/* Time Selector */}
            <div className="bg-gray-900 rounded-lg p-6 mb-8">
              <label className="flex items-center justify-between mb-4">
                <span className="text-lg font-medium text-white">Time Available</span>
                <span className="text-2xl font-bold text-green-400">{timeAvailable} minutes</span>
              </label>
              <input 
                type="range" 
                min="15" 
                max="90" 
                step="15"
                value={timeAvailable}
                onChange={(e) => setTimeAvailable(Number(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between mt-2 text-sm text-gray-500">
                <span>15 min</span>
                <span>45 min</span>
                <span>90 min</span>
              </div>
            </div>

            {/* Workout Type Selector */}
            <div className="bg-gray-900 rounded-lg p-6">
              <WorkoutTypeSelector 
                onSelect={handleWorkoutSelect} 
                timeAvailable={timeAvailable}
                suggestedType={suggestedType}
              />
            </div>
          </div>
        ) : isGenerating ? (
          // Loading State
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-400 mb-4"></div>
            <p className="text-xl text-white">Generating your {selectedWorkout.type} workout...</p>
          </div>
        ) : (
          // Workout Display
          <div>
            <div className="bg-gray-900 rounded-lg p-6 mb-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">
                    {selectedWorkout.type} Workout
                  </h2>
                  <p className="text-gray-400">
                    {timeAvailable} minutes • {selectedWorkout.exercises.length} exercises
                  </p>
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={() => setShowChat(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition-colors"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Modify
                  </button>
                  <button
                    onClick={handleStartWorkout}
                    className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-white font-medium transition-colors"
                  >
                    Start Workout
                  </button>
                </div>
              </div>

              {/* Exercise List */}
              <div className="space-y-4">
                {selectedWorkout.exercises.map((exercise: any, index: number) => (
                  <div key={index} className="bg-gray-800 rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-lg font-medium text-white">{exercise.name}</h3>
                        <p className="text-gray-400">
                          {exercise.sets} sets × {exercise.reps} reps
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm ${
                        exercise.phase === 'main' 
                          ? 'bg-blue-900/50 text-blue-400' 
                          : 'bg-gray-700 text-gray-400'
                      }`}>
                        {exercise.phase}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => setSelectedWorkout(null)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ← Choose different workout
            </button>
          </div>
        )}
      </div>

      {/* Chat Panel */}
      {showChat && (
        <ChatPanel 
          workout={selectedWorkout}
          onClose={() => setShowChat(false)}
          onUpdate={(updated) => setSelectedWorkout(updated)}
        />
      )}
    </div>
  );
} 