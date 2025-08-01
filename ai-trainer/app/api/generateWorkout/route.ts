import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { coreByDay, buildSet } from '@/lib/dayWorkoutService';

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

    // Get user equipment
    const { data: userEquipment } = await supabase
      .from("user_equipment")
      .select("equipment!inner(name)")
      .eq("user_id", userId);
    
    const userEq = (userEquipment as any[])?.map(r => r.equipment.name) || [];

    // Get core exercise for the day
    const dayNumber = new Date(day).getDay(); // 0 = Sunday, 1 = Monday, etc.
    const coreName = coreByDay[dayNumber];
    
    if (!coreName) {
      return NextResponse.json({ error: 'No core exercise for this day' }, { status: 400 });
    }

    /* 👉 use the real `exercises` table */
    const { data: coreEx, error: coreErr } = await supabase
      .from("exercises")
      .select("id, name, muscle_group")     /* column names in exercises */
      .ilike("name", coreName)
      .maybeSingle();

    if (coreErr || !coreEx) {
      return NextResponse.json({ error: 'Core exercise not found' }, { status: 404 });
    }

    // Get accessory pool based on muscle group
    const { data: accPool, error: accErr } = await supabase
      .from("exercises")
      .select("id, name")
      .eq("muscle_group", coreEx.muscle_group)          /* match by muscle_group */
      .not("name", "ilike", coreEx.name)
      .filter("required_equipment", "cs", `{${userEq.join(",")}}`);  /* column in exercises */

    if (accErr) {
      return NextResponse.json({ error: 'Failed to fetch accessories' }, { status: 500 });
    }

    // Build workout response
    const workout = {
      core: {
        name: coreEx.name,
        sets: 3,
        reps: "5",
        focus: coreEx.muscle_group,
      },
      accessories: accPool?.slice(0, 3).map(ex => ({
        name: ex.name,
        sets: 3,
        reps: "10"
      })) || []
    };

    return NextResponse.json(workout);

  } catch (error) {
    console.error('Generate workout error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 