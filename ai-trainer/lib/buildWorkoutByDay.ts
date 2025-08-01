import { supabase } from './supabaseClient';

interface WorkoutPlan {
  day: string;
  type: string;
  focus: string;
  duration: number;
  warmup: Array<{name: string; duration: string}>;
  main: Array<{name: string; sets?: number; reps?: string; duration?: string; rounds?: number; rest?: string; type?: string; description?: string}>;
  cooldown: Array<{name: string; duration: string}>;
}

// Add this function to your workout generation logic
export const generateWorkoutByDay = async (userId: string, timeAvailable = 45): Promise<WorkoutPlan | null> => {
  // Get current day of week (0 = Sunday, 1 = Monday, etc.)
  const today = new Date().getDay();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const currentDay = dayNames[today];
  
  console.log('Current day:', currentDay, 'Day number:', today);
  
  // Query the weekly workout template
  const { data: template, error: templateError } = await supabase
    .from('weekly_workout_template')
    .select('*')
    .eq('day_of_week', currentDay)
    .single();
    
  if (templateError) {
    console.error('Template error:', templateError);
    return null;
  }
  
  console.log('Workout template for', currentDay, ':', template);
  
  // Get user's equipment
  const { data: userEquipment, error: equipError } = await supabase
    .from('user_equipment')
    .select(`
      equipment:equipment_id (
        name
      )
    `)
    .eq('user_id', userId);
    
  if (equipError) {
    console.error('Equipment error:', equipError);
    return null;
  }
  
  const availableEquipment = userEquipment?.map((item: any) => item.equipment.name) || ['bodyweight'];
  console.log('User equipment:', availableEquipment);
  
  // Generate workout based on day type
  let workoutPlan: WorkoutPlan = {
    day: currentDay,
    type: template.workout_type,
    focus: template.focus_muscle_group,
    duration: timeAvailable,
    warmup: [],
    main: [],
    cooldown: []
  };
  
  // Filter exercises by available equipment
  const getFilteredExercises = async (phase: string, category: string | null = null, primaryMuscle: string | null = null) => {
    let query = supabase
      .from('exercises')
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
    return exercises?.filter((exercise: any) => {
      if (!exercise.equipment_required || exercise.equipment_required.length === 0) {
        return true; // Bodyweight exercises
      }
      return exercise.equipment_required.some((req: string) => availableEquipment.includes(req));
    }) || [];
  };
  
  // Generate based on workout type
  switch (template.workout_type) {
    case 'strength':
      // Add core lift if available
      if (template.core_lift_name) {
        const coreLifts = await getFilteredExercises('core_lift');
        const coreLift = coreLifts.find((ex: any) => ex.name.toLowerCase().includes(template.core_lift_name.toLowerCase()));
        if (coreLift) {
          workoutPlan.main.push({
            name: coreLift.name,
            sets: 4,
            reps: '5-8',
            type: 'core_lift'
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
          type: 'accessory'
        });
      });
      break;
      
    case 'cardio':
      const cardioExercises = await getFilteredExercises('main', 'cardio');
      const selectedCardio = cardioExercises.slice(0, 2);
      selectedCardio.forEach((ex: any) => {
        workoutPlan.main.push({
          name: ex.name,
          duration: '15 min',
          type: 'cardio'
        });
      });
      break;
      
    case 'hiit':
      const hiitExercises = await getFilteredExercises('main');
      const hiitSelection = hiitExercises
        .filter((ex: any) => ex.category === 'conditioning' || ex.primary_muscle === 'full_body')
        .slice(0, 5);
        
      if (hiitSelection.length === 0) {
        // Fallback bodyweight HIIT if no equipment
        workoutPlan.main = [
          { name: 'Burpees', rounds: 4, duration: '45 sec', rest: '15 sec' },
          { name: 'Mountain Climbers', rounds: 4, duration: '45 sec', rest: '15 sec' },
          { name: 'Jump Squats', rounds: 4, duration: '45 sec', rest: '15 sec' },
          { name: 'Push-ups', rounds: 4, duration: '45 sec', rest: '15 sec' }
        ];
      } else {
        hiitSelection.forEach((ex: any) => {
          workoutPlan.main.push({
            name: ex.name,
            rounds: 4,
            duration: '45 sec',
            rest: '15 sec'
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
  }
  
  // Add warmup and cooldown
  const warmupExercises = await getFilteredExercises('warmup');
  const cooldownExercises = await getFilteredExercises('cooldown');
  
  workoutPlan.warmup = warmupExercises.slice(0, 3).map((ex: any) => ({
    name: ex.name,
    duration: '30 sec'
  }));
  
  workoutPlan.cooldown = cooldownExercises.slice(0, 3).map((ex: any) => ({
    name: ex.name,
    duration: '30 sec'
  }));
  
  console.log('Generated workout plan:', workoutPlan);
  return workoutPlan;
};

// Legacy function for backward compatibility
export async function buildWorkoutByDay(userId: string, dayOfWeek: string, timeAvailable: number) {
  console.log('Using legacy buildWorkoutByDay - calling new generateWorkoutByDay');
  return generateWorkoutByDay(userId, timeAvailable);
} 