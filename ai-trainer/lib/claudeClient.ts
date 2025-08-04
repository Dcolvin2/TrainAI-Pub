import Anthropic from "@anthropic-ai/sdk";     // npm i @anthropic-ai/sdk

export const claude = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
});

export async function chatClaude(prompt: string) {
  const msg = await claude.messages.create({
    model: "claude-3-sonnet-20240229",
    max_tokens: 500,
    temperature: 0.7,
    messages: [
      { role: "user", content: prompt }
    ]
  });
  
  // Extract the text content from the response
  const content = msg.content[0];
  if (content.type === 'text') {
    return content.text;
  }
  
  throw new Error('Unexpected response format from Claude');
} 