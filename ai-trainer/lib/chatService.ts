import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function chatWithFunctions(
  history: { role: 'system'|'user'|'assistant'|'function'; name?: string; content: string }[]
): Promise<string> {
  const functions: any[] = []; // we'll add schemas later
  while (true) {
    const resp = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: history,
      functions,
      function_call: 'auto',
    });
    const msg = resp.choices[0].message!;
    if (msg.function_call) {
      // stub: just echo back for now
      history.push({
        role: 'function',
        name: msg.function_call.name,
        content: '[]',
      });
      continue;
    }
    return msg.content || '';
  }
} 