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

export default function WorkoutTypeSelector({ 
  userId, 
  onWorkoutTypeSelected, 
  suggestedType 
}: WorkoutTypeSelectorProps) {
  const [workoutTypes, setWorkoutTypes] = useState<WorkoutType[]>([]);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWorkoutTypes();
  }, []);

  const fetchWorkoutTypes = async () => {
    try {
      const response = await fetch('/api/workoutTypes');
      const data = await response.json();
      setWorkoutTypes(data.workoutTypes || []);
    } catch (error) {
      console.error('Error fetching workout types:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWorkoutTypeClick = (workoutType: WorkoutType) => {
    onWorkoutTypeSelected(workoutType);
  };

  const getWorkoutTypeColor = (category: string) => {
    const colors: { [key: string]: string } = {
      'push': 'bg-red-600 hover:bg-red-700',
      'pull': 'bg-blue-600 hover:bg-blue-700',
      'legs': 'bg-green-600 hover:bg-green-700',
      'upper': 'bg-purple-600 hover:bg-purple-700',
      'lower': 'bg-orange-600 hover:bg-orange-700',
      'full_body': 'bg-indigo-600 hover:bg-indigo-700',
      'chest': 'bg-pink-600 hover:bg-pink-700',
      'back': 'bg-teal-600 hover:bg-teal-700',
      'shoulders': 'bg-yellow-600 hover:bg-yellow-700',
      'arms': 'bg-cyan-600 hover:bg-cyan-700',
      'biceps': 'bg-emerald-600 hover:bg-emerald-700',
      'triceps': 'bg-violet-600 hover:bg-violet-700',
      'core': 'bg-amber-600 hover:bg-amber-700',
      'glutes': 'bg-rose-600 hover:bg-rose-700',
      'calves': 'bg-lime-600 hover:bg-lime-700'
    };
    return colors[category] || 'bg-gray-600 hover:bg-gray-700';
  };

  const formatMuscles = (muscles: string[]) => {
    return muscles.map(muscle => 
      muscle.charAt(0).toUpperCase() + muscle.slice(1)
    ).join(', ');
  };

  const popularTypes = workoutTypes.filter(type => 
    ['push', 'pull', 'legs', 'upper', 'full_body'].includes(type.name)
  );

  const splitRoutines = workoutTypes.filter(type => 
    ['push', 'pull', 'legs', 'upper', 'lower'].includes(type.name)
  );

  const muscleGroups = workoutTypes.filter(type => 
    ['chest', 'back', 'shoulders', 'arms', 'biceps', 'triceps'].includes(type.name)
  );

  const specificFocus = workoutTypes.filter(type => 
    ['core', 'glutes', 'calves'].includes(type.name)
  );

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-lg p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-4"></div>
        <p className="text-gray-400">Loading workout types...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* AI Suggestion */}
      {suggestedType && (
        <div className="bg-gradient-to-r from-blue-900 to-purple-900 rounded-lg p-6 border border-blue-500">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white text-sm">🤖</span>
            </div>
            <h3 className="text-lg font-semibold text-white">AI Suggestion</h3>
          </div>
          <p className="text-gray-300 mb-4">
            Based on your recent workouts, I suggest a <strong className="text-blue-300">{suggestedType.replace('_', ' ')}</strong> workout today.
          </p>
          <button
            onClick={() => {
              const suggestedWorkoutType = workoutTypes.find(type => type.name === suggestedType);
              if (suggestedWorkoutType) {
                handleWorkoutTypeClick(suggestedWorkoutType);
              }
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Try {suggestedType.replace('_', ' ')} Workout
          </button>
        </div>
      )}

      {/* Popular Quick Selections */}
      <div className="bg-gray-900 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 text-white">Popular Quick Selections</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {popularTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => handleWorkoutTypeClick(type)}
              className={`${getWorkoutTypeColor(type.name)} text-white p-4 rounded-lg text-center transition-colors`}
            >
              <div className="font-semibold text-lg mb-1">
                {type.name.replace('_', ' ').toUpperCase()}
              </div>
              <div className="text-xs opacity-90">
                {formatMuscles(type.target_muscles)}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Split Routines */}
      <div className="bg-gray-900 rounded-lg p-6">
        <button
          onClick={() => setExpandedCategory(expandedCategory === 'splits' ? null : 'splits')}
          className="flex justify-between items-center w-full text-left"
        >
          <h3 className="text-lg font-semibold text-white">Split Routines</h3>
          <span className="text-gray-400 text-xl">
            {expandedCategory === 'splits' ? '−' : '+'}
          </span>
        </button>
        {expandedCategory === 'splits' && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
            {splitRoutines.map((type) => (
              <button
                key={type.id}
                onClick={() => handleWorkoutTypeClick(type)}
                className={`${getWorkoutTypeColor(type.name)} text-white p-3 rounded-lg text-center transition-colors`}
              >
                <div className="font-medium mb-1">
                  {type.name.replace('_', ' ').toUpperCase()}
                </div>
                <div className="text-xs opacity-90">
                  {formatMuscles(type.target_muscles)}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Muscle Groups */}
      <div className="bg-gray-900 rounded-lg p-6">
        <button
          onClick={() => setExpandedCategory(expandedCategory === 'muscles' ? null : 'muscles')}
          className="flex justify-between items-center w-full text-left"
        >
          <h3 className="text-lg font-semibold text-white">Muscle Groups</h3>
          <span className="text-gray-400 text-xl">
            {expandedCategory === 'muscles' ? '−' : '+'}
          </span>
        </button>
        {expandedCategory === 'muscles' && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
            {muscleGroups.map((type) => (
              <button
                key={type.id}
                onClick={() => handleWorkoutTypeClick(type)}
                className={`${getWorkoutTypeColor(type.name)} text-white p-3 rounded-lg text-center transition-colors`}
              >
                <div className="font-medium mb-1">
                  {type.name.replace('_', ' ').toUpperCase()}
                </div>
                <div className="text-xs opacity-90">
                  {formatMuscles(type.target_muscles)}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Specific Focus */}
      <div className="bg-gray-900 rounded-lg p-6">
        <button
          onClick={() => setExpandedCategory(expandedCategory === 'focus' ? null : 'focus')}
          className="flex justify-between items-center w-full text-left"
        >
          <h3 className="text-lg font-semibold text-white">Specific Focus</h3>
          <span className="text-gray-400 text-xl">
            {expandedCategory === 'focus' ? '−' : '+'}
          </span>
        </button>
        {expandedCategory === 'focus' && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
            {specificFocus.map((type) => (
              <button
                key={type.id}
                onClick={() => handleWorkoutTypeClick(type)}
                className={`${getWorkoutTypeColor(type.name)} text-white p-3 rounded-lg text-center transition-colors`}
              >
                <div className="font-medium mb-1">
                  {type.name.replace('_', ' ').toUpperCase()}
                </div>
                <div className="text-xs opacity-90">
                  {formatMuscles(type.target_muscles)}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 