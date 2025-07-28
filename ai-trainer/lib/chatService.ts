import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface FunctionSchema {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export async function chatWithFunctions(
  history: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
): Promise<string> {
  const functions: FunctionSchema[] = []; // we'll add schemas later
  while (true) {
    const resp = await client.chat.completions.create({
      model: "gpt-4o-mini",   // ← hard-coded upgrade
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