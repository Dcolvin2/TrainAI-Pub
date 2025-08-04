import { AccessoryExercise } from './getAccessoryExercises';

export function buildClaudePrompt(params: {
  day: string;
  coreLift: string;
  muscleTargets: string[];
  duration: number;                 // minutes
  equipment: string[];
  accessoryExercises?: AccessoryExercise[];
}) {
  const { day, coreLift, muscleTargets, duration, equipment, accessoryExercises = [] } = params;

  const accessoryOptions = accessoryExercises.length > 0 
    ? `\n**Recommended Accessory Exercises (from database):**
${accessoryExercises.map(ex => `- ${ex.name} (${ex.primary_muscle}, ${ex.category}, rest: ${ex.rest_seconds_default}s)`).join('\n')}`
    : '';

  return `
You are an elite strength coach.

**Rules**
1. Focus muscles: ${muscleTargets.join(", ")}
2. Core lift: ${coreLift}. It must stay in the plan.
3. Session length: about ${duration} min total.
4. Accessories must:  
   • train the same muscles (or synergists)  
   • use this equipment only: ${equipment.length ? equipment.join(", ") : "body-weight"}  
   • avoid HIIT, mobility, stretching, foam-rolling.  
5. Provide:
   • warmup (3 short moves, total ≤ 5 min)  
   • accessory lifts (2-4 moves, 3 sets each, with set×rep)  
   • cool-down (3 moves, total ≤ 4 min)  
6. Return **valid JSON** = 
{
  "warmup":[{"name":"…","duration":"…"}],
  "main":[{"name":"${coreLift}","sets":4,"reps":"6-8"}],
  "accessories":[{"name":"…","sets":3,"reps":"10-12"}],
  "cooldown":[{"name":"…","duration":"…"}]
}${accessoryOptions}

**ACCESSORY EXERCISE SELECTION:**
- Use the recommended exercises above as a starting point
- Feel free to suggest better alternatives if you know of more effective exercises
- Prioritize exercises that complement the core lift and target the same muscle groups
- Consider exercise variety, progression, and user experience
- If you suggest exercises not in the database, ensure they use available equipment: ${equipment.length ? equipment.join(", ") : "body-weight"}

Only JSON, no markdown.
`;
} 