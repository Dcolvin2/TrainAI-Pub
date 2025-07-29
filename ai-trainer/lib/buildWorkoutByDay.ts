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

  // 3️⃣ NEW pickWarmups() – returns 3-4 warm-up moves
  function pickWarmups(): Exercise[] {
    let pool = exercises.filter(
      e => e.exercise_phase === "warmup" &&
           t.muscles.some(m => e.primary_muscle?.includes(m))
    );
    
    if (pool.length < 3) {
      pool = exercises.filter(e => e.exercise_phase === "warmup");
    }
    
    pool = pool.sort(() => 0.5 - Math.random());
    const target = minutes <= 30 ? 2 : minutes <= 45 ? 3 : 4;
    return pool.slice(0, target);
  }

  // 4️⃣ NEW pickCooldowns() – returns 3-4 cooldown moves
  function pickCooldowns(): Exercise[] {
    let pool = exercises.filter(
      e => e.exercise_phase === "cooldown" &&
           t.muscles.some(m => e.primary_muscle?.includes(m))
    );
    
    if (pool.length < 3) {
      pool = exercises.filter(e => e.exercise_phase === "cooldown");
    }
    
    pool = pool.sort(() => 0.5 - Math.random());
    const target = minutes <= 30 ? 2 : minutes <= 45 ? 3 : 4;
    return pool.slice(0, target);
  }

  const warmupArr = pickWarmups();
  const cooldownArr = pickCooldowns();

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