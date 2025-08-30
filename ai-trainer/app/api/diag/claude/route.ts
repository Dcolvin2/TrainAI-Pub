// app/api/diag/claude/route.ts
import { NextResponse } from 'next/server';

// Force Node runtime so process.env exists (avoid Edge)
export const runtime = 'nodejs';

export async function GET() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json(
      { ok: false, error: 'ANTHROPIC_API_KEY missing in server env' },
      { status: 200 }
    );
  }

  const t0 = Date.now();
  // Small, cheap sanity call
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20240620',
      max_tokens: 16,
      messages: [{ role: 'user', content: 'Reply with the single word: ready' }],
    }),
  });

  const ct = resp.headers.get('content-type') || '';
  const took = Date.now() - t0;

  if (!ct.includes('application/json')) {
    const text = await resp.text();
    return NextResponse.json(
      { ok: false, error: 'Non-JSON from Anthropic', status: resp.status, preview: text.slice(0, 200) },
      { status: 200 }
    );
  }

  const data = await resp.json();
  const msg = data?.content?.[0]?.text || null;

  return NextResponse.json(
    { ok: true, status: resp.status, model: data?.model, ms: took, reply: msg },
    { status: 200 }
  );
}
