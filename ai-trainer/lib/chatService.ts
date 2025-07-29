import OpenAI from 'openai';
import { workoutSchema } from './workoutSchema';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface FunctionSchema {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

interface ChatCompletionPayload {
  model: string;
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
  functions?: FunctionSchema[];
  function_call?: "auto" | "none" | { name: string };
}

interface FunctionCallResult {
  name: string;
  arguments: Record<string, unknown>;
}

interface ChatResponse {
  content: string;
  functionCall?: FunctionCallResult;
}

export async function chatWithFunctions(
  history: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
): Promise<ChatResponse> {
  const functions: FunctionSchema[] = [workoutSchema]; // Add workout schema
  while (true) {
    const payload: ChatCompletionPayload = {
      model: "gpt-4o-mini",   // ← hard-coded upgrade
      messages: history,
      functions,
      function_call: { name: "updateWorkout" },   // ← FORCE updateWorkout every time
    };

    const resp = await client.chat.completions.create(payload);
    const msg = resp.choices[0].message!;
    
    if (msg.function_call) {
      // Return function call data
      return {
        content: '',
        functionCall: {
          name: msg.function_call.name,
          arguments: JSON.parse(msg.function_call.arguments)
        }
      };
    }
    
    return { content: msg.content || '' };
  }
} 