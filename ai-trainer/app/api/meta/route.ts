// Minimal metadata endpoint so smalltalk like "what model are you?" doesn't start a plan.
export async function GET() {
  const provider = 'openai';
  const model = process.env.OPENAI_MODEL || 'gpt-5';
  
  return new Response(JSON.stringify({ ok: true, provider, model }), {
    headers: { 'content-type': 'application/json' },
  });
}
