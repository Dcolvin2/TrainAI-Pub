export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { chatOpenAI } from '@/lib/openaiClient';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') ?? 'Say "pong".';
  try {
    const text = await chatOpenAI(q, {
      model: 'gpt-4o',
      max_tokens: 64,
      temperature: 0
    });

    return NextResponse.json({ ok: true, q, text, model: 'gpt-4o' });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, q, error: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}


