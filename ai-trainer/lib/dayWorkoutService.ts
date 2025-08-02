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

// Comprehensive accessory selection system based on training principles
const trainingPrinciples = {
  "Barbell Back Squat": {
    // Primary muscles that need development
    primaryTargets: ["quads", "glutes", "hamstrings"],
    
    // Movement patterns that complement the main lift
    movementPatterns: {
      bilateral: ["Romanian Deadlift", "Front Squat", "Leg Press", "Barbell Hip Thrust"],
      unilateral: ["Bulgarian Split Squat", "Walking Lunges", "Step-Ups", "Single Leg RDL"],
      isolation: ["Leg Curls", "Leg Extensions", "Calf Raises"]
    },
    
    // Accessories to avoid (wrong pattern or muscle group)
    avoid: {
      categories: ["hiit", "endurance", "mobility"],
      namePatterns: ["stretch", "battle rope", "jump", "band", "foam roll"],
      muscleGroups: ["chest", "shoulders", "triceps", "biceps"]
    },
    
    // Ideal rep ranges for accessories
    repSchemes: {
      compound: "6-10",
      isolation: "10-15",
      unilateral: "8-12"
    }
  },
  
  "Barbell Deadlift": {
    primaryTargets: ["back", "hamstrings", "glutes"],
    movementPatterns: {
      hip_hinge: ["Romanian Deadlift", "Good Morning", "Stiff Leg Deadlift"],
      pulling: ["Barbell Row", "Pull-Up", "Cable Row", "Dumbbell Row"],
      isolation: ["Hamstring Curls", "Back Extensions", "Shrugs"]
    },
    avoid: {
      categories: ["hiit", "mobility"],
      namePatterns: ["jump", "battle rope", "stretch"],
      muscleGroups: ["chest", "quads"]
    },
    repSchemes: {
      compound: "6-10",
      isolation: "10-15",
      unilateral: "8-12"
    }
  },

  "Trap Bar Deadlift": {
    primaryTargets: ["back", "hamstrings", "glutes"],
    movementPatterns: {
      hip_hinge: ["Romanian Deadlift", "Good Morning", "Stiff Leg Deadlift"],
      pulling: ["Barbell Row", "Pull-Up", "Cable Row", "Dumbbell Row"],
      isolation: ["Hamstring Curls", "Back Extensions", "Shrugs"]
    },
    avoid: {
      categories: ["hiit", "mobility"],
      namePatterns: ["jump", "battle rope", "stretch"],
      muscleGroups: ["chest", "quads"]
    },
    repSchemes: {
      compound: "6-10",
      isolation: "10-15",
      unilateral: "8-12"
    }
  },

  "Bench Press": {
    primaryTargets: ["chest", "triceps", "shoulders"],
    movementPatterns: {
      pushing: ["Dumbbell Bench Press", "Incline Press", "Dips", "Close-Grip Bench"],
      isolation: ["Dumbbell Flyes", "Tricep Pushdowns", "Lateral Raises"]
    },
    avoid: {
      categories: ["hiit", "endurance"],
      namePatterns: ["jump", "battle rope", "stretch"],
      muscleGroups: ["quads", "hamstrings", "glutes"]
    },
    repSchemes: {
      compound: "6-10",
      isolation: "10-15",
      unilateral: "8-12"
    }
  }
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

// Smart accessory selection function
async function selectAccessories(db: any, coreLift: string, targetMinutes: number, userEquipment: string[]) {
  const principles = trainingPrinciples[coreLift as keyof typeof trainingPrinciples];
  if (!principles) {
    console.warn(`No training principles found for ${coreLift}, using fallback`);
    return [];
  }
  
  // Calculate how many accessories we can fit
  const accessoryMinutes = targetMinutes - 20; // Core lift + warmup/cooldown
  const numAccessories = Math.floor(accessoryMinutes / 6); // ~6 min per accessory
  
  console.log(`Planning ${numAccessories} accessories for ${coreLift} (${accessoryMinutes} minutes available)`);
  
  // Get all potential accessories
  const { data: exercises } = await db
    .from("exercises")
    .select("*")
    .in("primary_muscle", principles.primaryTargets)
    .eq("exercise_phase", "accessory")
    .not("category", "in", `(${principles.avoid.categories.join(",")})`);
  
  console.log(`Found ${exercises?.length} potential accessories for ${coreLift}`);
  
  // Score each exercise based on coaching principles
  const scoredExercises = exercises?.map((ex: any) => {
    let score = 0;
    
    // High score for matching movement patterns
    Object.values(principles.movementPatterns).forEach((patterns: any) => {
      if (patterns.includes(ex.name)) score += 10;
    });
    
    // Medium score for correct muscle group
    if (principles.primaryTargets.includes(ex.primary_muscle)) score += 5;
    
    // Lower score if it's just "hypertrophy" category
    if (ex.category === "hypertrophy") score += 3;
    if (ex.category === "strength") score += 4;
    
    // Penalty for avoid patterns
    principles.avoid.namePatterns.forEach((pattern: string) => {
      if (ex.name.toLowerCase().includes(pattern)) score -= 10;
    });
    
    // Penalty for wrong muscle groups
    if (principles.avoid.muscleGroups.includes(ex.primary_muscle)) score -= 10;
    
    return { ...ex, score };
  }) || [];
  
  console.log('Top scored exercises:', scoredExercises
    .filter((ex: any) => ex.score > 0)
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, 5)
    .map((ex: any) => ({ name: ex.name, score: ex.score, primary_muscle: ex.primary_muscle }))
  );
  
  // Sort by score and select top exercises
  const selectedAccessories = scoredExercises
    .filter((ex: any) => ex.score > 0)
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, numAccessories);
  
  // Ensure variety (not all bilateral, not all isolation)
  const finalSelection = ensureVariety(selectedAccessories, principles.movementPatterns);
  
  console.log('Final selection with variety:', finalSelection.map((ex: any) => ex.name));
  
  // Add appropriate rep schemes
  return finalSelection.map((ex: any) => ({
    ...ex,
    sets: 3,
    reps: getRepScheme(ex, principles.repSchemes)
  }));
}

function ensureVariety(exercises: any[], patterns: any) {
  // Make sure we have a mix of bilateral, unilateral, and isolation
  const bilateral = exercises.filter((ex: any) => patterns.bilateral?.includes(ex.name));
  const unilateral = exercises.filter((ex: any) => patterns.unilateral?.includes(ex.name));
  const isolation = exercises.filter((ex: any) => patterns.isolation?.includes(ex.name));
  
  console.log(`Variety breakdown: ${bilateral.length} bilateral, ${unilateral.length} unilateral, ${isolation.length} isolation`);
  
  // Take at least one from each category if available
  return [
    ...bilateral.slice(0, 2),
    ...unilateral.slice(0, 1),
    ...isolation.slice(0, 1)
  ];
}

function getRepScheme(exercise: any, repSchemes: any) {
  // Determine if it's compound, isolation, or unilateral based on name patterns
  if (exercise.name.toLowerCase().includes('curl') || 
      exercise.name.toLowerCase().includes('extension') ||
      exercise.name.toLowerCase().includes('raise')) {
    return repSchemes.isolation || "10-15";
  }
  
  if (exercise.name.toLowerCase().includes('split') ||
      exercise.name.toLowerCase().includes('lunge') ||
      exercise.name.toLowerCase().includes('step')) {
    return repSchemes.unilateral || "8-12";
  }
  
  return repSchemes.compound || "6-10";
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

  // Use the smart accessory selection system
  const accessories = await selectAccessories(db, coreName, targetMinutes, userEq);

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