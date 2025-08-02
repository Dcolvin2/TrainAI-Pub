import _ from 'lodash';

/* 1️⃣  FIX THE NAME SO IT MATCHES YOUR DB  */
const coreByDay: Record<number, string> = {
  1: "Barbell Back Squat",   // ← exactly as it appears in exercise.name
  2: "Bench Press",
  4: "Trap Bar Deadlift",
  6: "Trap Bar Deadlift"
};

// Muscle group map to match your database
const muscleGroupMap: Record<string, string[]> = {
  "Barbell Back Squat": ["quads", "glutes", "hamstrings"],
  "Barbell Front Squat": ["quads", "glutes"],
  "Barbell Bench Press": ["chest", "triceps", "shoulders"],
  "Barbell Deadlift": ["back", "hamstrings", "glutes"],
  "Barbell Sumo Deadlift": ["back", "hamstrings", "glutes"],
  "Trap Bar Deadlift": ["back", "hamstrings", "glutes"],
  "Barbell Overhead Press": ["shoulders", "triceps", "chest"],
  "Barbell Bent-Over Row": ["back", "biceps", "rear delts"],
  "Pull-Up": ["back", "biceps"],
  "Parallel Bar Dips": ["triceps", "chest", "shoulders"]
};

// Intelligent exercise selection configuration
const coreLiftMuscleMap: Record<string, {
  primary: string[];
  secondary: string[];
  avoidCategories: string[];
  preferEquipment: string[];
}> = {
  "Barbell Back Squat": {
    primary: ["quads", "glutes"],
    secondary: ["hamstrings", "core"],
    avoidCategories: ["hiit", "endurance"], // for main accessories
    preferEquipment: ["Barbell", "Dumbbells", "Kettlebells"]
  },
  "Barbell Deadlift": {
    primary: ["back", "hamstrings"],
    secondary: ["glutes", "traps", "grip"],
    avoidCategories: ["hiit", "mobility"],
    preferEquipment: ["Barbell", "Dumbbells", "Trap Bar"]
  },
  "Barbell Bench Press": {
    primary: ["chest", "triceps"],
    secondary: ["shoulders"],
    avoidCategories: ["hiit", "endurance"],
    preferEquipment: ["Dumbbells", "Cables", "Barbell"]
  },
  "Trap Bar Deadlift": {
    primary: ["back", "hamstrings"],
    secondary: ["glutes", "traps", "grip"],
    avoidCategories: ["hiit", "mobility"],
    preferEquipment: ["Trap Bar", "Dumbbells", "Barbell"]
  },
  "Bench Press": {
    primary: ["chest", "triceps"],
    secondary: ["shoulders"],
    avoidCategories: ["hiit", "endurance"],
    preferEquipment: ["Dumbbells", "Cables", "Barbell"]
  }
  // ... etc for other lifts
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

  // Get target muscles for this core exercise
  const targetMuscles = muscleGroupMap[coreName] || [coreEx.primary_muscle];
  console.log('Target muscles for', coreName, ':', targetMuscles);

  // Get exercise pool with better filtering
  const liftConfig = coreLiftMuscleMap[coreName];
  if (!liftConfig) {
    console.warn(`No lift configuration found for ${coreName}, using fallback`);
    // Fallback to original logic
    const { data: accPool } = await db
      .from("exercises")
      .select("id, name, primary_muscle, category, required_equipment")
      .in("primary_muscle", targetMuscles)
      .in("category", ["strength", "hypertrophy"])
      .eq("exercise_phase", "accessory")
      .neq("name", coreEx.name)
      .or(`required_equipment.is.null,required_equipment&&{${userEq.join(",")}}`);

    const minutesLeft = targetMinutes - 7 - 12;
    const accCount = Math.max(0, Math.floor(minutesLeft / 5));
    const accessories = _.sampleSize(accPool || [], Math.min(accCount, accPool?.length || 0))
      .map((ex: any) => ({ ...ex, sets: 3, reps: "10-12" }));

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

  const { data: strengthAccessories } = await db
    .from("exercises")
    .select("*")
    .in("primary_muscle", liftConfig.primary)
    .in("category", ["strength", "hypertrophy"])
    .eq("exercise_phase", "accessory")
    .not("category", "in", `(${liftConfig.avoidCategories.join(",")})`)
    .neq("name", coreName);

  console.log(`Found ${strengthAccessories?.length} strength/hypertrophy accessories for ${coreName}`);

  // If user has equipment preferences, prioritize those
  const scoredAccessories = strengthAccessories?.map((ex: any) => ({
    ...ex,
    score: (
      (liftConfig.primary.includes(ex.primary_muscle) ? 3 : 0) +
      (liftConfig.preferEquipment.some((eq: string) => ex.required_equipment?.includes(eq)) ? 2 : 0) +
      (ex.category === "hypertrophy" ? 1 : 0)
    )
  })).sort((a: any, b: any) => b.score - a.score);

  console.log('Scored accessories:', scoredAccessories?.slice(0, 5).map((ex: any) => ({
    name: ex.name,
    score: ex.score,
    primary_muscle: ex.primary_muscle,
    category: ex.category
  })));

  // Calculate accessories based on time
  const minutesLeft = targetMinutes - 7 - 12;
  const accCount = Math.max(0, Math.floor(minutesLeft / 5));

  // Take top scored exercises based on time
  const accessories = scoredAccessories
    ?.slice(0, accCount)
    .map((ex: any) => ({ ...ex, sets: 3, reps: "10-12" }));

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