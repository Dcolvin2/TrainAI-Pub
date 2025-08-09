export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') ?? 'Say "pong".';
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-latest',
      max_tokens: 64,
      temperature: 0,
      messages: [{ role: 'user', content: q }],
    });
    const text = (msg.content || [])
      .map((b: any) => (typeof b?.text === 'string' ? b.text : (b?.type === 'text' ? b.text : '')))
      .join('')
      .trim();

    return NextResponse.json({ ok: true, q, text, model: msg.model });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, q, error: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}


