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
  warmupSel: Exercise | null;
  coreLift: Exercise | null;
  accessories: Exercise[];
  cooldownSel: Exercise | null;
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

  // 3️⃣ Warm-up and Cooldown — always return something
  function pickPhase(phase: "warmup" | "cooldown") {
    // First try: match requested muscles
    let pool = exercises.filter(
      e => e.exercise_phase === phase &&
           t.muscles.some(m => e.primary_muscle?.includes(m))
    );

    console.log(`[TRACE] ${phase} pool size`, pool.length);

    // Fallback #1: any phase-match that needs *no equipment*
    if (pool.length === 0) {
      pool = exercises.filter(
        e => e.exercise_phase === phase && (!e.equipment_required?.length)
      );
    }

    // Fallback #2: any exercise tagged for that phase at all
    if (pool.length === 0) {
      pool = exercises.filter(e => e.exercise_phase === phase);
    }

    // If still empty, return null so UI can handle gracefully
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
  }

  const warmupSel   = pickPhase("warmup");
  const cooldownSel = pickPhase("cooldown");

  // 4️⃣ accessories: main-phase, matching muscles, exclude core lift itself
  const accessoriesPool = exercises.filter(e =>
      e.exercise_phase === "main" &&
      (!coreLift || e.id !== coreLift.id) &&
      e.primary_muscle && t.muscles.some(m => e.primary_muscle.includes(m)));

  // estimate 20 min for warm-up/core/cooldown; 5 min per accessory
  const accCount = Math.max(0, Math.floor((minutes - 20)/5));
  const accessories = pickAccessories(accessoriesPool, accCount);

  return { warmupSel, coreLift, accessories, cooldownSel };
} 