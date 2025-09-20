// lib/llm.ts
import { openaiJSON } from './openaiClient';

export async function claudeJSON(
  system: string,
  user: unknown,
  opts?: { temperature?: number; max_tokens?: number }
) {
  // Redirect to OpenAI implementation
  return openaiJSON(system, user, opts);
}
