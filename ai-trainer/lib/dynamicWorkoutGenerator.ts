import { createClient } from '@supabase/supabase-js';
import { getCoreLiftForDay, getAvailablePatterns } from './trainingPatterns';
import { getCoreLift } from './coreMap';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export class DynamicWorkoutGenerator {
  
  async generateWorkout(userId: string, date: Date = new Date()) {
    // 1. Determine workout type for today
    const workoutType = await this.determineWorkoutType(userId, date);
    
    // 2. Get available equipment
    const equipment = await this.getUserEquipment(userId);
    
    // 3. Generate workout based on type
    return this.buildWorkout(workoutType, equipment, userId);
  }
  
  async determineWorkoutType(userId: string, date: Date) {
    // Check user's training style
    const userStyle = await this.getUserTrainingStyle(userId);
    
    if (userStyle) {
      // Follow their chosen pattern
      return this.getWorkoutTypeFromPattern(userStyle, date);
    }
    
    // No set pattern? Use smart detection
    return this.smartWorkoutTypeDetection(userId, date);
  }
  
  async getUserTrainingStyle(userId: string) {
    const { data } = await supabase
      .from('user_preferences')
      .select('training_pattern')
      .eq('user_id', userId)
      .single();
    
    return data?.training_pattern || null;
  }
  
  getWorkoutTypeFromPattern(pattern: string, date: Date) {
    const dayOfWeek = date.getDay();
    const availablePatterns = getAvailablePatterns();
    
    if (availablePatterns.includes(pattern)) {
      const coreLift = getCoreLiftForDay(dayOfWeek, pattern as any);
      return {
        type: 'pattern_based',
        pattern: pattern,
        coreLift: coreLift,
        dayType: this.getDayTypeFromPattern(pattern, dayOfWeek)
      };
    }
    
    return null;
  }
  
  getDayTypeFromPattern(pattern: string, dayOfWeek: number) {
    const patterns = {
      'PPL': ['push', 'pull', 'legs', 'push', 'pull', 'legs', 'rest'],
      'UPPER_LOWER': ['upper', 'lower', 'rest', 'upper', 'lower', 'rest', 'rest'],
      'FULL_BODY': ['full', 'rest', 'full', 'rest', 'full', 'rest', 'rest'],
      'MOVEMENT_PATTERNS': ['squat_push', 'hinge_pull', 'rest', 'squat_push', 'hinge_pull', 'rest', 'rest']
    };
    
    const sequence = patterns[pattern as keyof typeof patterns];
    if (sequence) {
      return sequence[dayOfWeek % sequence.length];
    }
    
    return 'rest';
  }
  
  async smartWorkoutTypeDetection(userId: string, date: Date) {
    // Look at last 7 days of training
    const recentWorkouts = await this.getRecentWorkouts(userId, 7);
    
    // Analyze what they've been doing
    const patterns = this.analyzePatterns(recentWorkouts);
    
    // Suggest what makes sense
    if (patterns.lastWas === 'push') {
      return { type: 'suggested', suggestion: 'pull', reason: 'Natural progression after push day' };
    }
    
    if (patterns.daysWithoutLegs >= 3) {
      return { type: 'suggested', suggestion: 'legs', reason: 'Time for leg day!' };
    }
    
    if (patterns.daysWithoutPull >= 3) {
      return { type: 'suggested', suggestion: 'pull', reason: 'Back and biceps need attention' };
    }
    
    if (patterns.daysWithoutPush >= 3) {
      return { type: 'suggested', suggestion: 'push', reason: 'Chest and shoulders need work' };
    }
    
    // Default to asking the user
    return { type: 'user_choice', options: ['push', 'pull', 'legs', 'full_body'] };
  }
  
  async getRecentWorkouts(userId: string, days: number) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const { data } = await supabase
      .from('workout_sessions')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false });
    
    return data || [];
  }
  
  analyzePatterns(workouts: any[]) {
    const analysis = {
      lastWas: null as string | null,
      daysWithoutLegs: 0,
      daysWithoutPull: 0,
      daysWithoutPush: 0,
      totalWorkouts: workouts.length
    };
    
    if (workouts.length === 0) {
      return analysis;
    }
    
    // Analyze the most recent workout
    const lastWorkout = workouts[0];
    analysis.lastWas = this.categorizeWorkout(lastWorkout);
    
    // Count days without different types
    const legExercises = ['squat', 'deadlift', 'leg', 'quad', 'hamstring', 'glute'];
    const pullExercises = ['pull', 'row', 'deadlift', 'back', 'bicep'];
    const pushExercises = ['push', 'press', 'chest', 'shoulder', 'tricep'];
    
    let daysSinceLegs = 0;
    let daysSincePull = 0;
    let daysSincePush = 0;
    
    for (const workout of workouts) {
      const workoutType = this.categorizeWorkout(workout);
      
      if (workoutType === 'legs') {
        break;
      }
      daysSinceLegs++;
    }
    
    for (const workout of workouts) {
      const workoutType = this.categorizeWorkout(workout);
      
      if (workoutType === 'pull') {
        break;
      }
      daysSincePull++;
    }
    
    for (const workout of workouts) {
      const workoutType = this.categorizeWorkout(workout);
      
      if (workoutType === 'push') {
        break;
      }
      daysSincePush++;
    }
    
    analysis.daysWithoutLegs = daysSinceLegs;
    analysis.daysWithoutPull = daysSincePull;
    analysis.daysWithoutPush = daysSincePush;
    
    return analysis;
  }
  
  categorizeWorkout(workout: any) {
    const exercises = workout.exercises || [];
    const exerciseNames = exercises.map((e: any) => e.name?.toLowerCase() || '').join(' ');
    
    if (exerciseNames.includes('squat') || exerciseNames.includes('leg') || exerciseNames.includes('quad')) {
      return 'legs';
    }
    
    if (exerciseNames.includes('pull') || exerciseNames.includes('row') || exerciseNames.includes('back')) {
      return 'pull';
    }
    
    if (exerciseNames.includes('push') || exerciseNames.includes('press') || exerciseNames.includes('chest')) {
      return 'push';
    }
    
    return 'unknown';
  }
  
  async getUserEquipment(userId: string) {
    const { data } = await supabase
      .from('user_equipment')
      .select('equipment!inner(name)')
      .eq('user_id', userId);
    
    return (data || []).map((r: any) => r.equipment.name);
  }
  
  async buildWorkout(workoutType: any, equipment: string[], userId: string) {
    if (!workoutType || workoutType.type === 'user_choice') {
      // Let user choose
      return { 
        requiresUserInput: true,
        options: workoutType?.options || ['push', 'pull', 'legs', 'full_body']
      };
    }
    
    if (workoutType.type === 'suggested') {
      return {
        type: 'suggested',
        suggestion: workoutType.suggestion,
        reason: workoutType.reason,
        requiresConfirmation: true
      };
    }
    
    // Get appropriate exercises
    const exercises = await this.selectExercisesForType(workoutType, equipment);
    
    return {
      type: workoutType.type,
      pattern: workoutType.pattern,
      coreLift: workoutType.coreLift,
      dayType: workoutType.dayType,
      warmup: this.selectWarmup(workoutType),
      mainWork: exercises.main,
      accessories: exercises.accessories,
      cooldown: this.selectCooldown(workoutType)
    };
  }
  
  async selectExercisesForType(workoutType: any, availableEquipment: string[]) {
    const patterns = this.getMovementPatternsForType(workoutType);
    const exercises: { main: any[], accessories: any[] } = {
      main: [],
      accessories: []
    };
    
    // Select primary movement
    const primaryPattern = patterns[0];
    const primaryExercise = await this.selectBestExercise(
      this.MOVEMENT_PATTERNS[primaryPattern] || [],
      availableEquipment,
      'heavy'
    );
    exercises.main.push(primaryExercise);
    
    // Select complementary accessories
    for (const pattern of patterns.slice(1)) {
      const accessory = await this.selectBestExercise(
        this.MOVEMENT_PATTERNS[pattern] || [],
        availableEquipment,
        'moderate'
      );
      exercises.accessories.push(accessory);
    }
    
    return exercises;
  }
  
  getMovementPatternsForType(workoutType: any) {
    const patterns = {
      'push': ['horizontal_push', 'vertical_push'],
      'pull': ['horizontal_pull', 'vertical_pull'],
      'legs': ['squat', 'hinge'],
      'full_body': ['squat', 'horizontal_push', 'horizontal_pull']
    };
    
    return patterns[workoutType.dayType as keyof typeof patterns] || ['squat'];
  }
  
  MOVEMENT_PATTERNS: Record<string, string[]> = {
    horizontal_push: ['Barbell Bench Press', 'Push-Up', 'Dumbbell Flyes', 'Dumbbell Bench Press'],
    vertical_push: ['Barbell Overhead Press', 'Dumbbell Shoulder Press', 'Pike Push-Up'],
    horizontal_pull: ['Barbell Bent-Over Row', 'Cable Row', 'Dumbbell Row'],
    vertical_pull: ['Pull-Up', 'Lat Pulldown', 'High Pull'],
    squat: ['Barbell Back Squat', 'Barbell Front Squat', 'Goblet Squat', 'Split Squat'],
    hinge: ['Barbell Deadlift', 'Barbell Romanian Deadlift', 'Good Mornings', 'Kettlebell Swing'],
    carry: ['Dumbbell Farmers Walk', 'Suitcase Carry', 'Overhead Carry'],
    core: ['Plank', 'Ab Wheel', 'Hanging Leg Raise', 'Pallof Press']
  };
  
  async selectBestExercise(exerciseOptions: string[], availableEquipment: string[], intensity: string) {
    // Filter exercises by available equipment
    const availableExercises = exerciseOptions.filter(exercise => {
      // Simple equipment matching - in real implementation, would check against exercise database
      const exerciseLower = exercise.toLowerCase();
      return availableEquipment.some(equipment => 
        exerciseLower.includes(equipment.toLowerCase())
      ) || exerciseLower.includes('bodyweight');
    });
    
    if (availableExercises.length === 0) {
      // Fallback to bodyweight options
      return exerciseOptions.find(ex => ex.toLowerCase().includes('bodyweight')) || exerciseOptions[0];
    }
    
    // Return the first available exercise
    return availableExercises[0];
  }
  
  selectWarmup(workoutType: any) {
    return [
      { name: "Light Cardio", duration: "2 min" },
      { name: "Dynamic Stretches", duration: "2 min" },
      { name: "Movement Prep", duration: "1 min" }
    ];
  }
  
  selectCooldown(workoutType: any) {
    return [
      { name: "Light Stretching", duration: "2 min" },
      { name: "Deep Breathing", duration: "1 min" },
      { name: "Cool Down Walk", duration: "1 min" }
    ];
  }
  
  async completeWorkout(userId: string, workoutData: any) {
    // Save the workout
    await this.saveWorkout(userId, workoutData);
    
    // Analyze patterns
    const pattern = this.analyzeWorkoutPattern(workoutData);
    
    // Update user preferences if we detect a pattern
    const recentPatterns = await this.getRecentPatterns(userId, 14); // 2 weeks
    
    if (this.detectConsistentPattern(recentPatterns)) {
      // Suggest saving this as their training style
      return {
        suggestion: `You've been following a ${pattern.name} split. Want to set this as your default?`,
        pattern: pattern
      };
    }
    
    return null;
  }
  
  async saveWorkout(userId: string, workoutData: any) {
    const { data, error } = await supabase
      .from('workout_sessions')
      .insert({
        user_id: userId,
        workout_data: workoutData,
        created_at: new Date().toISOString()
      });
    
    if (error) {
      console.error('Error saving workout:', error);
    }
    
    return data;
  }
  
  analyzeWorkoutPattern(workoutData: any) {
    // Analyze the workout to determine pattern
    const exercises = workoutData.exercises || [];
    const exerciseNames = exercises.map((e: any) => e.name?.toLowerCase() || '').join(' ');
    
    if (exerciseNames.includes('squat') && exerciseNames.includes('bench') && exerciseNames.includes('deadlift')) {
      return { name: 'Full Body', type: 'FULL_BODY' };
    }
    
    if (exerciseNames.includes('squat') || exerciseNames.includes('leg')) {
      return { name: 'Legs', type: 'PPL' };
    }
    
    if (exerciseNames.includes('pull') || exerciseNames.includes('row')) {
      return { name: 'Pull', type: 'PPL' };
    }
    
    if (exerciseNames.includes('push') || exerciseNames.includes('press')) {
      return { name: 'Push', type: 'PPL' };
    }
    
    return { name: 'Custom', type: 'CUSTOM' };
  }
  
  async getRecentPatterns(userId: string, days: number) {
    const workouts = await this.getRecentWorkouts(userId, days);
    return workouts.map(workout => this.analyzeWorkoutPattern(workout));
  }
  
  detectConsistentPattern(patterns: any[]) {
    if (patterns.length < 5) return false; // Need at least 5 workouts
    
    const patternTypes = patterns.map(p => p.type);
    const uniqueTypes = [...new Set(patternTypes)];
    
    // If 80% of workouts follow the same pattern, suggest it
    const mostCommonType = patternTypes.reduce((a, b) =>
      patternTypes.filter(v => v === a).length >= patternTypes.filter(v => v === b).length ? a : b
    );
    
    const consistency = patternTypes.filter(type => type === mostCommonType).length / patternTypes.length;
    
    return consistency >= 0.8;
  }
} 