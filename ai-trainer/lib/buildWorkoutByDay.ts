import { fetchEquipmentAndExercises } from "./fetchEquipmentAndExercises";

interface ExerciseRow {
  id: string;
  name: string;
  equipment_required?: string[];
  exercise_phase?: string;
  primary_muscle?: string;
}

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
  warmupSel: ExerciseRow | undefined;
  coreLift: ExerciseRow | null;
  accessories: ExerciseRow[];
  cooldownSel: ExerciseRow | undefined;
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
  const coreLift: ExerciseRow | null = t.core
    ? exercises.find(e => e.name.toLowerCase().includes(t.core!.toLowerCase())) || null
    : null;

  // 3️⃣ warm-up / cooldown matching muscles
  const warmups   = exercises.filter(e => e.exercise_phase === "warmup"   &&
      e.primary_muscle && t.muscles.some(m => e.primary_muscle!.includes(m)));
  const cooldowns = exercises.filter(e => e.exercise_phase === "cooldown" &&
      e.primary_muscle && t.muscles.some(m => e.primary_muscle!.includes(m)));

  const warmupSel  = warmups[Math.floor(Math.random()*warmups.length)];
  const cooldownSel= cooldowns[Math.floor(Math.random()*cooldowns.length)];

  // 4️⃣ accessories: main-phase, matching muscles, exclude core lift itself
  const accessoriesPool = exercises.filter(e =>
      e.exercise_phase === "main" &&
      (!coreLift || e.id !== coreLift.id) &&
      e.primary_muscle && t.muscles.some(m => e.primary_muscle!.includes(m)));

  // estimate 20 min for warm-up/core/cooldown; 5 min per accessory
  const accCount = Math.max(0, Math.floor((minutes - 20)/5));
  const accessories = accessoriesPool
    .sort(() => 0.5 - Math.random())   // shuffle
    .slice(0, accCount);

  return { warmupSel, coreLift, accessories, cooldownSel };
} 