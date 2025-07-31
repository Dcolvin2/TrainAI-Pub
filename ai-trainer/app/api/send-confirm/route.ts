import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';

interface SendConfirmRequest {
  email: string;
  token: string;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { email, token }: SendConfirmRequest = await req.json();

    if (!email || !token) {
      return NextResponse.json({ error: 'Email and token are required' }, { status: 400 });
    }

    // Send confirmation email
    const { error } = await supabase.auth.admin.generateLink({
      type: 'signup',
      email: email,
      password: 'temporary-password', // Required by Supabase
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/confirm?token=${token}`
      }
    });

    if (error) {
      console.error('Error sending confirmation email:', error);
      return NextResponse.json({ 
        error: 'Failed to send confirmation email' 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Confirmation email sent successfully' 
    });

  } catch (error: any) {
    console.error('Send confirm error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 