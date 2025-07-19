import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Handle missing environment variables gracefully for build
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';

const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: NextRequest) {
  try {
    // If we're using placeholder values, return early
    if (supabaseUrl === 'https://placeholder.supabase.co' || supabaseKey === 'placeholder-key') {
      return NextResponse.json({ error: 'Service not configured' }, { status: 503 });
    }

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