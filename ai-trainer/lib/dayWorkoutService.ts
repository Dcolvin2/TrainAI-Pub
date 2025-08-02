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

// Define what accessories should actually be selected for each core lift
const accessoryMap: Record<string, string[]> = {
  "Barbell Back Squat": [
    "Barbell Romanian Deadlift",
    "Dumbbell Bulgarian Split Squat", 
    "Dumbbell Lunges",
    "Leg Raises",
    "Barbell Hip Thrust",
    "Dumbbell Goblet Squat",
    "Lunge",
    "Single Leg Glute Bridge",
    "Dumbbell Step-Ups",
    "Calf Raises"
  ],
  "Barbell Deadlift": [
    "Barbell Romanian Deadlift",
    "Barbell Good Morning",
    "Barbell Shrug",
    "Pull-Up",
    "Barbell Bent-Over Row",
    "Dumbbell Single-Arm Row",
    "Barbell Hip Thrust",
    "Hanging Knee Raise",
    "Cable Row"
  ],
  "Barbell Bench Press": [
    "Dumbbell Bench Press",
    "Dumbbell Incline Press",
    "Dumbbell Flyes",
    "Dips",
    "Cable Tricep Pushdown",
    "Dumbbell Shoulder Press",
    "Push-Up",
    "Close-Grip Bench Press"
  ],
  "Trap Bar Deadlift": [
    "Barbell Romanian Deadlift",
    "Barbell Good Morning",
    "Barbell Shrug",
    "Pull-Up",
    "Barbell Bent-Over Row",
    "Dumbbell Single-Arm Row",
    "Barbell Hip Thrust",
    "Hanging Knee Raise",
    "Cable Row"
  ],
  "Bench Press": [
    "Dumbbell Bench Press",
    "Dumbbell Incline Press",
    "Dumbbell Flyes",
    "Dips",
    "Cable Tricep Pushdown",
    "Dumbbell Shoulder Press",
    "Push-Up",
    "Close-Grip Bench Press"
  ]
  // Add more for other core lifts...
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

  // Get the predefined accessories for this core lift
  const validAccessoryNames = accessoryMap[coreName] || [];

  // Query only these specific exercises
  const { data: accPool } = await db
    .from("exercises")
    .select("*")
    .in("name", validAccessoryNames)
    .eq("exercise_phase", "accessory");

  console.log(`Found ${accPool?.length} valid accessories for ${coreName}:`, 
    accPool?.map((a: any) => a.name));

  // Select based on available time
  const minutesLeft = targetMinutes - 7 - 12;
  const accCount = Math.max(0, Math.floor(minutesLeft / 5));

  const accessories = _.sampleSize(accPool || [], Math.min(accCount, accPool?.length || 0))
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