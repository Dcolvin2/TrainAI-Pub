// Pull the exact row type Supabase's codegen produced for the exercises table
// For now, we'll define it manually until we have the database types
export interface ExerciseRow {
  id: string;
  name: string;
  category: string;
  primary_muscle: string;
  equipment_required: string[];
  is_main_lift: boolean;
  exercise_phase: 'warmup' | 'cooldown' | 'main';
  instruction?: string;
}

/** Lean shape the app uses in workout builders & pickers */
export interface Exercise {
  id: string;                       // keep id for set-level logging
  name: string;
  category: string;
  primary_muscle: string;
  equipment_required: string[];
  is_main_lift: boolean;
  exercise_phase: 'warmup' | 'cooldown' | 'main';
  instruction?: string;
}

/** Strip out Supabase-only columns + rename fields if needed */
export const toExercise = (row: ExerciseRow): Exercise => ({
  id: row.id,
  name: row.name,
  category: row.category,
  primary_muscle: row.primary_muscle,
  equipment_required: row.equipment_required,
  is_main_lift: row.is_main_lift,
  exercise_phase: row.exercise_phase,
  instruction: row.instruction
}); 