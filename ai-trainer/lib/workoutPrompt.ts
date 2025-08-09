export interface WorkoutSet {
  set_number: number;
  reps: number | string;
  prescribed_weight: number | null;
  prescribed_load?: string | null;
  rest_seconds?: number | null;
}

export interface WorkoutExercise {
  exercise_id: string;
  exercise_name: string;
  exercise_phase: 'warmup' | 'core_lift' | 'main' | 'accessory' | 'cooldown';
  is_compound?: boolean;
  rest_seconds_default?: number;
  sets: WorkoutSet[];
  notes?: string;
}

export function buildStrictPrompt(input: {
  userMessage: string;
  profile: any;
  availableEquipment: string[];
  exercisesByPhase: Record<string, any[]>;
}) {
  const { userMessage, profile, availableEquipment, exercisesByPhase } = input;

  const phaseCatalog = Object.entries(exercisesByPhase)
    .map(([phase, exercises]) =>
      `${phase.toUpperCase()}:\n${(exercises as any[])
        .map(
          (e) =>
            `  {"id":"${e.id}", "name":"${e.name}", "compound":${!!e.is_compound}, "rest":${e.rest_seconds_default ?? 90}}`
        )
        .join(',\n')}`
    )
    .join('\n\n');

  return `You are an elite strength coach generating a workout plan.

USER REQUEST: "${userMessage}"

USER PROFILE:
- Training Goal: ${profile.training_goal}
- Fitness Level: ${profile.fitness_level}
- Preferred Rep Range: ${profile.preferred_rep_range}
- Injuries to avoid: ${JSON.stringify(profile.injuries)}
- Time Available: ${profile.preferred_workout_duration} minutes

AVAILABLE EQUIPMENT: ${availableEquipment.join(', ')}

EXERCISES BY PHASE (use appropriate exercises for each phase):
${phaseCatalog}

WORKOUT STRUCTURE RULES:
1. WARMUP: Use only warmup-phase exercises (5-8 min)
2. MAIN WORK: 
   - Start with 1 core_lift if strength/power focus
   - Follow with main-phase exercises
   - Prioritize compound=true exercises
3. ACCESSORIES: Use accessory-phase exercises (if time allows)
4. COOLDOWN: Use only cooldown-phase exercises (3-5 min)

REP RANGE BASED ON PROFILE:
- strength_1-5: Heavy loads, 1-5 reps, 3-5 min rest
- hypertrophy_6-12: Moderate loads, 6-12 reps, 60-90s rest  
- endurance_13-20: Light loads, 13-20 reps, 30-45s rest

Return ONLY valid JSON with this structure:
{
  "name": "string",
  "duration_minutes": number,
  "phases": [
    {
      "phase": "warmup|main|conditioning|cooldown",
      "exercises": [
        {
          "exercise_id": "string from catalog",
          "exercise_name": "string",
          "exercise_phase": "warmup|core_lift|main|accessory|cooldown",
          "sets": [
            {
              "set_number": number,
              "reps": number or string,
              "prescribed_weight": number or null,
              "prescribed_load": "string description like 'moderate' or '70% 1RM'",
              "rest_seconds": number (use rest_seconds_default from exercise)
            }
          ]
        }
      ]
    }
  ]
}`;
}


