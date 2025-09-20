import { openaiJSON } from './openaiClient';
import { PlanSchema, type Plan } from './schemas';

const PLANNER_SYSTEM = `
You are a strength coach. Output ONLY valid JSON matching the provided schema.
Rules:
- Use ONLY equipment from: <<EQUIPMENT>>. If empty, default to bodyweight.
- Target duration: <<DURATION>> minutes (±5).
- Phases: warmup, main, accessory (>=2 items), optional conditioning, cooldown.
- No Olympic lifts or high-skill barbell: NO snatch, clean, clean & jerk, power clean.
- Prefer these modalities if applicable: <<MODALITY_HINTS>>.
- Clear instructions, simple language.
- Each item can include substitutions (array of strings).
- Always include a concise progression_tip.
Return ONLY JSON, no markdown or extra prose.
`;

export async function planWorkout(params: {
  userMsg: string;
  equipment: string[];
  duration: number;
  modalityHints: string;
  styleHint?: string; // e.g., "athletic power", "movement quality circuits"
}): Promise<{ plan: Plan; raw: string }> {
  const eqList = params.equipment.length ? params.equipment.join(', ') : 'none';
  const sys = PLANNER_SYSTEM
    .replace('<<EQUIPMENT>>', eqList)
    .replace('<<DURATION>>', String(params.duration))
    .replace('<<MODALITY_HINTS>>', params.styleHint || params.modalityHints);

  const user = `
Schema: ${JSON.stringify(PlanSchema.shape, null, 2)}
Context:
- Equipment: ${eqList}
- Duration: ${params.duration}
- Modality/style: ${params.styleHint || params.modalityHints}
- User message: "${params.userMsg}"
`;

  const json = await openaiJSON(sys, user, {
    model: 'gpt-4o',
    max_tokens: 1000,
    temperature: 0.4
  });

  const raw = JSON.stringify(json);

  const parsed = PlanSchema.safeParse(json);
  if (!parsed.success) throw new Error('Planner JSON failed validation');
  return { plan: parsed.data, raw };
}
