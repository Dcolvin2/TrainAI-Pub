import { NextRequest, NextResponse } from 'next/server';

interface SendConfirmRequest {
  email: string;
  token: string;
}

export async function POST(req: NextRequest) {
  try {
    // Initialize Supabase inside the function using dynamic import
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);

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

  } catch (error) {
    console.error('Send confirm error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
} 