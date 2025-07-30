// Pull the exact row type Supabase's codegen produced for the exercises_final table
import { Database } from '@/lib/database.types';

export type ExerciseRow = Database['public']['Tables']['exercises_final']['Row']; // final table

/** Lean shape the app uses in workout builders & pickers */
export interface Exercise {
  id: string
  name: string
  category: string
  primary_muscle: string
  equipment_required: string[]
  exercise_phase: 'core_lift' | 'accessory' | 'warmup' | 'mobility' | 'cooldown'
  instruction: string
  rest_seconds_default: number
  set_duration_seconds: number
}

/** Convert database row to app-friendly shape */
export function toExercise(row: ExerciseRow): Exercise {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    primary_muscle: row.primary_muscle,
    equipment_required: row.equipment_required,
    exercise_phase: row.exercise_phase,
    instruction: row.instruction,
    rest_seconds_default: row.rest_seconds_default,
    set_duration_seconds: row.set_duration_seconds
  };
} 