import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const { data, error } = await supabase
      .from('workout_types')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching workout types:', error);
      return NextResponse.json({ error: 'Failed to fetch workout types' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in workout types API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 