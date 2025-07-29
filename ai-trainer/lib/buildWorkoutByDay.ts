import { fetchEquipmentAndExercises } from "./fetchEquipmentAndExercises";
import { pickAccessories } from "./rotateAccessories";
import { Exercise } from "@/types/Exercise";

const TEMPLATE = {
  Monday:   { core: "Back Squat",   muscles: ["Quadriceps","Glutes"] },
  Tuesday:  { core: "Bench Press",  muscles: ["Chest","Triceps","Shoulders"] },
  Wednesday:{ core: null,          muscles: ["Cardio"] },   // cardio day
  Thursday: { core: null,          muscles: ["HIIT"] },     // HIIT WOD
  Friday:   { core: null,          muscles: ["Cardio"] },
  Saturday: { core: "Deadlift",    muscles: ["Hamstrings","Back"] },
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

  // 3️⃣ Capture core lift's primary muscles for strict matching
  const coreMuscles = coreLift
    ? [coreLift.primary_muscle].flat()   // ensure array
    : t.muscles;                         // cardio/HIIT days fallback

  console.log("[TRACE] core muscles", coreMuscles);

  // 4️⃣ Unified pickPhase helper for strict muscle matching
  function pickPhase(phase: "warmup" | "cooldown", targetCount: number): Exercise[] {
    // 1️⃣ strict match on coreMuscles
    let pool = exercises.filter(
      e => e.exercise_phase === phase &&
           coreMuscles.some(m => e.primary_muscle?.includes(m))
    );

    // 2️⃣ if not enough, allow any body-weight in that phase
    if (pool.length < targetCount) {
      pool = pool.concat(
        exercises.filter(
          e => e.exercise_phase === phase && (!e.equipment_required?.length)
        )
      );
    }

    // 3️⃣ if still short, allow any exercise tagged for that phase
    if (pool.length < targetCount) {
      pool = pool.concat(
        exercises.filter(e => e.exercise_phase === phase)
      );
    }

    // shuffle and slice
    return pool
      .sort(() => 0.5 - Math.random())
      .slice(0, targetCount);
  }

  const warmupArr = pickPhase("warmup", minutes <= 30 ? 2 : 3);
  const cooldownArr = pickPhase("cooldown", minutes <= 30 ? 2 : 3);

  console.log("[TRACE] warm-up picked", warmupArr.map(e => e.name));
  console.log("[TRACE] cooldown picked", cooldownArr.map(e => e.name));

  // 5️⃣ accessories: main-phase, matching muscles, exclude core lift itself
  const accessoriesPool = exercises.filter(e =>
      e.exercise_phase === "main" &&
      (!coreLift || e.id !== coreLift.id) &&
      e.primary_muscle && t.muscles.some(m => e.primary_muscle.includes(m)));

  // estimate 20 min for warm-up/core/cooldown; 5 min per accessory
  const accCount = Math.max(0, Math.floor((minutes - 20)/5));
  const accessories = pickAccessories(accessoriesPool, accCount);

  return { warmupArr, coreLift, accessories, cooldownArr };
} 