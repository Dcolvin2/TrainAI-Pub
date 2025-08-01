import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { generateDayPlan } from "@/lib/dayWorkoutService";

export async function GET(req: NextRequest) {
  /** In your real app pull from auth middleware / JWT */
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  try {
    const plan = await generateDayPlan(supabase, userId);
    if ("rest" in plan) return NextResponse.json({ rest: true });

    /* Persist workout & session */
    const { data: session } = await supabase
      .from("workout_sessions")
      .insert({ user_id: userId })
      .select("id")
      .single();

    if (!session) {
      throw new Error("Failed to create workout session");
    }

    const setRows = [
      ...plan.main.map((m, i) => buildSet(session.id, m, i + 1)),
      ...plan.accessories.flatMap((a, idx) =>
        buildSet(session.id, a, idx + 1, false))
    ];
    await supabase.from("workout_sets").insert(setRows);

    await supabase.from("workouts").insert({
      user_id: userId,
      session_type: "strength",
      date: new Date(),
      duration_minutes: plan.duration,
      main_lift: plan.main[0].name,
      main_lifts: plan.main,
      accessory_lifts: plan.accessories,
      warmup: plan.warmup,
      cooldown: plan.cooldown,
      focus_area: plan.focus,
      session_id: session.id   // <= FK convenience if added
    });

    return NextResponse.json(plan);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Workout generation failed" }, { status: 500 });
  }
}

/** helper */
function buildSet(
  sessionId: string,
  ex: { id: string; sets: number; reps: string },
  setNumber: number,
  isMain = true
) {
  return {
    session_id: sessionId,
    exercise_name: ex.id,
    set_number: setNumber,
    prescribed_weight: 0,
    reps: parseInt(ex.reps, 10) || 0,
    rest_seconds: isMain ? 120 : 90
  };
} 