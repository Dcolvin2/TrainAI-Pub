'use client';

import { useState, useEffect } from 'react';
import WorkoutTypeSelector from '@/app/components/WorkoutTypeSelector';
import WorkoutDisplay from '@/app/components/WorkoutDisplay';
import ChatPanel from '@/app/components/ChatPanel';
import { generateWorkoutForType, getWorkoutSuggestions } from '@/lib/workoutGenerator';

interface WorkoutType {
  id: string;
  name: string;
  category: string;
  target_muscles: string[];
  movement_patterns: string[];
}

interface GeneratedWorkout {
  type: WorkoutType;
  warmup: any[];
  mainExercises: any[];
  accessories: any[];
  cooldown: any[];
  duration: number;
  focus: string;
}

export default function WorkoutPage() {
  const [selectedType, setSelectedType] = useState<WorkoutType | null>(null);
  const [timeAvailable, setTimeAvailable] = useState(45);
  const [generatedWorkout, setGeneratedWorkout] = useState<GeneratedWorkout | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestedType, setSuggestedType] = useState<string | undefined>(undefined);
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

  const generateWorkout = async (workoutType: WorkoutType, timeMinutes: number) => {
    setLoading(true);
    try {
      // Adjust exercise count based on time
      const exerciseCount = Math.floor(timeMinutes / 8); // ~8 min per exercise
      
      const workout = await generateWorkoutForType(workoutType, userId);
      
      // Adjust workout based on time
      const adjustedWorkout = adjustWorkoutForTime(workout, timeMinutes);
      
      setGeneratedWorkout(adjustedWorkout);
      setSelectedType(workoutType);
    } catch (error) {
      console.error('Error generating workout:', error);
    } finally {
      setLoading(false);
    }
  };

  const adjustWorkoutForTime = (workout: GeneratedWorkout, timeMinutes: number) => {
    const adjustedWorkout = { ...workout };
    
    // Calculate time allocation
    const warmupTime = Math.min(5, timeMinutes * 0.1); // 10% or 5 min max
    const mainTime = timeMinutes * 0.6; // 60% for main exercises
    const accessoryTime = timeMinutes * 0.25; // 25% for accessories
    const cooldownTime = Math.min(5, timeMinutes * 0.05); // 5% or 5 min max
    
    // Adjust main exercises based on time
    const mainExerciseCount = Math.max(1, Math.floor(mainTime / 8));
    adjustedWorkout.mainExercises = workout.mainExercises.slice(0, mainExerciseCount);
    
    // Adjust accessories based on time
    const accessoryCount = Math.max(2, Math.floor(accessoryTime / 6));
    adjustedWorkout.accessories = workout.accessories.slice(0, accessoryCount);
    
    adjustedWorkout.duration = timeMinutes;
    
    return adjustedWorkout;
  };

  const handleWorkoutTypeSelected = (workoutType: WorkoutType) => {
    generateWorkout(workoutType, timeAvailable);
  };

  const handleWorkoutUpdate = (updatedWorkout: GeneratedWorkout) => {
    setGeneratedWorkout(updatedWorkout);
  };

  const handleStartWorkout = () => {
    // Navigate to active workout page or start timer
    console.log('Starting workout:', generatedWorkout);
    // In real app, navigate to /workout/active with workout data
  };

  return (
    <div className="min-h-screen bg-gray-950 p-4">
      {/* Step 1: Time and Type Selection */}
      {!selectedType && (
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-8 text-center">Today's Workout</h1>
          
          {/* Time Selector */}
          <div className="mb-8 bg-gray-900 p-6 rounded-lg">
            <label className="text-white text-lg mb-4 block text-center">Time Available:</label>
            <div className="flex items-center gap-4">
              <input 
                type="range" 
                min="15" 
                max="90" 
                step="15"
                value={timeAvailable}
                onChange={(e) => setTimeAvailable(Number(e.target.value))}
                className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
              />
              <span className="text-white text-xl font-bold w-20 text-center">{timeAvailable} min</span>
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-2">
              <span>15 min</span>
              <span>45 min</span>
              <span>90 min</span>
            </div>
          </div>

          {/* Workout Type Selector */}
          <WorkoutTypeSelector 
            userId={userId}
            onWorkoutTypeSelected={handleWorkoutTypeSelected}
            suggestedType={suggestedType}
          />
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="max-w-4xl mx-auto">
          <div className="bg-gray-900 rounded-lg p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400 mx-auto mb-4"></div>
            <p className="text-gray-400">Generating your {selectedType?.name.replace('_', ' ')} workout...</p>
          </div>
        </div>
      )}

      {/* Step 2: Generated Workout Display */}
      {generatedWorkout && !loading && (
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">
              {selectedType?.name.replace('_', ' ')} Workout ({timeAvailable} min)
            </h2>
            <div className="flex gap-2">
              <button 
                onClick={() => setShowChat(!showChat)}
                className="bg-blue-600 px-4 py-2 rounded-lg text-white hover:bg-blue-700 transition-colors"
              >
                Modify Workout
              </button>
              <button 
                onClick={handleStartWorkout}
                className="bg-green-600 px-4 py-2 rounded-lg text-white hover:bg-green-700 transition-colors"
              >
                Start Workout
              </button>
            </div>
          </div>

          <WorkoutDisplay workout={generatedWorkout} />
          
          {/* Chat Panel - Slides in from right */}
          {showChat && (
            <ChatPanel 
              workout={generatedWorkout}
              onUpdate={handleWorkoutUpdate}
              onClose={() => setShowChat(false)}
            />
          )}
        </div>
      )}
    </div>
  );
} 