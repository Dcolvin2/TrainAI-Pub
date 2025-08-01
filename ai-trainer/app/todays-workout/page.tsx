'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

// Type definitions
interface Exercise {
  name: string;
  sets?: number;
  reps?: string;
  duration?: string;
  rounds?: number;
  rest?: string;
  type: string;
  rest_seconds?: number;
}

interface WorkoutPlan {
  day: string;
  type: string;
  focus: string | null;
  duration: number;
  warmup: Exercise[];
  main: Exercise[];
  cooldown: Exercise[];
}

export default function TodaysWorkoutPage() {
  const router = useRouter();
  
  const [user, setUser] = useState<any>(null);
  const [currentWorkout, setCurrentWorkout] = useState<WorkoutPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeAvailable, setTimeAvailable] = useState(45);

  // Weekly workout schedule
  const weeklySchedule = {
    'Monday': { workout_type: 'strength', focus_muscle_group: 'legs', core_lift_name: 'back squat' },
    'Tuesday': { workout_type: 'strength', focus_muscle_group: 'chest', core_lift_name: 'bench press' },
    'Wednesday': { workout_type: 'cardio', focus_muscle_group: null, core_lift_name: null },
    'Thursday': { workout_type: 'hiit', focus_muscle_group: 'full_body', core_lift_name: null },
    'Friday': { workout_type: 'cardio', focus_muscle_group: null, core_lift_name: null },
    'Saturday': { workout_type: 'strength', focus_muscle_group: 'back', core_lift_name: 'trap bar deadlift' },
    'Sunday': { workout_type: 'rest', focus_muscle_group: null, core_lift_name: null }
  };

  // Authentication check
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUser(session.user);
      } else {
        router.push('/login');
      }
    };
    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setUser(session.user);
      } else {
        setUser(null);
        router.push('/login');
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [router]);

  // Generate workout function
  const generateWorkoutByDay = async (userId: string, duration: number = 45): Promise<WorkoutPlan | null> => {
    try {
      // Get current day
      const today = new Date().getDay();
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const currentDay = dayNames[today];
      
      console.log('Generating workout for:', currentDay);
      
      const template = weeklySchedule[currentDay as keyof typeof weeklySchedule];
      
      if (!template) {
        throw new Error(`No template found for ${currentDay}`);
      }

      // Get user's equipment
      const { data: userEquipment } = await supabase
        .from('user_equipment')
        .select('custom_name')
        .eq('user_id', userId);
      
      const availableEquipment = userEquipment?.map(item => item.custom_name) || [];
      
      // Initialize workout plan
      const workoutPlan: WorkoutPlan = {
        day: currentDay,
        type: template.workout_type,
        focus: template.focus_muscle_group,
        duration: duration,
        warmup: [],
        main: [],
        cooldown: []
      };

      // Helper function to get exercises
      const getExercises = async (phase: string, category?: string, muscle?: string) => {
        let query = supabase
          .from('exercises_final')
          .select('*')
          .eq('exercise_phase', phase);
        
        if (category) query = query.eq('category', category);
        if (muscle) query = query.eq('primary_muscle', muscle);
        
        const { data, error } = await query;
        
        if (error) {
          console.error('Exercise query error:', error);
          return [];
        }
        
        // Filter by equipment
        return (data || []).filter((exercise: any) => {
          if (!exercise.equipment_required || exercise.equipment_required.length === 0) {
            return true;
          }
          return exercise.equipment_required.some((req: string) => 
            availableEquipment.includes(req)
          );
        });
      };

      // Generate workout based on type
      switch (template.workout_type) {
        case 'strength':
          // Add core lift
          if (template.core_lift_name) {
            const coreLifts = await getExercises('core_lift');
            const coreLift = coreLifts.find((ex: any) => 
              ex.name.toLowerCase().includes(template.core_lift_name!.toLowerCase())
            );
            
            if (coreLift) {
              workoutPlan.main.push({
                name: coreLift.name,
                sets: 4,
                reps: '5-8',
                type: 'core_lift',
                rest_seconds: coreLift.rest_seconds_default || 180
              });
            }
          }
          
          // Add accessories
          const accessories = await getExercises('accessory', 'strength', template.focus_muscle_group || undefined);
          accessories.slice(0, 3).forEach((ex: any) => {
            workoutPlan.main.push({
              name: ex.name,
              sets: 3,
              reps: '8-12',
              type: 'accessory',
              rest_seconds: ex.rest_seconds_default || 120
            });
          });
          break;
          
        case 'cardio':
          workoutPlan.main = [
            { name: 'Treadmill Run', duration: '20 min', type: 'cardio' },
            { name: 'Rowing Machine', duration: '15 min', type: 'cardio' },
            { name: 'Cool Down Walk', duration: '10 min', type: 'cardio' }
          ];
          break;
          
        case 'hiit':
          workoutPlan.main = [
            { name: 'Burpees', rounds: 4, duration: '45 sec', rest: '15 sec', type: 'hiit' },
            { name: 'Mountain Climbers', rounds: 4, duration: '45 sec', rest: '15 sec', type: 'hiit' },
            { name: 'Jump Squats', rounds: 4, duration: '45 sec', rest: '15 sec', type: 'hiit' },
            { name: 'Push-ups', rounds: 4, duration: '45 sec', rest: '15 sec', type: 'hiit' }
          ];
          break;
          
        case 'rest':
          workoutPlan.main = [{
            name: 'Rest Day',
            duration: 'All day',
            type: 'rest'
          }];
          return workoutPlan; // Skip warmup/cooldown for rest days
      }

      // Add warmup and cooldown
      workoutPlan.warmup = [
        { name: 'Arm Circles', duration: '30 sec', type: 'warmup' },
        { name: 'Leg Swings', duration: '30 sec', type: 'warmup' },
        { name: 'Light Cardio', duration: '2 min', type: 'warmup' }
      ];
      
      workoutPlan.cooldown = [
        { name: 'Hamstring Stretch', duration: '30 sec', type: 'cooldown' },
        { name: 'Quad Stretch', duration: '30 sec', type: 'cooldown' },
        { name: 'Shoulder Stretch', duration: '30 sec', type: 'cooldown' }
      ];

      return workoutPlan;
      
    } catch (error) {
      console.error('Error generating workout:', error);
      return null;
    }
  };

  // Generate workout on component mount
  useEffect(() => {
    const loadWorkout = async () => {
      if (user && !currentWorkout) {
        setIsLoading(true);
        setError(null);
        
        const workout = await generateWorkoutByDay(user.id, timeAvailable);
        
        if (workout) {
          setCurrentWorkout(workout);
          
          // Save to database
          await supabase.from('generated_workouts').insert({
            user_id: user.id,
            minutes: timeAvailable,
            prompt: `Day-based workout for ${workout.day}`,
            plan: workout,
            used_model: 'day-based-system'
          });
        } else {
          setError('Failed to generate workout. Please try again.');
        }
        
        setIsLoading(false);
      }
    };
    
    loadWorkout();
  }, [user]); // Only depend on user

  // Render workout section
  const renderExercises = (exercises: Exercise[], title: string) => {
    if (exercises.length === 0) return null;
    
    return (
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4">{title}</h2>
        <div className="space-y-4">
          {exercises.map((exercise, index) => (
            <div key={index} className="bg-gray-800 p-4 rounded-lg">
              <h3 className="text-lg font-semibold">{exercise.name}</h3>
              <div className="mt-2 text-gray-400">
                {exercise.sets && <span>Sets: {exercise.sets} | </span>}
                {exercise.reps && <span>Reps: {exercise.reps} | </span>}
                {exercise.duration && <span>Duration: {exercise.duration} | </span>}
                {exercise.rounds && <span>Rounds: {exercise.rounds} | </span>}
                {exercise.rest && <span>Rest: {exercise.rest}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-xl">Generating your workout...</div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded">
          {error}
        </div>
        <button 
          onClick={() => window.location.reload()}
          className="mt-4 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Main render
  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">
          Today's Workout - {currentWorkout?.day}
        </h1>
        
        <div className="bg-gray-800 p-6 rounded-lg mb-8">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-gray-400">Type</p>
              <p className="text-xl font-semibold capitalize">{currentWorkout?.type}</p>
            </div>
            <div>
              <p className="text-gray-400">Focus</p>
              <p className="text-xl font-semibold capitalize">{currentWorkout?.focus || 'Full Body'}</p>
            </div>
            <div>
              <p className="text-gray-400">Duration</p>
              <p className="text-xl font-semibold">{currentWorkout?.duration} min</p>
            </div>
          </div>
        </div>

        {currentWorkout && (
          <>
            {renderExercises(currentWorkout.warmup, 'Warm-up')}
            {renderExercises(currentWorkout.main, 'Main Workout')}
            {renderExercises(currentWorkout.cooldown, 'Cool-down')}
          </>
        )}

        <button 
          onClick={() => setCurrentWorkout(null)}
          className="mt-8 bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg font-semibold"
        >
          Start Workout
        </button>
      </div>
    </div>
  );
} 