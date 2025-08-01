'use client';

import { useEffect, useState, useRef } from 'react';
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
  accessories: Exercise[];
  cooldown: Exercise[];
}

interface ChatMessage {
  sender: 'user' | 'assistant';
  text: string;
  timestamp?: string;
}

// Core → Accessories Mapping Logic
const accessoryMap: Record<string, Array<{ name: string; sets: number; reps: string; equipment?: string }>> = {
  "Barbell Back Squat": [
    { name: "Walking Lunges", sets: 3, reps: "12 each leg", equipment: "dumbbells" },
    { name: "Glute Bridges", sets: 3, reps: "15", equipment: "bodyweight" },
    { name: "Bulgarian Split Squats", sets: 3, reps: "10 each leg", equipment: "dumbbells" },
    { name: "Hamstring Curls", sets: 3, reps: "12", equipment: "machine" },
    { name: "Leg Extensions", sets: 3, reps: "12", equipment: "machine" },
    { name: "Calf Raises", sets: 3, reps: "15", equipment: "bodyweight" }
  ],
  "Dumbbell Bench Press": [
    { name: "Incline Dumbbell Press", sets: 3, reps: "10-12", equipment: "dumbbells" },
    { name: "Chest Fly (Bands or Dumbbells)", sets: 3, reps: "12", equipment: "dumbbells" },
    { name: "Triceps Dips", sets: 3, reps: "10", equipment: "bodyweight" },
    { name: "Overhead Triceps Extension", sets: 3, reps: "12", equipment: "dumbbells" },
    { name: "Push-ups", sets: 3, reps: "10-15", equipment: "bodyweight" },
    { name: "Decline Push-ups", sets: 3, reps: "8-12", equipment: "bodyweight" }
  ],
  "Barbell Bench Press": [
    { name: "Incline Dumbbell Press", sets: 3, reps: "10-12", equipment: "dumbbells" },
    { name: "Chest Fly (Bands or Dumbbells)", sets: 3, reps: "12", equipment: "dumbbells" },
    { name: "Triceps Dips", sets: 3, reps: "10", equipment: "bodyweight" },
    { name: "Overhead Triceps Extension", sets: 3, reps: "12", equipment: "dumbbells" },
    { name: "Push-ups", sets: 3, reps: "10-15", equipment: "bodyweight" },
    { name: "Decline Push-ups", sets: 3, reps: "8-12", equipment: "bodyweight" }
  ],
  "Trap Bar Deadlift": [
    { name: "Barbell Rows", sets: 3, reps: "10", equipment: "barbell" },
    { name: "Lat Pulldowns", sets: 3, reps: "12", equipment: "machine" },
    { name: "Face Pulls", sets: 3, reps: "15", equipment: "cable" },
    { name: "Banded Pull-Aparts", sets: 3, reps: "20", equipment: "bands" },
    { name: "Single-Arm Dumbbell Rows", sets: 3, reps: "10 each arm", equipment: "dumbbells" },
    { name: "Reverse Flyes", sets: 3, reps: "12", equipment: "dumbbells" }
  ],
  "Conventional Deadlift": [
    { name: "Barbell Rows", sets: 3, reps: "10", equipment: "barbell" },
    { name: "Lat Pulldowns", sets: 3, reps: "12", equipment: "machine" },
    { name: "Face Pulls", sets: 3, reps: "15", equipment: "cable" },
    { name: "Banded Pull-Aparts", sets: 3, reps: "20", equipment: "bands" },
    { name: "Single-Arm Dumbbell Rows", sets: 3, reps: "10 each arm", equipment: "dumbbells" },
    { name: "Reverse Flyes", sets: 3, reps: "12", equipment: "dumbbells" }
  ],
  "Overhead Press": [
    { name: "Lateral Raises", sets: 3, reps: "12", equipment: "dumbbells" },
    { name: "Front Raises", sets: 3, reps: "12", equipment: "dumbbells" },
    { name: "Rear Delt Flyes", sets: 3, reps: "12", equipment: "dumbbells" },
    { name: "Upright Rows", sets: 3, reps: "10", equipment: "barbell" },
    { name: "Arnold Press", sets: 3, reps: "10", equipment: "dumbbells" },
    { name: "Pike Push-ups", sets: 3, reps: "8-12", equipment: "bodyweight" }
  ]
};

