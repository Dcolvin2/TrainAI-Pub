// /lib/services/workoutService.ts
// BACKEND ONLY - No UI changes

import { createClient } from '@supabase/supabase-js';

interface TimeStructure {
  warmupMinutes: number;
  mainMinutes: number;
  accessoryMinutes: number;
  cooldownMinutes: number;
  warmupCount: number;
  mainCount: number;
  accessoryCount: number;
  cooldownCount: number;
}

const TIME_STRUCTURES: Record<number, TimeStructure> = {
  15: {
    warmupMinutes: 3,
    mainMinutes: 8,
    accessoryMinutes: 2,
    cooldownMinutes: 2,
    warmupCount: 3,
    mainCount: 1,
    accessoryCount: 1,
    cooldownCount: 2
  },
  30: {
    warmupMinutes: 5,
    mainMinutes: 15,
    accessoryMinutes: 7,
    cooldownMinutes: 3,
    warmupCount: 4,
    mainCount: 2,
    accessoryCount: 2,
    cooldownCount: 3
  },
  45: {
    warmupMinutes: 7,
    mainMinutes: 20,
    accessoryMinutes: 13,
    cooldownMinutes: 5,
    warmupCount: 5,
    mainCount: 2,
    accessoryCount: 4,
    cooldownCount: 4
  },
  60: {
    warmupMinutes: 10,
    mainMinutes: 25,
    accessoryMinutes: 18,
    cooldownMinutes: 7,
    warmupCount: 6,
    mainCount: 3,
    accessoryCount: 5,
    cooldownCount: 5
  }
};

export class WorkoutService {
  private supabase: any;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  async getAllAvailableExercises(userId: string) {
    // Get user's available equipment
    const { data: userEquipment } = await this.supabase
      .from('user_equipment')
      .select('equipment:equipment_id(name)')
      .eq('user_id', userId)
      .eq('is_available', true);

    const availableEquipment = userEquipment?.map((eq: any) => eq.equipment.name) || [];

    // Get ALL exercises from both tables
    const [nikeResult, exercisesResult] = await Promise.all([
      this.supabase
        .from('nike_workouts')
        .select('*'),
      this.supabase
        .from('exercises')
        .select('*')
    ]);

    const nike = nikeResult.data || [];
    const regular = exercisesResult.data || [];

    // Organize by phase and equipment
    return this.organizeExercises(nike, regular, availableEquipment);
  }

  private organizeExercises(nike: any[], regular: any[], equipment: string[]) {
    // Extract unique Nike exercises by phase
    const nikeByPhase = {
      warmup: this.getUniqueNikeExercises(nike.filter((e: any) => e.exercise_phase === 'warmup')),
      main: this.getUniqueNikeExercises(nike.filter((e: any) => e.exercise_phase === 'main')),
      accessory: this.getUniqueNikeExercises(nike.filter((e: any) => e.exercise_phase === 'accessory')),
      cooldown: this.getUniqueNikeExercises(nike.filter((e: any) => e.exercise_phase === 'cooldown'))
    };

    // Filter regular exercises by equipment availability
    const regularFiltered = regular.filter((ex: any) => {
      if (!ex.equipment_required || ex.equipment_required.length === 0) {
        // Allow bodyweight only for warmup/cooldown
        return ex.exercise_phase === 'warmup' || ex.exercise_phase === 'cooldown';
      }
      // Check if user has required equipment
      return ex.equipment_required.some((req: string) => 
        equipment.some((userEq: string) => 
          userEq.toLowerCase().includes(req.toLowerCase()) ||
          req.toLowerCase().includes(userEq.toLowerCase())
        )
      );
    });

    // Organize regular exercises by phase
    const regularByPhase = {
      warmup: regularFiltered.filter((e: any) => e.exercise_phase === 'warmup' || e.category === 'mobility'),
      main: regularFiltered.filter((e: any) => e.exercise_phase === 'main' || e.is_compound === true),
      accessory: regularFiltered.filter((e: any) => 
        (e.exercise_phase === 'accessory' || e.category === 'hypertrophy') &&
        e.equipment_required && e.equipment_required.length > 0
      ),
      cooldown: regularFiltered.filter((e: any) => e.exercise_phase === 'cooldown' || 
        (e.category === 'mobility' && e.name.toLowerCase().includes('stretch')))
    };

    // Combine and return
    return {
      warmup: [...nikeByPhase.warmup, ...regularByPhase.warmup],
      main: [...nikeByPhase.main, ...regularByPhase.main],
      accessories: [...nikeByPhase.accessory, ...regularByPhase.accessory],
      cooldown: [...nikeByPhase.cooldown, ...regularByPhase.cooldown],
      totals: {
        nike: nike.length,
        regular: regular.length,
        combined: nike.length + regular.length,
        byPhase: {
          warmup: nikeByPhase.warmup.length + regularByPhase.warmup.length,
          main: nikeByPhase.main.length + regularByPhase.main.length,
          accessories: nikeByPhase.accessory.length + regularByPhase.accessory.length,
          cooldown: nikeByPhase.cooldown.length + regularByPhase.cooldown.length
        }
      },
      equipment: equipment
    };
  }

  private getUniqueNikeExercises(exercises: any[]) {
    const unique = new Map();
    exercises.forEach(ex => {
      if (!unique.has(ex.exercise)) {
        unique.set(ex.exercise, {
          name: ex.exercise,
          source: 'nike',
          instructions: ex.instructions,
          sets: ex.sets,
          reps: ex.reps,
          exercise_type: ex.exercise_type,
          rest_seconds: ex.rest_seconds || 60
        });
      }
    });
    return Array.from(unique.values());
  }

