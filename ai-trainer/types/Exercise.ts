// Pull the exact row type Supabase's codegen produced for the exercises table
import { Database } from '@/lib/database.types';

export type ExerciseRow = Database['public']['Tables']['exercises']['Row']; // exercises table

/** Lean shape the app uses in workout builders & pickers */
export interface Exercise {
  id: string
  name: string
  category: string
  muscle_group: string
  required_equipment: string[]
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
    muscle_group: row.muscle_group,
    required_equipment: row.required_equipment,
    exercise_phase: row.exercise_phase,
    instruction: row.instruction,
    rest_seconds_default: row.rest_seconds_default,
    set_duration_seconds: row.set_duration_seconds
  };
} 