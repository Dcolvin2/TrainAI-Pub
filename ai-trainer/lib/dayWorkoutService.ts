import _ from 'lodash';

/* 1️⃣  FIX THE NAME SO IT MATCHES YOUR DB  */
const coreByDay: Record<number, string> = {
  1: "Barbell Back Squat",   // ← exactly as it appears in exercise.name
  2: "Bench Press",
  4: "Trap Bar Deadlift",
  6: "Trap Bar Deadlift"
};

export { coreByDay };

// Helper function to build set data for database insertion
export function buildSet(
  sessionId: string,
  ex: { name: string; sets: number; reps: string },
  setNumber: number,
  isMain = true
) {
  return {
    session_id: sessionId,
    /* 🔁 use the text name column that already exists   */
    exercise_name: ex.name,
    set_number: setNumber,
    prescribed_weight: 0,
    reps: parseInt(ex.reps, 10) || 0,
    rest_seconds: isMain ? 120 : 90
  };
}

// Generate day plan with duration-aware accessory selection
export async function generateDayPlan(
  db: any,
  userId: string,
  day?: string,
  targetMinutes: number = 45
) {
  // Get user equipment
  const { data: userEquipment } = await db
    .from("user_equipment")
    .select("equipment!inner(name)")
    .eq("user_id", userId);
  
  const userEq = (userEquipment as any[])?.map((r: any) => r.equipment.name) || [];

  // Get core exercise for the day
  const dayNumber = day ? new Date(day).getDay() : new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.
  const coreName = coreByDay[dayNumber];
  
  if (!coreName) {
    throw new Error('No core exercise for this day');
  }

  /* 👉 use the real `exercises` table */
  const { data: coreEx, error: coreErr } = await db
    .from("exercises")
    .select("id, name, muscle_group")     /* column names in exercises */
    .ilike("name", coreName)
    .maybeSingle();

  if (coreErr || !coreEx) {
    throw new Error('Core exercise not found');
  }

  // === accessory pool query ===
  const { data: accPool, error: accErr } = await db
    .from("exercises")
    .select("id, name")
    .eq("muscle_group", coreEx.muscle_group)
    .not("name", "ilike", coreEx.name)
    /* 👇 allow either body-weight (NULL) or matching equipment */
    .or(
      `required_equipment.is.null,required_equipment&&{${userEq.join(",")}}`
    );

  if (accErr) {
    throw new Error('Failed to fetch accessories');
  }

  // === choose accessories ===
  /* Decide how many accessories fit the time budget */
  const minutesLeft =
    targetMinutes                       /* full session */
    - 7                                 /* 5′ warm-up + 2′ cooldown */
    - 4 * 3;                            /* main lift: 4 sets × (1′ set + 2′ rest) */

  /* assume each accessory block ≈ 5′ (3 sets × 1′ set + 1′ rest) */
  const accCount = Math.max(0, Math.floor(minutesLeft / 5));

  const accessories = _.sampleSize(accPool ?? [], Math.min(accCount, (accPool ?? []).length))
    .map((ex) => ({ ...ex, sets: 3, reps: "10-12" }));

  // Build workout response
  return {
    core: {
      name: coreEx.name,
      sets: 4,
      reps: "5",
      focus: coreEx.muscle_group,
    },
    accessories: accessories
  };
} 