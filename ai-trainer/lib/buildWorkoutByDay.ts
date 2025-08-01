import { supabase } from './supabaseClient';

interface WorkoutPlan {
  day: string;
  type: string;
  focus: string | null;
  duration: number;
  warmup: Array<{
    name: string;
    duration: string;
    type: string;
  }>;
  main: Array<{
    name: string;
    sets?: number;
    reps?: string;
    duration?: string;
    rounds?: number;
    rest?: string;
    rest_seconds?: number;
    type: string;
    description?: string;
  }>;
  cooldown: Array<{
    name: string;
    duration: string;
    type: string;
  }>;
}

// Day-Based Workout Generation Code (Refactored to prevent infinite loops)
export const generateWorkoutByDay = async (userId: string, timeAvailable: number = 45): Promise<WorkoutPlan | null> => {
  try {
    // Get current day of week (0 = Sunday, 1 = Monday, etc.)
    const today = new Date().getDay();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDay = dayNames[today];
    
    console.log('Current day:', currentDay, 'Day number:', today);
    
    // Define weekly workout structure (since weekly_workout_template doesn't exist)
    const weeklySchedule = {
      'Monday': { workout_type: 'strength', focus_muscle_group: 'legs', core_lift_name: 'back squat' },
      'Tuesday': { workout_type: 'strength', focus_muscle_group: 'chest', core_lift_name: 'bench press' },
      'Wednesday': { workout_type: 'cardio', focus_muscle_group: null, core_lift_name: null },
      'Thursday': { workout_type: 'hiit', focus_muscle_group: 'full_body', core_lift_name: null },
      'Friday': { workout_type: 'cardio', focus_muscle_group: null, core_lift_name: null },
      'Saturday': { workout_type: 'strength', focus_muscle_group: 'back', core_lift_name: 'trap bar deadlift' },
      'Sunday': { workout_type: 'rest', focus_muscle_group: null, core_lift_name: null }
    };
    
    const template = weeklySchedule[currentDay as keyof typeof weeklySchedule];
    
    if (!template) {
      console.error('No template found for', currentDay);
      return null;
    }
    
    console.log('Workout template for', currentDay, ':', template);
    
    // Get user's equipment
    const { data: userEquipment, error: equipError } = await supabase
      .from('user_equipment')
      .select('custom_name')
      .eq('user_id', userId);
      
    if (equipError) {
      console.error('Equipment error:', equipError);
      // Continue without equipment filtering rather than failing
    }
    
    const availableEquipment = userEquipment ? userEquipment.map((item: any) => item.custom_name) : [];
    console.log('User equipment:', availableEquipment);
    
    // Initialize workout plan
    let workoutPlan: WorkoutPlan = {
      day: currentDay,
      type: template.workout_type,
      focus: template.focus_muscle_group,
      duration: timeAvailable,
      warmup: [],
      main: [],
      cooldown: []
    };
    
    // Helper function to get filtered exercises with error handling
    const getFilteredExercises = async (phase: string, category: string | null = null, primaryMuscle: string | null = null) => {
      try {
        let query = supabase
          .from('exercises_final') // Use exercises_final table
          .select('*')
          .eq('exercise_phase', phase);
          
        if (category) query = query.eq('category', category);
        if (primaryMuscle) query = query.eq('primary_muscle', primaryMuscle);
        
        const { data: exercises, error } = await query;
        
        if (error) {
          console.error('Exercise query error:', error);
          return [];
        }
        
        // Filter by available equipment
        return exercises.filter((exercise: any) => {
          if (!exercise.equipment_required || exercise.equipment_required.length === 0) {
            return true; // Bodyweight exercises
          }
          // Check if user has at least one required equipment
          return exercise.equipment_required.some((req: string) => 
            availableEquipment.some((equip: string) => 
              equip.toLowerCase().includes(req.toLowerCase())
            )
          );
        });
      } catch (error) {
        console.error('Error in getFilteredExercises:', error);
        return [];
      }
    };
    
    // Generate workout based on type
    try {
      switch (template.workout_type) {
        case 'strength':
          // Add core lift if specified
          if (template.core_lift_name) {
            const coreLifts = await getFilteredExercises('core_lift');
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
          
          // Add accessory exercises
          const accessories = await getFilteredExercises('accessory', 'strength', template.focus_muscle_group);
          const selectedAccessories = accessories.slice(0, 3);
          
          selectedAccessories.forEach((ex: any) => {
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
          const cardioExercises = await getFilteredExercises('main', 'cardio');
          const selectedCardio = cardioExercises.length > 0 ? cardioExercises.slice(0, 2) : [
            { name: 'Treadmill Run', set_duration_seconds: 900 },
            { name: 'Stationary Bike', set_duration_seconds: 900 }
          ];
          
          selectedCardio.forEach((ex: any) => {
            workoutPlan.main.push({
              name: ex.name,
              duration: `${Math.round((ex.set_duration_seconds || 900) / 60)} min`,
              type: 'cardio'
            });
          });
          break;
          
        case 'hiit':
          const hiitExercises = await getFilteredExercises('main');
          let hiitSelection = hiitExercises
            .filter((ex: any) => ex.category === 'conditioning' || ex.primary_muscle === 'full_body')
            .slice(0, 5);
            
          // Always provide HIIT exercises even if no equipment
          if (hiitSelection.length < 4) {
            workoutPlan.main = [
              { name: 'Burpees', rounds: 4, duration: '45 sec', rest: '15 sec', type: 'hiit' },
              { name: 'Mountain Climbers', rounds: 4, duration: '45 sec', rest: '15 sec', type: 'hiit' },
              { name: 'Jump Squats', rounds: 4, duration: '45 sec', rest: '15 sec', type: 'hiit' },
              { name: 'Push-ups', rounds: 4, duration: '45 sec', rest: '15 sec', type: 'hiit' }
            ];
          } else {
            hiitSelection.forEach((ex: any) => {
              workoutPlan.main.push({
                name: ex.name,
                rounds: 4,
                duration: '45 sec',
                rest: '15 sec',
                type: 'hiit'
              });
            });
          }
          break;
          
        case 'rest':
          workoutPlan.main.push({
            name: 'Rest Day',
            description: 'Take a well-deserved rest or do light stretching',
            type: 'rest'
          });
          break;
          
        default:
          console.error('Unknown workout type:', template.workout_type);
          return null;
      }
      
      // Add warmup and cooldown (don't fail if these don't exist)
      if (template.workout_type !== 'rest') {
        const warmupExercises = await getFilteredExercises('warmup');
        const cooldownExercises = await getFilteredExercises('cooldown');
        
        workoutPlan.warmup = warmupExercises.slice(0, 3).map((ex: any) => ({
          name: ex.name,
          duration: '30 sec',
          type: 'warmup'
        }));
        
        // If no warmup exercises found, add defaults
        if (workoutPlan.warmup.length === 0) {
          workoutPlan.warmup = [
            { name: 'Arm Circles', duration: '30 sec', type: 'warmup' },
            { name: 'Leg Swings', duration: '30 sec', type: 'warmup' },
            { name: 'Light Cardio', duration: '2 min', type: 'warmup' }
          ];
        }
        
        workoutPlan.cooldown = cooldownExercises.slice(0, 3).map((ex: any) => ({
          name: ex.name,
          duration: '30 sec',
          type: 'cooldown'
        }));
        
        // If no cooldown exercises found, add defaults
        if (workoutPlan.cooldown.length === 0) {
          workoutPlan.cooldown = [
            { name: 'Hamstring Stretch', duration: '30 sec', type: 'cooldown' },
            { name: 'Quad Stretch', duration: '30 sec', type: 'cooldown' },
            { name: 'Shoulder Stretch', duration: '30 sec', type: 'cooldown' }
          ];
        }
      }
      
      return workoutPlan;
      
    } catch (error) {
      console.error('Error generating workout:', error);
      return null;
    }
    
  } catch (error) {
    console.error('Fatal error in generateWorkoutByDay:', error);
    return null;
  }
};

// Legacy function for backward compatibility
export async function buildWorkoutByDay(userId: string, dayOfWeek: string, timeAvailable: number): Promise<any> {
  console.log('[LEGACY] Using legacy buildWorkoutByDay function');
  
  // Convert day name to proper format
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayIndex = dayNames.indexOf(dayOfWeek.toLowerCase());
  
  if (dayIndex === -1) {
    console.error('[LEGACY] Invalid day:', dayOfWeek);
    return null;
  }
  
  const properDayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const currentDay = properDayNames[dayIndex];
  
  const workout = await generateWorkoutByDay(userId, timeAvailable);
  
  if (!workout) {
    return null;
  }
  
  // Convert to legacy format
  return {
    warmupArr: workout.warmup.map((ex: any) => ({
      id: Math.random(),
      name: ex.name,
      category: 'cardio',
      exercise_phase: 'warmup',
      equipment_required: ['bodyweight'],
      muscle_group: 'cardiovascular'
    })),
    coreLift: workout.main.find((ex: any) => ex.type === 'core_lift') ? {
      id: Math.random(),
      name: workout.main.find((ex: any) => ex.type === 'core_lift')!.name,
      category: 'strength',
      exercise_phase: 'core_lift',
      equipment_required: ['barbell'],
      muscle_group: workout.focus || 'full_body'
    } : null,
    accessories: workout.main.filter((ex: any) => ex.type === 'accessory').map((ex: any) => ({
      id: Math.random(),
      name: ex.name,
      category: 'strength',
      exercise_phase: 'accessory',
      equipment_required: ['bodyweight'],
      muscle_group: workout.focus || 'full_body'
    })),
    cooldownArr: workout.cooldown.map((ex: any) => ({
      id: Math.random(),
      name: ex.name,
      category: 'cardio',
      exercise_phase: 'cooldown',
      equipment_required: ['bodyweight'],
      muscle_group: 'flexibility'
    })),
    estimatedMinutes: workout.duration,
    workoutType: workout.type,
    focusMuscleGroup: workout.focus || 'full_body'
  };
}

// ---------- DEV HELPER ----------
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  // @ts-ignore – expose helper only in dev
  (window as any).__showPlan = async (day: string = 'Monday') => {
    const plan = await buildWorkoutByDay('test-user', day, 45);
    console.table([
      ['Target min',        plan.estimatedMinutes?.toFixed(1) || 'N/A'],
      ['Warm-up drills',    plan.warmupArr.length],
      ['Accessories',       plan.accessories.length],
      ['Cooldown drills',   plan.cooldownArr.length],
    ]);
    return plan;  // so I can expand it in DevTools
  };
  console.info('👋  Dev helper ready – type  __showPlan("Monday")  in the console');
}
// -------------------------------- 