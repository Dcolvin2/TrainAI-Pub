import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getUserEquipmentNames } from '@/lib/userEquipment';

export const runtime = 'nodejs';

function looksLikeUuid(s?: string | null) {
  return !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

async function resolveUserId(req: Request) {
  const url = new URL(req.url);
  const qs = url.searchParams.get('user') || undefined;
  const segs = url.pathname.split('/').filter(Boolean);
  const lastSeg = segs[segs.length - 1];
  const header = req.headers.get('x-user-id') || undefined;

  let bodyUser: string | undefined;
  if (req.method !== 'GET') {
    try {
      const b = await req.json();
      bodyUser = b?.user || b?.user_id;
    } catch {}
  }

  // First try explicit user ID from various sources
  let user =
    (looksLikeUuid(qs) && qs) ||
    (looksLikeUuid(lastSeg) && lastSeg) ||
    (looksLikeUuid(header) && header) ||
    (looksLikeUuid(bodyUser) && bodyUser) ||
    undefined;

  // If no explicit user ID, try to get from authenticated user
  if (!user) {
    try {
      const supabase = createRouteHandlerClient({ cookies });
      const { data: auth } = await supabase.auth.getUser();
      if (auth?.user?.id) {
        user = auth.user.id;
      }
    } catch (err) {
      // Auth fallback failed, continue with no user
    }
  }

  return { user, echo: { url: url.toString(), qs, lastSeg, header, bodyUser, authFallback: !!user && !(qs || lastSeg || header || bodyUser) } };
}

export async function GET(req: Request) {
  const { user, echo } = await resolveUserId(req);
  if (!user) {
    return NextResponse.json({ 
      ok: false, 
      error: 'Missing user id and no signed-in user found', 
      received: echo,
      hint: 'Try ?user=<uuid> or sign in to your account'
    }, { status: 400 });
  }

  // after you've validated `user`
  type NamesResult =
    | string[]
    | { names: string[]; rows?: any[]; warn?: string[] };

  const result = (await getUserEquipmentNames(user)) as NamesResult;

  const names = Array.isArray(result) ? result : result.names ?? [];
  const rows  = Array.isArray(result) ? undefined : result.rows;
  const warn  = Array.isArray(result) ? [] : result.warn ?? [];

  return NextResponse.json({
    ok: true,
    user,
    counts: {
      user_equipment: rows ? rows.length : names.length,
      equipment_names: names.length,
    },
    equipment_names: names,
    rows,           // may be undefined (that's fine for debug)
    warnings: warn,
    echo: { url: req.url, qs: user, lastSeg: 'equipment' },
  });
}

// also accept POST so you can test with a JSON body:
export async function POST(req: Request) {
  return GET(req);
}


