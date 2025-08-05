export function buildNikeWODPrompt(
  workoutNumber: number,
  workoutType: string,
  groupedExercises: Record<string, any[]>,
  availableEquipment: string[],
  profile: any
) {
  return `
You are a fitness coach creating Nike Workout #${workoutNumber}: ${workoutType}

User Profile:
- Current weight: ${profile.current_weight} lbs
- Goal weight: ${profile.goal_weight} lbs  
- Goal: Weight loss while maintaining strength and muscle
- Available equipment: ${availableEquipment.join(', ')}

Base Nike Workout Structure:
${JSON.stringify(groupedExercises, null, 2)}

Your task:
1. Adapt this Nike workout to use ONLY the available equipment
2. If an exercise requires unavailable equipment, substitute with a similar exercise that targets the same muscles
3. Adjust sets/reps based on the user's weight loss goal (slightly higher reps, shorter rest)
4. Keep the same phase structure (warmup → main → accessory → cooldown)
5. Make instructions clear and concise

Return a JSON object with this structure:
{
  "exercises": [
    {
      "name": "Exercise Name",
      "phase": "warmup|main|accessory|cooldown",
      "sets": 3,
      "reps": "12",
      "rest_seconds": 60,
      "instruction": "Clear, concise instruction",
      "equipment": ["Dumbbells"],
      "substituted": true/false,
      "original_exercise": "Original Nike exercise name if substituted"
    }
  ]
}

Important:
- Maintain the workout's intended intensity and focus
- Prioritize compound movements for calorie burn
- Keep rest periods appropriate for fat loss (45-60s for main lifts, 30-45s for accessories)
`;
} 