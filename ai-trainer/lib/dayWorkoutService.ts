import _ from "lodash";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/lib/database.types";

type DBS = Database["public"];

export interface WorkoutPlan {
  focus: string;
  duration: number;
  warmup: WarmupCoolDown[];
  main: ExerciseSet[];
  accessories: ExerciseSet[];
  cooldown: WarmupCoolDown[];
}

interface WarmupCoolDown {
  name: string;
  duration: string;
}

interface ExerciseSet {
  id: string;
  name: string;
  sets: number;
  reps: string;
}

/** Day-number → canonical core-lift name */
const coreByDay: Record<number, string> = {
  1: "Back Squat",        // Monday
  2: "Bench Press",       // Tuesday
  4: "Trap Bar Deadlift", // Thursday HIIT
  6: "Trap Bar Deadlift"  // Saturday
};

export async function generateDayPlan(
  db: SupabaseClient<Database>,
  userId: string,
  today = new Date().getDay(),
  targetMinutes = 45
): Promise<WorkoutPlan | { rest: true }> {
  if (today === 0) return { rest: true };                 // Sunday
  if ([3, 5].includes(today)) return cardioOrHiitPlan();  // Wed/Fri

  const coreName = coreByDay[today];
  if (!coreName) throw new Error(`No core lift mapped for day ${today}`);

  /* 1.  Lookup user equipment */
  const { data: eqRows, error: eqErr } = await db
    .from("user_equipment")
    .select("equipment(name)")
    .eq("user_id", userId);

  if (eqErr) throw eqErr;
  const userEq = (eqRows ?? []).map((r: any) => r.equipment?.name).filter(Boolean);

  /* 2. Fetch core exercise row (for id + muscle group) */
  const { data: coreEx, error: coreErr } = await db
    .from("exercises_final")
    .select("id, name, primary_muscle")
    .ilike("name", coreName)
    .maybeSingle();

  if (coreErr || !coreEx) throw coreErr ?? new Error("Core lift not found");

  /* 3. Pick up to 3 accessories that match muscle + equipment */
  const { data: accPool, error: accErr } = await db
    .from("exercises_final")
    .select("id, name")
    .eq("category", "strength")
    .eq("primary_muscle", coreEx.primary_muscle)
    .not("name", "ilike", coreEx.name)
    .filter("equipment_required", "cs", `{${userEq.join(",")}}`);

  if (accErr) throw accErr;
  const accessories = _.sampleSize(accPool ?? [], Math.min(3, (accPool ?? []).length))
    .map((ex) => ({ ...ex, sets: 3, reps: "10-12" }));

  /* 4. Assemble plan (warmup / cooldown are static) */
  const warmup: WarmupCoolDown[] = [
    { name: "Arm Circles", duration: "30 sec" },
    { name: "Leg Swings", duration: "30 sec" },
    { name: "Light Cardio", duration: "2 min" }
  ];
  const cooldown: WarmupCoolDown[] = [
    { name: "Hamstring Stretch", duration: "30 sec" },
    { name: "Quad Stretch", duration: "30 sec" },
    { name: "Shoulder Stretch", duration: "30 sec" }
  ];

  return {
    focus: coreEx.primary_muscle,
    duration: targetMinutes,
    warmup,
    main: [{ ...coreEx, sets: 4, reps: "8-10" }],
    accessories,
    cooldown
  };
}

function cardioOrHiitPlan(): WorkoutPlan {
  /* Very simple stub so we never return empty */
  return {
    focus: "cardiovascular",
    duration: 30,
    warmup: [{ name: "Easy Bike", duration: "5 min" }],
    main: [{ id: "bw-burpees", name: "Burpees", sets: 5, reps: "15" }],
    accessories: [],
    cooldown: [{ name: "Walk", duration: "5 min" }]
  };
} 