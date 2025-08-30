import { chatClaude } from './claudeClient';

type LlmNikeIntent = {
  intent: 'nike' | 'split' | 'chat';
  nike?: { index?: number; type?: string; descriptors?: string[]; confidence: number };
  split?: 'push'|'pull'|'legs'|'hiit';
};

export async function classifyWithLLM(raw: string): Promise<LlmNikeIntent> {
  const system = `Classify the user request into JSON only. Schema: {"intent":"nike|split|chat","nike":{"index":number?,"type":string?,"descriptors":string[],"confidence":0..1}?,"split":"push|pull|legs|hiit"}. Only return JSON. If user refers to our programmed Nike templates by order (e.g., "second"), choose intent:"nike".`;
  const user = raw;

  const rawText = await chatClaude(system, user);
  try {
    const fence = rawText.match(/```json([\s\S]*?)```/i);
    const j = JSON.parse((fence ? fence[1] : rawText).trim());
    return j;
  } catch {
    return { intent: 'chat' };
  }
}
