'use client';

import { useState, useEffect } from 'react';

interface WorkoutType {
  id: string;
  name: string;
  category: string;
  target_muscles: string[];
  movement_patterns: string[];
}

interface WorkoutTypeSelectorProps {
  userId: string;
  onWorkoutTypeSelected: (workoutType: WorkoutType) => void;
  suggestedType?: string;
}

interface WorkoutTypeCardProps {
  workoutType: WorkoutType;
  onClick: () => void;
  isSuggested?: boolean;
  isPopular?: boolean;
}

function WorkoutTypeCard({ workoutType, onClick, isSuggested, isPopular }: WorkoutTypeCardProps) {
  const getTypeColor = (name: string) => {
    switch (name) {
      case 'push': return 'bg-red-500/20 border-red-500/30 hover:bg-red-500/30';
      case 'pull': return 'bg-blue-500/20 border-blue-500/30 hover:bg-blue-500/30';
      case 'legs': return 'bg-green-500/20 border-green-500/30 hover:bg-green-500/30';
      case 'upper': return 'bg-purple-500/20 border-purple-500/30 hover:bg-purple-500/30';
      case 'lower': return 'bg-teal-500/20 border-teal-500/30 hover:bg-teal-500/30';
      case 'full_body': return 'bg-orange-500/20 border-orange-500/30 hover:bg-orange-500/30';
      case 'chest': return 'bg-pink-500/20 border-pink-500/30 hover:bg-pink-500/30';
      case 'back': return 'bg-indigo-500/20 border-indigo-500/30 hover:bg-indigo-500/30';
      case 'shoulders': return 'bg-yellow-500/20 border-yellow-500/30 hover:bg-yellow-500/30';
      case 'arms': return 'bg-cyan-500/20 border-cyan-500/30 hover:bg-cyan-500/30';
      case 'core': return 'bg-emerald-500/20 border-emerald-500/30 hover:bg-emerald-500/30';
      default: return 'bg-gray-500/20 border-gray-500/30 hover:bg-gray-500/30';
    }
  };

  const getTypeIcon = (name: string) => {
    switch (name) {
      case 'push': return '💪';
      case 'pull': return '🏋️';
      case 'legs': return '🦵';
      case 'upper': return '👆';
      case 'lower': return '👇';
      case 'full_body': return '🔥';
      case 'chest': return '❤️';
      case 'back': return '🦴';
      case 'shoulders': return '🏋️‍♂️';
      case 'arms': return '💪';
      case 'core': return '🎯';
      case 'biceps': return '💪';
      case 'triceps': return '💪';
      case 'glutes': return '🍑';
      case 'calves': return '🦵';
      default: return '⚡';
    }
  };

  const formatMuscles = (muscles: string[]) => {
    return muscles.map(muscle => 
      muscle.charAt(0).toUpperCase() + muscle.slice(1)
    ).join(', ');
  };

  return (
    <button
      onClick={onClick}
      className={`p-4 rounded-lg border-2 transition-all duration-200 ${getTypeColor(workoutType.name)} ${
        isSuggested ? 'ring-2 ring-green-400 ring-opacity-50' : ''
      } ${isPopular ? 'ring-1 ring-yellow-400 ring-opacity-30' : ''}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-2xl">{getTypeIcon(workoutType.name)}</div>
        <div className="flex gap-1">
          {isSuggested && (
            <span className="text-xs bg-green-500 text-white px-2 py-1 rounded">AI</span>
          )}
          {isPopular && (
            <span className="text-xs bg-yellow-500 text-black px-2 py-1 rounded">Popular</span>
          )}
        </div>
      </div>
      <div className="text-lg font-bold mb-1 capitalize">
        {workoutType.name.replace('_', ' ')}
      </div>
      <div className="text-xs text-gray-300">
        {formatMuscles(workoutType.target_muscles)}
      </div>
    </button>
  );
}

export default function WorkoutTypeSelector({ 
  userId, 
  onWorkoutTypeSelected, 
  suggestedType 
}: WorkoutTypeSelectorProps) {
  const [workoutTypes, setWorkoutTypes] = useState<WorkoutType[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  useEffect(() => {
    fetchWorkoutTypes();
  }, []);

  const fetchWorkoutTypes = async () => {
    try {
      const response = await fetch('/api/workoutTypes');
      const data = await response.json();
      setWorkoutTypes(data);
    } catch (error) {
      console.error('Error fetching workout types:', error);
    } finally {
      setLoading(false);
    }
  };

  const popularTypes = ['push', 'pull', 'legs', 'upper', 'full_body'];
  const splitRoutines = ['push', 'pull', 'legs', 'upper', 'lower', 'full_body'];
  const muscleGroups = ['chest', 'back', 'shoulders', 'arms', 'core'];
  const specificFocus = ['biceps', 'triceps', 'glutes', 'calves'];

  const getWorkoutTypesByCategory = (category: string) => {
    return workoutTypes.filter(wt => wt.category === category);
  };

  const getPopularWorkoutTypes = () => {
    return workoutTypes.filter(wt => popularTypes.includes(wt.name));
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading workout types...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6 text-center">Choose Your Workout</h2>
      
      {/* AI Suggestion */}
      {suggestedType && (
        <div className="mb-6 p-4 bg-green-900/20 rounded-lg border border-green-500/30">
          <p className="text-sm text-green-400 mb-2">AI Suggestion based on your training:</p>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-bold text-green-400 capitalize">
                {suggestedType.replace('_', ' ')} Day
              </div>
              <div className="text-sm text-green-300">Optimal progression from your last workout</div>
            </div>
            <button 
              onClick={() => {
                const suggested = workoutTypes.find(wt => wt.name === suggestedType);
                if (suggested) onWorkoutTypeSelected(suggested);
              }}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            >
              Start Suggested
            </button>
          </div>
        </div>
      )}

      {/* Popular Quick Selections */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4 text-yellow-400">Popular Quick Selections</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {getPopularWorkoutTypes().map((workoutType) => (
            <WorkoutTypeCard
              key={workoutType.id}
              workoutType={workoutType}
              onClick={() => onWorkoutTypeSelected(workoutType)}
              isSuggested={suggestedType === workoutType.name}
              isPopular={true}
            />
          ))}
        </div>
      </div>

      {/* Expandable Categories */}
      <div className="space-y-6">
        {/* Split Routines */}
        <div>
          <button
            onClick={() => setExpandedCategory(expandedCategory === 'split' ? null : 'split')}
            className="flex items-center justify-between w-full p-4 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <span className="text-lg font-semibold">Split Routines</span>
            <span className="text-gray-400">
              {expandedCategory === 'split' ? '−' : '+'}
            </span>
          </button>
          {expandedCategory === 'split' && (
            <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-3">
              {getWorkoutTypesByCategory('split').map((workoutType) => (
                <WorkoutTypeCard
                  key={workoutType.id}
                  workoutType={workoutType}
                  onClick={() => onWorkoutTypeSelected(workoutType)}
                  isSuggested={suggestedType === workoutType.name}
                />
              ))}
            </div>
          )}
        </div>

        {/* Muscle Groups */}
        <div>
          <button
            onClick={() => setExpandedCategory(expandedCategory === 'muscle_group' ? null : 'muscle_group')}
            className="flex items-center justify-between w-full p-4 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <span className="text-lg font-semibold">Muscle Groups</span>
            <span className="text-gray-400">
              {expandedCategory === 'muscle_group' ? '−' : '+'}
            </span>
          </button>
          {expandedCategory === 'muscle_group' && (
            <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-3">
              {getWorkoutTypesByCategory('muscle_group').map((workoutType) => (
                <WorkoutTypeCard
                  key={workoutType.id}
                  workoutType={workoutType}
                  onClick={() => onWorkoutTypeSelected(workoutType)}
                  isSuggested={suggestedType === workoutType.name}
                />
              ))}
            </div>
          )}
        </div>

        {/* Specific Focus */}
        <div>
          <button
            onClick={() => setExpandedCategory(expandedCategory === 'specific' ? null : 'specific')}
            className="flex items-center justify-between w-full p-4 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <span className="text-lg font-semibold">Specific Focus</span>
            <span className="text-gray-400">
              {expandedCategory === 'specific' ? '−' : '+'}
            </span>
          </button>
          {expandedCategory === 'specific' && (
            <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-3">
              {getWorkoutTypesByCategory('specific').map((workoutType) => (
                <WorkoutTypeCard
                  key={workoutType.id}
                  workoutType={workoutType}
                  onClick={() => onWorkoutTypeSelected(workoutType)}
                  isSuggested={suggestedType === workoutType.name}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 