export default function TodaysWorkoutPage() {
  const router = useRouter();
  
  const [user, setUser] = useState<any>(null);
  const [currentWorkout, setCurrentWorkout] = useState<WorkoutPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeAvailable, setTimeAvailable] = useState(45);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const chatHistoryRef = useRef<HTMLDivElement>(null);

  // Weekly workout schedule with core lifts
  const weeklySchedule = {
    'Monday': { 
      workout_type: 'strength', 
      focus_muscle_group: 'legs', 
      core_lift_name: 'Barbell Back Squat',
      core_lift_sets: 4,
      core_lift_reps: '5-8'
    },
    'Tuesday': { 
      workout_type: 'strength', 
      focus_muscle_group: 'chest', 
      core_lift_name: 'Barbell Bench Press',
      core_lift_sets: 4,
      core_lift_reps: '5-8'
    },
    'Wednesday': { 
      workout_type: 'cardio', 
      focus_muscle_group: null, 
      core_lift_name: null,
      core_lift_sets: 0,
      core_lift_reps: ''
    },
    'Thursday': { 
      workout_type: 'hiit', 
      focus_muscle_group: 'full_body', 
      core_lift_name: null,
      core_lift_sets: 0,
      core_lift_reps: ''
    },
    'Friday': { 
      workout_type: 'cardio', 
      focus_muscle_group: null, 
      core_lift_name: null,
      core_lift_sets: 0,
      core_lift_reps: ''
    },
    'Saturday': { 
      workout_type: 'strength', 
      focus_muscle_group: 'back', 
      core_lift_name: 'Trap Bar Deadlift',
      core_lift_sets: 4,
      core_lift_reps: '5-8'
    },
    'Sunday': { 
      workout_type: 'rest', 
      focus_muscle_group: null, 
      core_lift_name: null,
      core_lift_sets: 0,
      core_lift_reps: ''
    }
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

  // Auto-scroll chat to bottom when new messages are added
  useEffect(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Helper function to get random accessories for a core lift
  const getRandomAccessories = (coreLiftName: string, count: number = 3): Exercise[] => {
    const accessories = accessoryMap[coreLiftName] || [];
    
    if (accessories.length === 0) {
      return [];
    }

    // Shuffle and take the first 'count' items
    const shuffled = [...accessories].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count).map(acc => ({
      name: acc.name,
      sets: acc.sets,
      reps: acc.reps,
      type: 'accessory',
      rest_seconds: 90
    }));
  };

  // Generate workout function
  const generateWorkoutByDay = async (userId: string, duration: number = 45, specificDay?: string): Promise<WorkoutPlan | null> => {
    try {
      // Get current day or use specific day
      const today = new Date().getDay();
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const currentDay = specificDay || dayNames[today];
      
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
        accessories: [],
        cooldown: []
      };

      // Generate workout based on type
      switch (template.workout_type) {
        case 'strength':
          // Add core lift
          if (template.core_lift_name) {
            workoutPlan.main.push({
              name: template.core_lift_name,
              sets: template.core_lift_sets,
              reps: template.core_lift_reps,
              type: 'core_lift',
              rest_seconds: 180
            });
            
            // Add accessories based on core lift
            const accessories = getRandomAccessories(template.core_lift_name, 3);
            workoutPlan.accessories = accessories;
          }
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

  // Handle chat messages
  const handleChatMessage = async (message: string) => {
    if (!message.trim()) return;

    // Add user message to chat
    setChatMessages(prev => [...prev, { 
      sender: 'user', 
      text: message, 
      timestamp: new Date().toLocaleTimeString() 
    }]);

    const lowerMessage = message.toLowerCase();

    // Check for day-specific commands
    const dayMatch = lowerMessage.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
    if (dayMatch && user?.id) {
      const requestedDay = dayMatch[1][0].toUpperCase() + dayMatch[1].slice(1).toLowerCase();
      
      // Look for time specification
      const timeMatch = message.match(/(\d+)\s*minutes?/i);
      const duration = timeMatch ? parseInt(timeMatch[1], 10) : timeAvailable;

      try {
        const workout = await generateWorkoutByDay(user.id, duration, requestedDay);
        
        if (workout) {
          setCurrentWorkout(workout);
          
          // Create detailed response based on workout type
          let responseText = `Generated your ${workout.type} workout for ${workout.day}. `;
          
          if (workout.type === 'strength' && workout.main.length > 0) {
            const coreLift = workout.main[0];
            responseText += `Core lift: ${coreLift.name} (${coreLift.sets} sets, ${coreLift.reps}). `;
            responseText += `Added ${workout.accessories.length} accessories targeting similar muscle groups. `;
          } else if (workout.type === 'cardio') {
            responseText += `Focus: cardiovascular endurance. `;
          } else if (workout.type === 'hiit') {
            responseText += `Focus: high-intensity intervals. `;
          }
          
          responseText += `Duration: ${workout.duration} minutes.`;
          
          // Add assistant response
          setChatMessages(prev => [...prev, { 
            sender: 'assistant', 
            text: responseText, 
            timestamp: new Date().toLocaleTimeString() 
          }]);

          // Save to database
          await supabase.from('generated_workouts').insert({
            user_id: user.id,
            minutes: duration,
            prompt: `Day-based workout for ${workout.day}`,
            plan: workout,
            used_model: 'day-based-system'
          });
        } else {
          setChatMessages(prev => [...prev, { 
            sender: 'assistant', 
            text: `Sorry, I couldn't generate a ${requestedDay} workout. Please try again.`, 
            timestamp: new Date().toLocaleTimeString() 
          }]);
        }
      } catch (error) {
        console.error('Error generating workout:', error);
        setChatMessages(prev => [...prev, { 
          sender: 'assistant', 
          text: `Sorry, I couldn't generate a ${requestedDay} workout. Please try again.`, 
          timestamp: new Date().toLocaleTimeString() 
        }]);
      }
      return;
    }

    // Check for time adjustment
    const timeMatch = message.match(/(?:i have|only|just)\s+(\d+)\s*minutes?/i);
    if (timeMatch) {
      const newTime = parseInt(timeMatch[1], 10);
      if (newTime >= 5 && newTime <= 120) {
        setTimeAvailable(newTime);
        setChatMessages(prev => [...prev, { 
          sender: 'assistant', 
          text: `Got it! I'll adjust workouts for ${newTime} minutes.`, 
          timestamp: new Date().toLocaleTimeString() 
        }]);
        return;
      }
    }

    // Check for regenerate command
    if (lowerMessage.includes('regenerate') || lowerMessage.includes('new workout')) {
      if (user?.id) {
        const workout = await generateWorkoutByDay(user.id, timeAvailable);
        if (workout) {
          setCurrentWorkout(workout);
          setChatMessages(prev => [...prev, { 
            sender: 'assistant', 
            text: `Generated a new ${workout.type} workout for ${workout.day}.`, 
            timestamp: new Date().toLocaleTimeString() 
          }]);
        }
      }
      return;
    }

    // Default response for unrecognized commands
    setChatMessages(prev => [...prev, { 
      sender: 'assistant', 
      text: `Try saying "it's Monday" or "it's Friday" to generate a specific day's workout, or "I have 30 minutes" to adjust the duration.`, 
      timestamp: new Date().toLocaleTimeString() 
    }]);
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
          
          // Add initial chat message
          let welcomeMessage = `Generated your ${workout.type} workout for ${workout.day}. `;
          
          if (workout.type === 'strength' && workout.main.length > 0) {
            const coreLift = workout.main[0];
            welcomeMessage += `Core lift: ${coreLift.name}. `;
          }
          
          welcomeMessage += `Say "it's Monday" or "it's Friday" to generate other days!`;
          
          setChatMessages([{ 
            sender: 'assistant', 
            text: welcomeMessage, 
            timestamp: new Date().toLocaleTimeString() 
          }]);
          
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
        
        {/* Chat Interface */}
        <div className="bg-gray-800 rounded-lg mb-8">
          <div className="p-4 border-b border-gray-700">
            <h3 className="text-lg font-semibold">AI Workout Coach</h3>
          </div>
          
          <div className="h-64 flex flex-col">
            <div 
              className="flex-1 overflow-y-auto p-4 space-y-3"
              ref={chatHistoryRef}
            >
              {chatMessages.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  <p className="text-sm">Ask your coach anything...</p>
                  <p className="text-xs mt-1">Try: "it's Monday" or "it's Friday"</p>
                </div>
              ) : (
                chatMessages.map((message, index) => (
                  <div key={index} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs lg:max-w-md px-3 py-2 rounded-lg text-sm ${
                      message.sender === 'user'
                        ? 'bg-green-600 text-white rounded-br-md'
                        : 'bg-gray-700 text-white rounded-bl-md'
                    }`}>
                      <div className="whitespace-pre-wrap">{message.text}</div>
                      {message.timestamp && (
                        <div className={`text-xs text-gray-300 mt-1 ${message.sender === 'user' ? 'text-right' : 'text-left'}`}>
                          {message.timestamp}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <div className="p-4 border-t border-gray-700">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && inputText.trim()) {
                      const message = inputText.trim();
                      setInputText('');
                      handleChatMessage(message);
                    }
                  }}
                  placeholder="Ask your coach anything..."
                  className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-green-500 focus:outline-none"
                />
                <button
                  onClick={() => {
                    if (inputText.trim()) {
                      const message = inputText.trim();
                      setInputText('');
                      handleChatMessage(message);
                    }
                  }}
                  className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg font-semibold"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
        
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
            {renderExercises(currentWorkout.accessories, 'Accessories')}
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