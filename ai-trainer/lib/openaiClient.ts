import OpenAI from 'openai';

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function chatOpenAI(prompt: string, options?: {
  model?: string;
  max_tokens?: number;
  temperature?: number;
  system?: string;
}) {
  const response = await openai.chat.completions.create({
    model: options?.model || 'gpt-4o',
    max_tokens: options?.max_tokens || 500,
    temperature: options?.temperature || 0.7,
    messages: [
      ...(options?.system ? [{ role: 'system' as const, content: options.system }] : []),
      { role: 'user' as const, content: prompt }
    ],
  });
  
  return response.choices[0]?.message?.content || '';
}

export async function openaiJSON(
  system: string,
  user: unknown,
  opts?: { temperature?: number; max_tokens?: number; model?: string }
) {
  const temperature = typeof opts?.temperature === 'number' ? opts.temperature : 0.6;
  const max_tokens = typeof opts?.max_tokens === 'number' ? opts.max_tokens : 1400;
  const model = opts?.model || 'gpt-4o';
  
  const response = await openai.chat.completions.create({
    model,
    max_tokens,
    temperature,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: JSON.stringify(user) }
    ],
    response_format: { type: 'json_object' }
  });
  
  const content = response.choices[0]?.message?.content || '{}';
  try {
    return JSON.parse(content);
  } catch {
    return { text: content };
  }
}
