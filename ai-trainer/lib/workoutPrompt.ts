// lib/workoutPrompt.ts
import type { StrictPlan } from './types';

const BANNED = ['snatch', 'clean', 'jerk', 'high pull'];

export function buildWorkoutPrompt(input: {
  userMessage: string;
  minutes: number;
  availableEquipment: string[];
  styleHint?: string | null; // e.g., "joe holder", "chris hemsworth"
}) {
  const { userMessage, minutes, availableEquipment, styleHint } = input;
  return `
Return ONLY valid JSON (no markdown). Use this schema:

{
  "name": string,
  "duration_min": number,
  "phases": [
    { "phase": "warmup" | "main" | "accessory" | "conditioning" | "cooldown",
      "items": [
        { "name": string, "sets": string|number, "reps": string|number, "instruction": string|null, "isAccessory": boolean|optional }
      ]
    }
  ],
  "est_total_minutes": number
}

Rules:
- Total time <= ${minutes}.
- Use ONLY equipment from: ${availableEquipment.join(', ') || 'Bodyweight only'}.
- If equipment isn't required, bodyweight is fine.
- Include *accessory* items after the main lift (1–3+).
- Avoid Olympic/advanced lifts: ${BANNED.join(', ')} (and their variations).
- If the user hints at a persona/coach (e.g., ${styleHint ?? 'none'}), mirror the style but still obey equipment gating.
- If user asks "kettlebell workout" or similar, prioritize kettlebell-based options when available.
- Always produce warmup and cooldown phases.

User request:
"${userMessage}"
`.trim();
}
