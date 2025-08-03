import _ from "lodash";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/lib/database.types";

type DBS = Database["public"];

export interface WorkoutPlan {
  focus: string;
  duration: number;
  warmup: Block[];
  main: ExerciseBlock[];
  accessories: ExerciseBlock[];
  cooldown: Block[];
}

interface Block {
  name: string;
  duration: string;
}
interface ExerciseBlock extends Block {
  sets: number;
  reps: string;
}

/* ───────────────────────── DAY → CORE MAP ───────────────────────── */
const coreByDay: Record<number, string> = {
  1: "Barbell Back Squat",  // Monday – legs
  2: "Barbell Bench Press", // Tuesday – chest
  3: "Cardio",              // Wednesday
  4: "HIIT",                // Thursday
  5: "Cardio",              // Friday
  6: "Trap Bar Deadlift",   // Saturday – posterior chain
  0: "Rest"                 // Sunday
};

/* ───────── Coaching principles for accessory selection (extendable) */
const trainingPrinciples: Record<
  string,
  {
    primaryTargets: string[];
    movementPatterns: Record<string, string[]>;
    avoid: { categories: string[]; namePatterns: string[]; muscleGroups: string[] };
    repSchemes: Record<string, string>;
  }
> = {
  "Barbell Back Squat": {
    primaryTargets: ["quads", "glutes", "hamstrings"],
    movementPatterns: {
      bilateral: ["Romanian Deadlift", "Front Squat", "Leg Press", "Barbell Hip Thrust"],
      unilateral: ["Bulgarian Split Squat", "Walking Lunges", "Step-Ups", "Single Leg RDL"],
      isolation: ["Leg Curls", "Leg Extensions", "Calf Raises"]
    },
    avoid: {
      categories: ["hiit", "endurance", "mobility"],
      namePatterns: ["stretch", "foam", "band", "battle rope", "jump"],
      muscleGroups: ["chest", "shoulders", "triceps", "biceps"]
    },
    repSchemes: { bilateral: "6-10", unilateral: "8-12", isolation: "10-15" }
  }
  // ➜ add principles for other core lifts as needed
};

/* ───────────────────────────── HELPERS ───────────────────────────── */
const staticWarmUp: Block[] = [
  { name: "Arm Circles",    duration: "30 sec" },
  { name: "Leg Swings",     duration: "30 sec" },
  { name: "Light Cardio",   duration: "2 min" }
];
const staticCoolDown: Block[] = [
  { name: "Hamstring Stretch", duration: "30 sec" },
  { name: "Quad Stretch",      duration: "30 sec" },
  { name: "Shoulder Stretch",  duration: "30 sec" }
];

/* =========================================================
 *  NEW  accessorySelector()  — zero "random" muscles, no mobility
 * =======================================================*/
async function accessorySelector(
  db: SupabaseClient<Database>,
  coreLiftRow: { id: string; name: string; muscle_group: string },
  userEq: string[],
  maxBlocks: number
): Promise<ExerciseBlock[]> {
  if (maxBlocks <= 0) return [];

  /* ─── 1. Derive target muscles from the main lift ─── */
  const targetMuscles = (() => {
    switch (coreLiftRow.muscle_group) {
      case "quads":
      case "hamstrings":
      case "glutes":
        return ["quads", "hamstrings", "glutes"];
      case "chest":
        return ["chest", "triceps", "shoulders"];
      case "back":
        return ["back", "lats", "hamstrings", "glutes"];
      default:
        return [coreLiftRow.muscle_group];
    }
  })();

  /* ─── 2. Query for accessory-eligible moves only ─── */
  const { data: pool } = await db
    .from("exercises")
    .select("id, name, muscle_group, required_equipment, category")
    .in("muscle_group", targetMuscles)
    .in("category", ["strength", "hypertrophy"])          // no HIIT / mobility
    .not("name", "ilike", "%stretch%")
    .not("name", "ilike", "%burpee%")
    .not("name", "ilike", "%jump%")
    .neq("name", coreLiftRow.name)
    .or(`required_equipment.is.null,required_equipment&&{${userEq.join(",")}}`);

  if (!pool || pool.length === 0) return [];

  /* ─── 3. Basic scoring: favour matching muscle & equipment ─── */
  const scored = pool.map((ex) => {
    let score = targetMuscles.includes(ex.muscle_group as string) ? 5 : 0;
    if (
      ex.required_equipment?.length &&
      ex.required_equipment.some((eq: string) => userEq.includes(eq))
    )
      score += 2;
    return { ex, score };
  });

  /* ─── 4. Pick the top N and attach set/rep prescriptions ─── */
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxBlocks)
    .map(({ ex }) => ({
      ...ex,
      sets: 3,
      reps: "8-12",
      duration: "–"
    }));
}

/* ───────────────────────────── API ───────────────────────────── */
export async function generateDayPlan(
  db: SupabaseClient<Database>,
  userId: string,
  today = new Date().getDay(),
  targetMinutes = 45
): Promise<WorkoutPlan | { rest: true }> {
  const token = coreByDay[today] ?? "Rest";

  /* rest / cardio / hiit quick exits */
  if (token === "Rest")  return { rest: true };
  if (["Cardio", "HIIT"].includes(token)) return cardioOrHiitPlan(token as "Cardio" | "HIIT", targetMinutes);

  /* 0️⃣ filter user equipment */
  const { data: eqRows } = await db
    .from("user_equipment")
    .select("equipment!inner(name)")
    .eq("user_id", userId);
  const userEq = (eqRows ?? []).map((r: any) => r.equipment.name);

  /* 1️⃣ core lift row */
  const { data: coreRow } = await db
    .from("exercises")
    .select("id, name, muscle_group")
    .ilike("name", token)
    .maybeSingle();
  if (!coreRow) throw new Error(`Core lift "${token}" not found`);

  /* 2️⃣ accessories */
  const minutesLeft = targetMinutes - 7 /*warm+cool*/ - 12 /*main lift */;
  const accCount    = Math.max(0, Math.floor(minutesLeft / 6));
  const accessories = await accessorySelector(db, coreRow, userEq, accCount);

  /* 3️⃣ compose */
  return {
    focus: coreRow.muscle_group,
    duration: targetMinutes,
    warmup: staticWarmUp,
    main: [{ ...coreRow, sets: 4, reps: "8-10", duration: "–" }],
    accessories,
    cooldown: staticCoolDown
  };
}

/* ===== simple cardio / HIIT filler ================================ */
function cardioOrHiitPlan(type: "Cardio" | "HIIT", mins: number): WorkoutPlan {
  return {
    focus: type.toLowerCase(),
    duration: mins,
    warmup: staticWarmUp,
    main: [
      {
        name: type === "HIIT" ? "Burpees / Jump Circuit" : "Moderate Bike",
        sets: type === "HIIT" ? 6 : 1,
        reps: type === "HIIT" ? "40 sec on / 20 sec off" : `${mins - 7} min`,
        duration: "–"
      }
    ],
    accessories: [],
    cooldown: staticCoolDown
  };
} 