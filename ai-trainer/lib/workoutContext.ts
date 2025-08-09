import { supabase as supabaseClient } from '@/lib/supabaseClient';

export interface UserContextProfile {
  preferred_workout_duration: number;
  goal_weight?: number | null;
  current_weight?: number | null;
  training_goal: string;
  fitness_level: string;
  preferred_rep_range: string;
  injuries: string[];
  last_nike_workout?: number | null;
}

export interface ExerciseRow {
  id: string;
  name: string;
  category?: string | null;
  primary_muscle?: string | null;
  equipment_required?: string[] | null;
  instruction?: string | null;
  exercise_phase: 'warmup' | 'cooldown' | 'main' | 'core_lift' | 'accessory';
  rest_seconds_default?: number | null;
  movement_pattern?: string | null;
  is_compound?: boolean | null;
  target_muscles?: string[] | null;
}

export async function getUserContext(userId: string) {
  const supabase = supabaseClient;

  const [profileRes, equipmentRes, exercisesRes] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        `
        preferred_workout_duration,
        goal_weight,
        current_weight,
        training_goal,
        fitness_level,
        preferred_rep_range,
        injuries,
        weekly_workout_goal,
        last_nike_workout
      `
      )
      .eq('user_id', userId)
      .maybeSingle(),

    // user_equipment -> equipment relation by equipment_id
    supabase
      .from('user_equipment')
      .select('equipment:equipment_id(name)')
      .eq('user_id', userId)
      .eq('is_available', true),

    supabase
      .from('exercises')
      .select(
        `
        id,
        name,
        category,
        primary_muscle,
        equipment_required,
        instruction,
        exercise_phase,
        rest_seconds_default,
        movement_pattern,
        is_compound,
        target_muscles
      `
      )
  ] as const);

  const profileRow = profileRes.data as any;
  const equipmentRows = equipmentRes.data as any[] | null;
  const exercises = (exercisesRes.data as ExerciseRow[] | null) || [];

  const availableEquipment = new Set(
    (equipmentRows || [])
      .map((r: any) => r.equipment?.name)
      .filter(Boolean)
  );

  const allowedExercises: ExerciseRow[] = exercises.filter((ex: ExerciseRow) => {
    const required = ex.equipment_required || [];
    if (required.length === 0) return true;
    return required.every((item: string) => availableEquipment.has(item) || item === 'Bodyweight');
  });

  const exercisesByPhase = {
    warmup: allowedExercises.filter((e) => e.exercise_phase === 'warmup'),
    core_lift: allowedExercises.filter((e) => e.exercise_phase === 'core_lift'),
    main: allowedExercises.filter((e) => e.exercise_phase === 'main'),
    accessory: allowedExercises.filter((e) => e.exercise_phase === 'accessory'),
    cooldown: allowedExercises.filter((e) => e.exercise_phase === 'cooldown')
  } as const;

  const profile: UserContextProfile = {
    preferred_workout_duration: profileRow?.preferred_workout_duration || 45,
    goal_weight: profileRow?.goal_weight ?? null,
    current_weight: profileRow?.current_weight ?? null,
    training_goal: profileRow?.training_goal || 'strength',
    fitness_level: profileRow?.fitness_level || 'intermediate',
    preferred_rep_range: profileRow?.preferred_rep_range || 'hypertrophy_6-12',
    injuries: profileRow?.injuries || [],
    last_nike_workout: profileRow?.last_nike_workout ?? null
  };

  return {
    profile,
    availableEquipment: Array.from(availableEquipment),
    allowedExercises,
    exercisesByPhase
  };
}


