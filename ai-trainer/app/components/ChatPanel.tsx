'use client';

import { useState } from 'react';
import { modifyWorkout } from '@/lib/workoutModifier';

interface ChatPanelProps {
  workout: {
    type: any;
    warmup: any[];
    mainExercises: any[];
    accessories: any[];
    cooldown: any[];
    duration: number;
    focus: string;
  };
  onUpdate: (workout: any) => void;
  onClose: () => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatPanel({ workout, onUpdate, onClose }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);

    try {
      // Process the modification request
      const modifiedWorkout = await modifyWorkout(workout, input);
      
      // Update the workout
      onUpdate(modifiedWorkout);
      
      // Add AI response
      const aiMessage: Message = { 
        role: 'assistant', 
        content: `Updated your workout: ${describeChanges(workout, modifiedWorkout)}` 
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error modifying workout:', error);
      const errorMessage: Message = { 
        role: 'assistant', 
        content: 'Sorry, I couldn\'t modify your workout. Please try a different request.' 
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  const describeChanges = (originalWorkout: any, modifiedWorkout: any) => {
    const changes = [];
    
    if (modifiedWorkout.mainExercises.length !== originalWorkout.mainExercises.length) {
      changes.push(`main exercises (${modifiedWorkout.mainExercises.length} total)`);
    }
    
    if (modifiedWorkout.accessories.length !== originalWorkout.accessories.length) {
      changes.push(`accessories (${modifiedWorkout.accessories.length} total)`);
    }
    
    if (modifiedWorkout.duration !== originalWorkout.duration) {
      changes.push(`duration to ${modifiedWorkout.duration} minutes`);
    }
    
    return changes.length > 0 ? changes.join(', ') : 'no changes made';
  };

  const quickSuggestions = [
    "Add face pulls",
    "Replace squats with lunges", 
    "Make it harder",
    "Add more accessories",
    "Reduce rest time",
    "Add core work"
  ];

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-gray-900 shadow-xl p-6 overflow-y-auto z-50">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-white">Modify Workout</h3>
        <button 
          onClick={onClose} 
          className="text-gray-400 hover:text-white text-2xl"
        >
          ✕
        </button>
      </div>

      <div className="mb-4 p-4 bg-gray-800 rounded-lg">
        <p className="text-sm text-gray-300 mb-2">
          Try these modifications:
        </p>
        <div className="flex flex-wrap gap-2">
          {quickSuggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => setInput(suggestion)}
              className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded hover:bg-gray-600 transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 space-y-4 mb-4 max-h-96 overflow-y-auto">
        {messages.map((msg, i) => (
          <div key={i} className={`p-3 rounded-lg ${
            msg.role === 'user' ? 'bg-blue-900 ml-8' : 'bg-gray-800 mr-8'
          }`}>
            <p className="text-white text-sm">{msg.content}</p>
          </div>
        ))}
        {isProcessing && (
          <div className="p-3 rounded-lg bg-gray-800 mr-8">
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
              <p className="text-white text-sm">Processing...</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="How should I modify your workout?"
          className="flex-1 bg-gray-800 text-white p-3 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
          disabled={isProcessing}
        />
        <button 
          onClick={handleSend}
          disabled={isProcessing || !input.trim()}
          className="bg-blue-600 px-4 py-2 rounded-lg text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </div>
    </div>
  );
} 