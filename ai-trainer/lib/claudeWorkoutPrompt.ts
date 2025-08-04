export function buildClaudePrompt(params: {
  day: string;
  coreLift: string;
  muscleTargets: string[];
  duration: number;                 // minutes
  equipment: string[];
  trainingPattern?: string;
}) {
  const { day, coreLift, muscleTargets, duration, equipment, trainingPattern } = params;

  const patternContext = trainingPattern ? `
**Training Pattern**: ${trainingPattern}
- Follow the ${trainingPattern} methodology
- Focus on compound movements that align with this pattern
- Ensure accessory work complements the pattern's goals
` : '';

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
${patternContext}
6. Return **valid JSON** = 
{
  "warmup":[{"name":"…","duration":"…"}],
  "main":[{"name":"${coreLift}","sets":4,"reps":"6-8"}],
  "accessories":[{"name":"…","sets":3,"reps":"10-12"}],
  "cooldown":[{"name":"…","duration":"…"}]
}
Only JSON, no markdown.
`;
} 