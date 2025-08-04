'use client';

import { useState, useEffect } from 'react';
import { DynamicWorkoutGenerator } from '@/lib/dynamicWorkoutGenerator';

interface WorkoutStarterProps {
  userId: string;
  onWorkoutSelected: (workout: any) => void;
}

interface WorkoutTypeCardProps {
  type: string;
  description: string;
  onClick: () => void;
  isSuggested?: boolean;
}

function WorkoutTypeCard({ type, description, onClick, isSuggested }: WorkoutTypeCardProps) {
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'push': return 'bg-red-500/20 border-red-500/30 hover:bg-red-500/30';
      case 'pull': return 'bg-blue-500/20 border-blue-500/30 hover:bg-blue-500/30';
      case 'legs': return 'bg-green-500/20 border-green-500/30 hover:bg-green-500/30';
      case 'full_body': return 'bg-purple-500/20 border-purple-500/30 hover:bg-purple-500/30';
      default: return 'bg-gray-500/20 border-gray-500/30 hover:bg-gray-500/30';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'push': return '💪';
      case 'pull': return '🏋️';
      case 'legs': return '🦵';
      case 'full_body': return '🔥';
      default: return '⚡';
    }
  };

  return (
    <button
      onClick={onClick}
      className={`p-6 rounded-lg border-2 transition-all duration-200 ${getTypeColor(type)} ${
        isSuggested ? 'ring-2 ring-green-400 ring-opacity-50' : ''
      }`}
    >
      <div className="text-3xl mb-2">{getTypeIcon(type)}</div>
      <div className="text-xl font-bold mb-1 capitalize">
        {type.replace('_', ' ')} Day
      </div>
      <div className="text-sm text-gray-300">{description}</div>
      {isSuggested && (
        <div className="mt-2 text-xs text-green-400 font-medium">
          AI Suggested
        </div>
      )}
    </button>
  );
}

function formatWorkoutType(type: string) {
  return type.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
}

export default function WorkoutStarter({ userId, onWorkoutSelected }: WorkoutStarterProps) {
  const [workoutType, setWorkoutType] = useState<any>(null);
  const [suggestedType, setSuggestedType] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWorkoutSuggestion();
  }, [userId]);

  const fetchWorkoutSuggestion = async () => {
    try {
      setLoading(true);
      const generator = new DynamicWorkoutGenerator();
      const suggestion = await generator.generateWorkout(userId);
      
      if (suggestion.type === 'suggested') {
        setSuggestedType(suggestion);
      } else if (suggestion.type === 'pattern_based') {
        setWorkoutType(suggestion);
      } else if (suggestion.requiresUserInput) {
        setWorkoutType(suggestion);
      }
    } catch (err) {
      setError('Failed to load workout suggestion');
      console.error('Error fetching workout suggestion:', err);
    } finally {
      setLoading(false);
    }
  };

  const startWorkout = async (type: string) => {
    try {
      setLoading(true);
      const generator = new DynamicWorkoutGenerator();
      
      // Create a mock workout type for the selected type
      const workoutType = {
        type: 'custom',
        dayType: type,
        coreLift: type === 'push' ? 'Barbell Bench Press' : 
                  type === 'pull' ? 'Barbell Deadlift' : 
                  type === 'legs' ? 'Barbell Back Squat' : 'Barbell Back Squat'
      };
      
      const equipment = await generator.getUserEquipment(userId);
      const workout = await generator.buildWorkout(workoutType, equipment, userId);
      
      onWorkoutSelected(workout);
    } catch (err) {
      setError('Failed to start workout');
      console.error('Error starting workout:', err);
    } finally {
      setLoading(false);
    }
  };

  const startCustomWorkout = () => {
    // Navigate to custom workout builder
    // This would be implemented based on your routing structure
    console.log('Starting custom workout');
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400 mx-auto mb-4"></div>
          <p className="text-gray-400">Analyzing your training patterns...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <button 
          onClick={fetchWorkoutSuggestion}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl mb-6 text-center">What are we training today?</h1>
      
      {suggestedType && (
        <div className="mb-6 p-4 bg-green-900/20 rounded-lg border border-green-500/30">
          <p className="text-sm text-green-400 mb-2">Suggested based on your recent training:</p>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xl font-bold text-green-400">
                {formatWorkoutType(suggestedType.suggestion)} Day
              </div>
              <div className="text-sm text-green-300">{suggestedType.reason}</div>
            </div>
            <button 
              onClick={() => startWorkout(suggestedType.suggestion)}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            >
              Start
            </button>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        <WorkoutTypeCard 
          type="push" 
          description="Chest, Shoulders, Triceps"
          onClick={() => startWorkout('push')}
          isSuggested={suggestedType?.suggestion === 'push'}
        />
        <WorkoutTypeCard 
          type="pull" 
          description="Back, Biceps"
          onClick={() => startWorkout('pull')}
          isSuggested={suggestedType?.suggestion === 'pull'}
        />
        <WorkoutTypeCard 
          type="legs" 
          description="Quads, Hamstrings, Glutes"
          onClick={() => startWorkout('legs')}
          isSuggested={suggestedType?.suggestion === 'legs'}
        />
        <WorkoutTypeCard 
          type="full_body" 
          description="Complete workout"
          onClick={() => startWorkout('full_body')}
          isSuggested={suggestedType?.suggestion === 'full_body'}
        />
      </div>
      
      {/* Quick options for other styles */}
      <div className="text-center">
        <button className="text-sm text-gray-400 hover:text-gray-300 transition-colors">
          Switch to: Upper/Lower • Full Body • 5/3/1
        </button>
      </div>
      
      {/* Training pattern info if available */}
      {workoutType?.pattern && (
        <div className="mt-6 p-4 bg-blue-900/20 rounded-lg border border-blue-500/30">
          <p className="text-sm text-blue-400 mb-1">Following {workoutType.pattern} pattern</p>
          <p className="text-xs text-blue-300">Today: {workoutType.dayType} • Core: {workoutType.coreLift}</p>
        </div>
      )}
    </div>
  );
} 