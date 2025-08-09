import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get('q') || 'Say "pong".';
  
  return NextResponse.json({
    ok: true,
    message: 'Ping endpoint is working',
    query: q,
    timestamp: new Date().toISOString(),
  });
}
