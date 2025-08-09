// lib/workoutPrompt.ts
import type { AllowedExercise, ProfileCtx } from './workoutContext';

export function buildStrictWorkoutPrompt(input: {
  userMessage: string;
  profile: ProfileCtx;
  availableEquipment: string[];
  allowedExercises: AllowedExercise[];
}) {
  const { userMessage, profile, availableEquipment, allowedExercises } = input;

  return `
Return ONLY JSON. No Markdown, no commentary.

You are a strength coach. Create a complete workout JSON using this schema:
{
  "name": string,
  "duration_min": number,
  "phases": [
    {
      "phase": "warmup" | "main" | "conditioning" | "cooldown",
      "items": [
        {
          "exercise_id": string,   // must be from allowed_exercises[].id
          "display_name": string,  // echo the allowed_exercises name
          "sets": [
            { "set_number": number, "reps": number | string, "prescribed_weight": number | string | null, "rest_seconds": number }
          ],
          "notes": string | null
        }
      ]
    }
  ],
  "est_total_minutes": number
}

Constraints:
- duration_min <= ${profile.preferred_workout_duration}
- Use ONLY exercises from allowed_exercises (match by id)
- Prefer big compounds first; trim accessories if time is tight
- If the user mentions specific equipment, prioritize those items

User message: "${userMessage}"
Training goal: ${profile.training_goal ?? 'unspecified'}
Fitness level: ${profile.fitness_level ?? 'unspecified'}
Available equipment: ${availableEquipment.join(', ')}

allowed_exercises:
${JSON.stringify(allowedExercises)}
`;
}

