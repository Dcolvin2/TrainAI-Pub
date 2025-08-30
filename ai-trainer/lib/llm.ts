// lib/llm.ts
export async function claudeJSON(system: string, user: unknown) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('Missing ANTHROPIC_API_KEY');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20240620',
      max_tokens: 1400,
      system,
      messages: [{ role: 'user', content: JSON.stringify(user) }],
    }),
  });
  const ct = r.headers.get('content-type') || '';
  const raw = await r.text();
  if (!ct.includes('application/json')) throw new Error(`Claude non-JSON ${r.status}: ${raw.slice(0,160)}`);
  const data = JSON.parse(raw);
  const text = data?.content?.[0]?.text ?? '';
  try { return JSON.parse(text); } catch { return { text }; }
}
