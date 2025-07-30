import { workoutSchema } from './workoutSchema';

// Global cost tracking
declare global {
  var cost: { claude: number } | undefined;
}

interface FunctionSchema {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

interface ChatCompletionPayload {
  model: string;
  messages: any[];
  max_tokens?: number;
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
  history: any[]
): Promise<ChatResponse> {
  const model = "claude-3-5-sonnet-20241022";
  
  // Convert OpenAI format to Claude format
  const claudeMessages = history.map(msg => ({
    role: msg.role,
    content: msg.content
  }));

  // Add function calling instructions to the system message
  const systemMessage = claudeMessages.find(msg => msg.role === 'system');
  if (systemMessage) {
    systemMessage.content += `

IMPORTANT: You must ALWAYS call the updateWorkout function when generating or modifying workouts. 
Here's the function schema:
${JSON.stringify(workoutSchema, null, 2)}

You must respond with a JSON object that matches this schema exactly.`;
  }

  while (true) {
    const payload = {
      model,
      messages: claudeMessages,
      max_tokens: 4000,
      temperature: 0.7,
    };

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status} ${response.statusText}`);
    }

    const resp = await response.json();
    const msg = resp.content[0];
    
    // Monitor cost
    globalThis.cost = globalThis.cost ?? { claude: 0 };
    const tokensUsed = (resp.usage?.input_tokens || 0) + (resp.usage?.output_tokens || 0);
    globalThis.cost.claude += tokensUsed;
    
    console.log(`[AI] model = ${model}, tokens = ${tokensUsed}`);
    console.log("[COST] cumulative", globalThis.cost);
    
    // Check if response contains function call
    const content = msg.text;
    if (content.includes('updateWorkout') && content.includes('{')) {
      try {
        // Extract JSON from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const functionData = JSON.parse(jsonMatch[0]);
          return {
            content: '',
            functionCall: {
              name: 'updateWorkout',
              arguments: functionData
            },
            modelUsed: model,
            tokensUsed
          };
        }
      } catch (error) {
        console.error('Failed to parse function call:', error);
      }
    }
    
    return { 
      content: content, 
      modelUsed: model,
      tokensUsed
    };
  }
} 