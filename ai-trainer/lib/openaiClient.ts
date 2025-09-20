import OpenAI from 'openai';

// Lazy initialization to avoid build-time errors
let openaiInstance: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiInstance) {
    // Get the OpenAI API key from environment
    const apiKey = process.env.OPENAI_API_KEY;
    
    console.log('🔍 Environment check:', {
      hasApiKey: !!apiKey,
      keyLength: apiKey ? apiKey.length : 0,
      keyPrefix: apiKey ? apiKey.substring(0, 10) + '...' : 'none',
      allEnvKeys: Object.keys(process.env).filter(k => k.includes('OPENAI') || k.includes('API')),
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV
    });
    
    if (!apiKey) {
      const availableKeys = Object.keys(process.env).filter(k => 
        k.includes('OPENAI') || k.includes('API') || k.includes('KEY')
      );
      throw new Error(`OPENAI_API_KEY environment variable is not set. 
        Available env vars: ${availableKeys.join(', ')}
        NODE_ENV: ${process.env.NODE_ENV}
        VERCEL_ENV: ${process.env.VERCEL_ENV}`);
    }
    openaiInstance = new OpenAI({ apiKey });
  }
  return openaiInstance;
}

export const openai = {
  get chat() {
    return getOpenAI().chat;
  },
  get completions() {
    return getOpenAI().completions;
  }
};

export async function chatOpenAI(prompt: string, options?: {
  model?: string;
  max_tokens?: number;
  temperature?: number;
  system?: string;
}) {
  const response = await getOpenAI().chat.completions.create({
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
  
  const response = await getOpenAI().chat.completions.create({
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
