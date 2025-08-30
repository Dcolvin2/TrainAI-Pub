import { chatClaude } from './claudeClient';

type LlmNikeIntent = {
  intent: 'nike' | 'split' | 'chat';
  nike?: { index?: number; type?: string; descriptors?: string[]; confidence: number };
  split?: 'push'|'pull'|'legs'|'hiit';
};

function extractJsonText(raw: string): string {
  const fence = raw.match(/```json([\s\S]*?)```/i);
  return (fence ? fence[1] : raw).trim();
}

export async function classifyWithLLM(raw: string): Promise<LlmNikeIntent> {
  const system =
    'Classify the user request into JSON only. Schema: {"intent":"nike|split|chat","nike":{"index":number?,"type":string?,"descriptors":string[],"confidence":0..1}?,"split":"push|pull|legs|hiit"}. Only return JSON. If user refers to our programmed Nike templates by order (e.g., "second"), choose intent:"nike".';

  const prompt = `${system}\n\nUser request: ${raw}`;

  const rawText = await chatClaude(prompt);

  try {
    const jsonText = extractJsonText(rawText);
    const parsed = JSON.parse(jsonText) as LlmNikeIntent;
    // Basic shape guard
    if (!parsed || typeof parsed !== 'object' || !('intent' in parsed)) {
      return { intent: 'chat' };
    }
    return parsed;
  } catch {
    return { intent: 'chat' };
  }
}
