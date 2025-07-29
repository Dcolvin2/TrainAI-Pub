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
  function pickPhase(phase: "warmup" | "cooldown", target: number): Exercise[] {
    /** 1️⃣ strict pool – same primary muscle */
    let pool = exercises.filter(
      e => e.exercise_phase === phase &&
           parseMuscles(e.primary_muscle).some(m => coreMuscles.includes(m))
    );

    if (pool.length >= target) {
      return pool.sort(() => 0.5 - Math.random()).slice(0, target);
    }

    /** 2️⃣ fallback – full-body or body-weight moves in that phase */
    const fallbackPool = exercises.filter(
      e => e.exercise_phase === phase && (!e.equipment_required?.length)
    );

    const combined = [...pool, ...fallbackPool];
    return combined.sort(() => 0.5 - Math.random()).slice(0, target);
  }

  const warmupArr = pickPhase("warmup", minutes <= 30 ? 2 : 3);
  const cooldownArr = pickPhase("cooldown", minutes <= 30 ? 2 : 3);

  console.log("[TRACE] warmup picked", warmupArr.map(e => e.name));
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