  async generateWorkoutPrompt(
    workoutType: string,
    duration: number,
    userId: string,
    profile: any
  ) {
    const exercises = await this.getAllAvailableExercises(userId);
    const structure = TIME_STRUCTURES[duration] || TIME_STRUCTURES[45];
    const targetMuscles = this.getTargetMuscles(workoutType);

    return `Create a ${duration}-minute ${workoutType} workout using exercises from our comprehensive database.

DATABASE STATS:
- Total exercises available: ${exercises.totals.combined} (${exercises.totals.nike} Nike + ${exercises.totals.regular} regular)
- Warmup options: ${exercises.totals.byPhase.warmup}
- Main lift options: ${exercises.totals.byPhase.main}
- Accessory options: ${exercises.totals.byPhase.accessories} (ALL require equipment)
- Cooldown options: ${exercises.totals.byPhase.cooldown}

USER PROFILE:
- Current: ${profile.current_weight} lbs → Goal: ${profile.goal_weight} lbs
- Available Equipment: ${exercises.equipment.join(', ')}

TIME STRUCTURE (${duration} minutes total):
- Warmup: ${structure.warmupMinutes} minutes (select ${structure.warmupCount} exercises)
- Main: ${structure.mainMinutes} minutes (select ${structure.mainCount} exercises)
- Accessories: ${structure.accessoryMinutes} minutes (select ${structure.accessoryCount} exercises)
- Cooldown: ${structure.cooldownMinutes} minutes (select ${structure.cooldownCount} exercises)

AVAILABLE EXERCISES:

WARMUP (${exercises.warmup.length} available):
${exercises.warmup.slice(0, 15).map((e: any) => 
  `- ${e.name || e.exercise}: ${e.instructions || e.instruction || 'Dynamic movement'}`
).join('\n')}

MAIN EXERCISES for ${workoutType.toUpperCase()} (${exercises.main.length} available):
${exercises.main.filter((e: any) => this.matchesMuscleGroup(e, targetMuscles)).slice(0, 10).map((e: any) => 
  `- ${e.name || e.exercise}: ${e.equipment_required?.join(', ') || this.inferEquipment(e.name || e.exercise)}`
).join('\n')}

ACCESSORIES (${exercises.accessories.length} with equipment):
${exercises.accessories.filter((e: any) => this.matchesMuscleGroup(e, targetMuscles)).slice(0, 20).map((e: any) => 
  `- ${e.name || e.exercise}: ${e.equipment_required?.join(', ') || this.inferEquipment(e.name || e.exercise)}`
).join('\n')}

COOLDOWN (${exercises.cooldown.length} available):
${exercises.cooldown.slice(0, 15).map((e: any) => 
  `- ${e.name || e.exercise}: ${e.instructions || e.instruction || 'Hold 30-60 seconds'}`
).join('\n')}

CRITICAL REQUIREMENTS:
1. Use ONLY exercises from the lists above
2. Mix Nike exercises with regular database exercises for variety
3. Accessories MUST use equipment (no bodyweight)
4. Follow the exact time structure
5. Target muscles for ${workoutType}: ${targetMuscles.join(', ')}

Return JSON:
{
  "warmup": [
    {"name": "Exercise from warmup list", "duration": "45 seconds", "source": "nike or exercises"}
  ],
  "main": [
    {"name": "Exercise from main list", "sets": 4, "reps": "6-8", "rest": 120, "equipment": ["Barbell"]}
  ],
  "accessories": [
    {"name": "Exercise from accessory list", "sets": 3, "reps": "10-12", "rest": 60, "equipment": ["Dumbbells"]}
  ],
  "cooldown": [
    {"name": "Exercise from cooldown list", "duration": "60 seconds"}
  ]
}`;
  }

  private matchesMuscleGroup(exercise: any, targetMuscles: string[]): boolean {
    const exerciseName = (exercise.name || exercise.exercise || '').toLowerCase();
    const primaryMuscle = (exercise.primary_muscle || '').toLowerCase();
    
    return targetMuscles.some((muscle: string) => 
      exerciseName.includes(muscle) || 
      primaryMuscle.includes(muscle) ||
      this.inferMuscleFromName(exerciseName).includes(muscle)
    );
  }

  private inferMuscleFromName(name: string): string {
    const n = name.toLowerCase();
    if (n.includes('chest') || n.includes('bench') || n.includes('fly')) return 'chest';
    if (n.includes('back') || n.includes('row') || n.includes('pull')) return 'back';
    if (n.includes('shoulder') || n.includes('press') || n.includes('lateral')) return 'shoulders';
    if (n.includes('squat') || n.includes('leg') || n.includes('lunge')) return 'legs';
    if (n.includes('curl')) return 'biceps';
    if (n.includes('tricep') || n.includes('dip')) return 'triceps';
    return '';
  }

  private inferEquipment(name: string): string {
    const n = name.toLowerCase();
    if (n.includes('db ') || n.includes('dumbbell')) return 'Dumbbells';
    if (n.includes('bb ') || n.includes('barbell')) return 'Barbell';
    if (n.includes('kb ') || n.includes('kettlebell')) return 'Kettlebells';
    if (n.includes('cable')) return 'Cables';
    if (n.includes('band')) return 'Resistance Bands';
    if (n.includes('medicine ball')) return 'Medicine Ball';
    return '';
  }

  private getTargetMuscles(workoutType: string): string[] {
    const map: Record<string, string[]> = {
      push: ['chest', 'shoulder', 'tricep'],
      pull: ['back', 'bicep', 'lat', 'rear delt'],
      legs: ['quad', 'hamstring', 'glute', 'calf'],
      upper: ['chest', 'back', 'shoulder', 'arm', 'bicep', 'tricep'],
      full: ['chest', 'back', 'shoulder', 'leg', 'core']
    };
    return map[workoutType.toLowerCase()] || map.upper;
  }
} 