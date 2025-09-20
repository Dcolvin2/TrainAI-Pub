// app/api/diag/claude/route.ts
import { NextResponse } from 'next/server';

// Force Node runtime so process.env exists (avoid Edge)
export const runtime = 'nodejs';

export async function GET() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { ok: false, error: 'OPENAI_API_KEY missing in server env' },
      { status: 200 }
    );
  }

  const t0 = Date.now();
  // Small, cheap sanity call
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 16,
      messages: [{ role: 'user', content: 'Reply with the single word: ready' }],
    }),
  });

  const ct = resp.headers.get('content-type') || '';
  const took = Date.now() - t0;

  if (!ct.includes('application/json')) {
    const text = await resp.text();
    return NextResponse.json(
      { ok: false, error: 'Non-JSON from OpenAI', status: resp.status, preview: text.slice(0, 200) },
      { status: 200 }
    );
  }

  const data = await resp.json();
  const msg = data?.choices?.[0]?.message?.content || null;

  return NextResponse.json(
    { ok: true, status: resp.status, model: data?.model, ms: took, reply: msg },
    { status: 200 }
  );
}
