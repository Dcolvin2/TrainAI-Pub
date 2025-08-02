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

  // In the core exercise fetch:
  const { data: coreEx, error: coreErr } = await db
    .from("exercises")
    .select("*")
    .eq("name", coreName)
    .eq("exercise_phase", "core_lift")
    .single();

  console.log('Core exercise details:', {
    name: coreEx?.name,
    primary_muscle: coreEx?.primary_muscle,
    exercise_phase: coreEx?.exercise_phase
  });

  console.log('Core exercise primary_muscle:', coreEx?.primary_muscle);

  if (coreErr || !coreEx) {
    throw new Error('Core exercise not found');
  }

  // First, check if coreEx.primary_muscle exists
  if (!coreEx.primary_muscle) {
    console.error('Core exercise has no primary_muscle!', coreEx);
    // Set a default based on the exercise name
    if (coreName.includes('Squat')) coreEx.primary_muscle = 'Legs';
    else if (coreName.includes('Bench')) coreEx.primary_muscle = 'Chest';
    else if (coreName.includes('Deadlift')) coreEx.primary_muscle = 'Back';
  }

  const { data: accPool, error: accErr } = await db
    .from("exercises")
    .select("id, name, primary_muscle, exercise_phase")
    .eq("primary_muscle", coreEx.primary_muscle)  // Changed from muscle_group
    .neq("name", coreEx.name)
    .in("exercise_phase", ["accessory", "main"])
    .or(`required_equipment.is.null,required_equipment&&{${userEq.join(",")}}`);

  console.log(`Found ${accPool?.length} accessories for primary_muscle "${coreEx.primary_muscle}"`);
  console.log('Sample accessories:', accPool?.slice(0, 3));

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

  console.log('Selected accessories:', accessories);

  // Build workout response
  return {
    core: {
      name: coreEx.name,
      sets: 4,
      reps: "5",
      focus: coreEx.primary_muscle,
    },
    accessories: accessories
  };
} 