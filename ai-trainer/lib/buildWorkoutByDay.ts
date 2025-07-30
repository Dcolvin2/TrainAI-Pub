import { fetchEquipmentAndExercises } from "./fetchEquipmentAndExercises";
import { pickAccessories } from "./rotateAccessories";
import { Exercise } from "@/types/Exercise";
import { getAccessoryPool } from "@/lib/getExercisePool";
import { calcExerciseMinutes } from "@/utils/calcExerciseMinutes";

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
  estimatedMinutes?: number;
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

  // 5️⃣ Time-aware accessory filling
  const warmupNames = warmupArr.map(e => e.name);
  const cooldownNames = cooldownArr.map(e => e.name);
  const excludeNames = [...warmupNames, ...cooldownNames, coreLift?.name].filter((name): name is string => Boolean(name));

  // 1️⃣ Figure baseline minutes
  const warmupMin = warmupNames.length * calcExerciseMinutes(30, 30, 1);
  const coreMin = coreLift ? 5 * calcExerciseMinutes(30, 180, 1) : 0; // 5x5 for core lifts
  const cooldownMin = cooldownNames.length * calcExerciseMinutes(30, 30, 1);
  let runningMin = warmupMin + coreMin + cooldownMin;

  // 2️⃣ Pull accessory pool (already filtered for warm-up/etc.)
  const pool = await getAccessoryPool(excludeNames);

  const accessories: Exercise[] = [];
  const accessorySets = 3;                      // default per accessory
  const overshootGrace = 3;                     // allow +3 min max

  while (pool.length && runningMin < minutes) {
    const idx = Math.floor(Math.random() * pool.length);
    const pick = pool.splice(idx, 1)[0];

    const addMin = calcExerciseMinutes(
      pick.setSec ?? 30,
      pick.rest ?? 60,
      accessorySets
    );

    // If adding would blow past budget+grace, skip it and break
    if (runningMin + addMin > minutes + overshootGrace) {
      break;
    }

    // Convert pool item to Exercise format
    const accessoryExercise: Exercise = {
      id: pick.name, // Use name as ID for now
      name: pick.name,
      category: 'accessory',
      primary_muscle: '', // Will be filled by the pool data
      equipment_required: [], // Simplified for now
      exercise_phase: 'accessory',
      instruction: '',
      rest_seconds_default: pick.rest ?? 60,
      set_duration_seconds: pick.setSec ?? 30
    };

    accessories.push(accessoryExercise);
    runningMin += addMin;
  }

  console.log('[filler] accessories:', accessories.map(a => a.name),
              'base', warmupMin + coreMin + cooldownMin,
              '→ total', runningMin.toFixed(1), 'min');

  return { 
    warmupArr, 
    coreLift, 
    accessories, 
    cooldownArr,
    estimatedMinutes: runningMin
  };
}

// ---------- DEV HELPER ----------
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  // @ts-ignore – expose helper only in dev
  (window as any).__showPlan = async (day: string = 'Monday') => {
    const plan = await buildWorkoutByDay('test-user', day, 45);
    console.table([
      ['Target min',        plan.estimatedMinutes?.toFixed(1) || 'N/A'],
      ['Warm-up drills',    plan.warmupArr.length],
      ['Accessories',       plan.accessories.length],
      ['Cooldown drills',   plan.cooldownArr.length],
    ]);
    return plan;  // so I can expand it in DevTools
  };
  console.info('👋  Dev helper ready – type  __showPlan("Monday")  in the console');
}
// -------------------------------- 