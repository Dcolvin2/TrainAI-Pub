import { fetchEquipmentAndExercises } from "./fetchEquipmentAndExercises";
import { pickAccessories } from "./rotateAccessories";
import { Exercise } from "@/types/Exercise";

const TEMPLATE = {
  Monday:   { core: "Back Squat",   muscles: ["Quadriceps","Glutes","Hamstrings"] },
  Tuesday:  { core: "Bench Press",  muscles: ["Chest","Triceps","Shoulders"] },
  Wednesday:{ core: null,          muscles: ["Cardio"] },   // cardio day
  Thursday: { core: null,          muscles: ["HIIT"] },     // HIIT WOD
  Friday:   { core: null,          muscles: ["Cardio"] },
  Saturday: { core: "Deadlift",     muscles: ["Hamstrings","Back"] },
  Sunday:   { core: null,          muscles: ["Cardio"] },
};

interface WorkoutByDayResult {
  warmupArr: Exercise[];
  coreLift: Exercise | null;
  accessories: Exercise[];
  cooldownArr: Exercise[];
}

export async function buildWorkoutByDay(
  userId: string,
  day: string,               // e.g. "Saturday"
  minutes = 45
): Promise<WorkoutByDayResult> {
  const { exercises } = await fetchEquipmentAndExercises(userId);

  // 1️⃣ choose template
  const t = TEMPLATE[day as keyof typeof TEMPLATE];
  if (!t) throw new Error("Unknown day");

  // 2️⃣ core lift (if any)
  const coreLift: Exercise | null = t.core
    ? exercises.find(e => e.name.toLowerCase().includes(t.core!.toLowerCase())) || null
    : null;

  // 3️⃣ Robust coreMuscles extraction
  function parseMuscles(str: string | string[] | null): string[] {
    if (!str) return [];
    if (Array.isArray(str)) return str;
    return str.split(/[,/]/).map(s => s.trim());  // "Chest, Triceps" → ["Chest","Triceps"]
  }

  const coreMuscles = coreLift
    ? parseMuscles(coreLift.primary_muscle)
    : t.muscles;

  console.log("[TRACE] core muscles", coreMuscles);

  // 4️⃣ Rewrite pickPhase for strict match (+ fallback)
  function logPool(label: string, pool: any[]) {
    console.log(
      `[TRACE] ${label} (${pool.length}) →`,
      pool.map(e => `${e.name} [${e.primary_muscle}]`)
    );
  }

  function pickPhase(phase: "warmup" | "cooldown", target: number): Exercise[] {
    const strict = exercises.filter(
      e => e.exercise_phase === phase &&
           parseMuscles(e.primary_muscle).some(m => coreMuscles.includes(m))
    );
    logPool(`${phase}-STRICT`, strict);

    const bodyWeight = exercises.filter(
      e => e.exercise_phase === phase && (!e.equipment_required?.length)
    );
    logPool(`${phase}-BW`, bodyWeight);

    const any = exercises.filter(e => e.exercise_phase === phase);
    logPool(`${phase}-ANY`, any);

    const pool =
      strict.length >= target ? strict :
      strict.concat(bodyWeight).slice(0, target);

    return pool.sort(() => 0.5 - Math.random()).slice(0, target);
  }

  const warmupArr = pickPhase("warmup", minutes <= 30 ? 2 : 3);
  const cooldownArr = pickPhase("cooldown", minutes <= 30 ? 2 : 3);

  console.log("[TRACE] warmup picked", warmupArr.map(e => e.name));
  console.log("[TRACE] cooldown picked", cooldownArr.map(e => e.name));

  // 5️⃣ Balanced accessories with muscle group targeting
  function pickBalancedAccessories(): Exercise[] {
    // Determine target muscle groups based on day
    const isLegDay = day === "Monday" || day === "Saturday"; // squat/deadlift days
    const isUpperBodyDay = day === "Tuesday"; // bench/press days
    
    let targetMuscles: string[] = [];
    if (isLegDay) {
      targetMuscles = ["Quadriceps", "Hamstrings", "Glutes"];
    } else if (isUpperBodyDay) {
      targetMuscles = ["Chest", "Shoulders", "Triceps"];
    } else {
      targetMuscles = t.muscles; // cardio/HIIT days
    }

    // Filter exercises by target muscles and phase
    let pool = exercises.filter(e =>
      e.exercise_phase === "main" &&
      (!coreLift || e.id !== coreLift.id) &&
      e.primary_muscle && 
      targetMuscles.some(m => parseMuscles(e.primary_muscle).includes(m))
    );

    // Limit posterior-chain hinges to 2 max
    if (isLegDay) {
      const hinges = pool.filter(e => 
        e.name.toLowerCase().includes('deadlift') ||
        e.name.toLowerCase().includes('clean') ||
        e.name.toLowerCase().includes('snatch') ||
        e.name.toLowerCase().includes('kettlebell swing')
      );
      if (hinges.length > 2) {
        const nonHinges = pool.filter(e => !hinges.includes(e));
        pool = [...nonHinges, ...hinges.slice(0, 2)];
      }
    }

    // Calculate target count based on minutes (≈5 min each)
    const targetCount = Math.max(0, Math.floor((minutes - 20) / 5));
    
    return pool
      .sort(() => 0.5 - Math.random())
      .slice(0, targetCount);
  }

  const accessories = pickBalancedAccessories();

  return { warmupArr, coreLift, accessories, cooldownArr };
} 