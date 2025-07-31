import OpenAI from 'openai';
import { workoutSchema } from './workoutSchema';
import { chooseModel } from '@/utils/chooseModel';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Global cost tracking
declare global {
  var cost: { mini: number; full: number } | undefined;
}

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
  temperature?: number;
}

interface FunctionCallResult {
  name: string;
  arguments: Record<string, unknown>;
}

interface ChatResponse {
  content: string;
  functionCall?: FunctionCallResult;
  modelUsed: string;
  tokensUsed?: number;
}

export async function chatWithFunctions(
  history: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
): Promise<ChatResponse> {
  const functions: FunctionSchema[] = [workoutSchema]; // Add workout schema
  
  // Get the last user message to choose model
  const lastUserMessage = history.find(msg => msg.role === 'user');
  const userInput = typeof lastUserMessage?.content === 'string' 
    ? lastUserMessage.content 
    : Array.isArray(lastUserMessage?.content) 
      ? lastUserMessage.content.map((part: any) => 
          typeof part === 'string' ? part : part.text || ''
        ).join(' ')
      : '';
  const model = chooseModel(userInput);
  
  while (true) {
    const payload: ChatCompletionPayload = {
      model,
      messages: history,
      functions,
      function_call: { name: "updateWorkout" },   // ← FORCE updateWorkout every time
      temperature: model === "gpt-4o-mini" ? 0.4 : 0.7,
    };

    const resp = await client.chat.completions.create(payload);
    const msg = resp.choices[0].message!;
    
    // Monitor cost
    globalThis.cost = globalThis.cost ?? { mini: 0, full: 0 };
    const tokensUsed = resp.usage?.total_tokens ?? 0;
    
    if (model === "gpt-4o-mini") {
      globalThis.cost.mini += tokensUsed;
    } else {
      globalThis.cost.full += tokensUsed;
    }
    
    console.log(`[AI] model = ${model}, tokens = ${tokensUsed}`);
    console.log("[COST] cumulative", globalThis.cost);
    
    if (msg.function_call) {
      // Return function call data
      return {
        content: '',
        functionCall: {
          name: msg.function_call.name,
          arguments: JSON.parse(msg.function_call.arguments)
        },
        modelUsed: model,
        tokensUsed
      };
    }
    
    return { 
      content: msg.content || '', 
      modelUsed: model,
      tokensUsed
    };
  }
} 