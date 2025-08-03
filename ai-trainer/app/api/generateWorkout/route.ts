import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateDayPlan } from '@/lib/dayWorkoutService';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const mins = Number(req.nextUrl.searchParams.get("durationMin") ?? "45");
  const override = Number(req.nextUrl.searchParams.get("debugDay") ?? NaN);
  const plan = await generateDayPlan(
    supabase,
    userId,
    Number.isNaN(override) ? undefined : override,
    mins
  );

  return NextResponse.json(plan);
} 