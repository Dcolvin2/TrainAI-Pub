import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateDayPlan } from '@/lib/dayWorkoutService';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { userId, day } = await request.json();
    
    if (!userId || !day) {
      return NextResponse.json({ error: 'Missing userId or day' }, { status: 400 });
    }

    /* allow ?durationMin=30, default 45 */
    const mins = Number(request.nextUrl.searchParams.get("durationMin") || "45");
    const plan = await generateDayPlan(supabase, userId, day, mins);

    console.log('Generated workout plan:', JSON.stringify(plan, null, 2));

    return NextResponse.json(plan);

  } catch (error) {
    console.error('Generate workout error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 