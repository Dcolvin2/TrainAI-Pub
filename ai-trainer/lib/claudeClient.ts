import Anthropic from "@anthropic-ai/sdk";

// Initialize Claude client
export const claude = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
});

// Simplified chat function
export async function chatClaude(prompt: string) {
  try {
    const response = await claude.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 2000,
      temperature: 0.7,
      messages: [{ role: "user", content: prompt }]
    });

    const content = response.content[0];
    if (content.type === 'text') {
      return content.text;
    }

    throw new Error('Unexpected response format from Claude');
  } catch (error) {
    console.error('Claude API error:', error);
    throw error;
  }
} 