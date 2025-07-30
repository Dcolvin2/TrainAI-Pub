import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL}/confirm`;

    // 1) Create user if not exists (no email sent)
    const { error: createErr } = await supabase.auth.admin.createUser({
      email,
      email_confirm: false,
      user_metadata: {},
    });
    if (createErr && !createErr.message.includes('already registered')) {
      return NextResponse.json({ error: createErr.message }, { status: 400 });
    }

    // 2) Send magic-link confirmation email
    const { error: sendErr } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    if (sendErr) {
      return NextResponse.json({ error: sendErr.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'Server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 