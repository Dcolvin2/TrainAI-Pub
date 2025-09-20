// app/api/chat-workout/route.ts
import { NextResponse } from "next/server";
import { openaiJSON } from "@/lib/openaiClient";
import { supabase } from "@/lib/supabaseClient";
import { devlog } from "@/lib/devlog";
import {
  validateWorkoutPlan,
  validateWorkoutPlanPhases,
  type WorkoutPlan,
  type WorkoutItem,
  type PlanPhase as SchemaPlanPhase
} from "../../../lib/schemas/workout";
import {
  mainLiftForSplit,
  focusMusclesForSplit,
  trimPlanToDuration,
  normalizeStrengthAccessories,
  ensureDuration,
  coachFor,
  sanitizePlanExercises
} from "../../../lib/workout";

import { normalizePlan as normalizePlanLib, buildChatSummary } from "@/lib/normalizePlan";
import { fetchCooldownContext, mapLLMToPlanItems, focusFromSplit } from '@/lib/cooldown';
import { sanitizeCooldown } from '@/lib/cooldownPolicy';

export const runtime = "nodejs";

type Ctx = {
  userId: string;
  duration: number;
  equipment: string[];
  split?: string;
  lastSets?: Array<{ name: string; last: string }>;
};

function normList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(x => String(x).trim()).filter(Boolean);
  if (typeof v === "string") return v.split(",").map(s => s.trim()).filter(Boolean);
  return [];
}

function buildSmartCoachPrompt(userMsg: string, ctx: Ctx, mentionedEquipment: string[] = []) {
  const eqList = ctx.equipment.length ? ctx.equipment.join(", ") : "bodyweight only";
  const focus = ctx.split ? focusMusclesForSplit(ctx.split).join(", ") : "auto";
  const last = (ctx.lastSets ?? [])
    .map(x => `- ${x.name}: ${x.last}`)
    .join("\n");
  const lastBlock = last ? `\nRecent lifts:\n${last}\n` : "";
  const mainLiftHint = ctx.split ? (mainLiftForSplit(ctx.split, ctx.equipment) ?? "") : "";

  const system = [
    "You are TrainAI, a smart workout coach. You can synthesize ANY training style with deep understanding of their philosophy and methodology.",
    "Use your own broad fitness knowledge FIRST to shape the plan; use provided context for personalization (equipment, time, last sets).",
    "IMPORTANT: You are being called because this is a sophisticated training style request (not a simple push/pull/legs/hiit). Generate a high-quality, intelligent workout that matches the specific training philosophy and methodology requested.",
    "Return ONLY strict JSON matching the schema described. No commentary, no markdown.",
    "Training Style Guidelines:",
    "- JOE HOLDER/OCHO SYSTEM: Multi-dimensional workouts with mobility, coordination, strength circuits, metabolic conditioning, and flexibility. Use DUMBBELLS extensively (70-80% of strength exercises): dumbbell goblet squats, dumbbell Romanian deadlifts, dumbbell bent-over rows, dumbbell overhead press, dumbbell lateral raises, dumbbell chest press, dumbbell single-arm rows, dumbbell Bulgarian split squats, dumbbell farmer's carries, dumbbell Turkish get-ups, dumbbell thrusters, dumbbell clean and press. Also include: dynamic leg swings, alternating knee tucks, core activation holds, full-range squat jumps, pogos, multiplanar lunges, bear crawls, lateral bounds, metabolic circuits with high knees/burpees/mountain climbers, and mindfulness cooldowns with pigeon pose, child's pose, cat-cow stretches. Focus on quality movement, multiplanar motion, and holistic wellness.",
    "- ATHLEAN-X/JEFF CAVALIERE: Form-focused, tension-based training with strict technique, full ROM, and controlled tempo. Use compound movements like barbell/dumbbell presses, rows, squats, deadlifts with perfect form, time-under-tension techniques, drop sets, rest-pause sets. Include detailed form cues like 'keep chest up, core braced, slow 3-second eccentric, pause at bottom, explosive concentric', 'maintain neutral spine, engage lats, control the weight, feel the stretch', 'squeeze shoulder blades together, pull to lower chest, hold peak contraction', 'keep knees tracking over toes, descend slowly, drive through heels', 'maintain tension throughout, no momentum, controlled tempo', 'squeeze glutes at top, control descent, maintain hip hinge pattern'. Emphasize muscle-mind connection and progressive overload.",
    "- TABATA: High-intensity intervals (20s work/10s rest) with explosive movements and maximum effort. Use exercises like burpees, squat jumps, mountain climbers, high knees, jumping jacks, push-ups, jumping lunges, plank jacks that can be performed at maximum intensity.",
    "- CROSSFIT WOD: Functional movements, varied time domains, and high-intensity conditioning without Olympic lifts. Use movements like thrusters, wall balls, kettlebell swings, box jumps, rowing, running, pull-ups, push-ups in varied time domains.",
    "- SKI PREP: Unilateral strength, power development, lateral movements, and eccentric control for skiing performance. Use exercises like single-leg squats, lateral lunges, single-leg deadlifts, lateral bounds, box jumps, lateral step-ups, lateral shuffles, balance work.",
    "General Rules:",
    "- Phases: warmup, strength (main/core lift first unless HIIT), accessory, cooldown.",
    `- Cooldown must match the day's focus muscles (${focus}); never mismatched.`,
    "- If time is tight, cut accessories first, then trim main-lift volume.",
    "- If no equipment, generate bodyweight plan.",
    "- Where history exists, include a 'last' field and suggest a progression (e.g., 'suggested').",
    "- CRITICAL: If user mentions specific equipment in their request, use that equipment extensively throughout the workout.",
    "- For equipment-specific requests, make 70-80% of exercises use that equipment type.",
    "- Examples: 'functional trainer' → use cable exercises like Cable Chest Press, Cable Rows, Cable Tricep Pushdowns, Cable Bicep Curls, Cable Lateral Raises, Cable Woodchops, Cable Face Pulls, Cable Squats, Cable Deadlifts, Cable Pull-throughs, 'kettlebells' → use KB exercises, 'dumbbells' → use DB exercises.",
  ].join("\n");

  // Detect training style from user message
  const trainingStyle = userMsg.toLowerCase();
  let styleInstructions = "";
  
  if (trainingStyle.includes('ocho') || trainingStyle.includes('joe holder')) {
    styleInstructions = `CRITICAL: Generate a JOE HOLDER OCHO SYSTEM workout with these SPECIFIC components:

WARMUP (8-10 min): Dynamic leg swings, alternating knee tucks, core activation (iso hold pressing hand to raised knee), arm circles, hip openers, full-range squat jumps, pogos (quick jumps), multiplanar lunges (forward/side/reverse)

STRENGTH CIRCUIT (15-20 min): Repeat 2-3 rounds with minimal rest between exercises, 1 min between rounds. Use DUMBBELLS extensively: Dumbbell goblet squats, dumbbell Romanian deadlifts, dumbbell bent-over rows, dumbbell overhead press, dumbbell lateral raises, dumbbell chest press, dumbbell single-arm rows, dumbbell Bulgarian split squats, dumbbell farmer's carries, dumbbell Turkish get-ups, dumbbell thrusters, dumbbell clean and press

METABOLIC CONDITIONING (8-10 min): High knees (30s), burpees (12 reps), mountain climbers (30s), jumping jacks (30s), squat jumps (30s), dumbbell thrusters (30s), dumbbell swings (30s). Repeat 2-3 rounds with 30s rest between rounds.

COOLDOWN (5-7 min): Forward fold hamstring stretch, lunge with twist, pigeon pose (hips), child's pose with deep breathing, cat-cow stretch

Focus on: Quality movement, multiplanar motion, holistic wellness, biomotor skills, agility work, varied movement patterns, mindfulness elements. Use dumbbells for 70-80% of strength exercises.`;
  } else if (trainingStyle.includes('athlean') || trainingStyle.includes('cavaliere')) {
    styleInstructions = `CRITICAL: Generate an ATHLEAN-X style workout with these SPECIFIC components:

WARMUP: Dynamic stretching, activation exercises, light cardio (5-7 min)

STRENGTH: Form-focused compound movements with STRICT TECHNIQUE and detailed form cues. Include specific form instructions like:
- "Keep chest up, core braced, slow 3-second eccentric, pause at bottom, explosive concentric"
- "Maintain neutral spine, engage lats, control the weight, feel the stretch"
- "Squeeze shoulder blades together, pull to lower chest, hold peak contraction"
- "Keep knees tracking over toes, descend slowly, drive through heels"
- "Maintain tension throughout, no momentum, controlled tempo"
- "Squeeze glutes at top, control descent, maintain hip hinge pattern"

Use: Barbell/dumbbell compound lifts, isolation exercises with perfect form, time-under-tension techniques (3-4 second eccentrics), drop sets, rest-pause sets, supersets with opposing muscle groups

ACCESSORY: Targeted muscle group work with strict form, full range of motion, controlled tempo. Include form cues like "squeeze at peak contraction", "control the negative", "maintain tension throughout"

COOLDOWN: Static stretching, mobility work, foam rolling movements

Focus on: Tension-based training, quality over quantity, strict technique, full ROM, controlled tempo, muscle-mind connection, progressive overload principles. Include specific form cues for each exercise.`;
  } else if (trainingStyle.includes('tabata')) {
    styleInstructions = `CRITICAL: Generate a TABATA workout with these SPECIFIC components:

WARMUP: Dynamic movements, light cardio (5 min)

STRENGTH: High-intensity intervals (20s work/10s rest) for 4 minutes per exercise. Use explosive movements: Burpees, squat jumps, mountain climbers, high knees, jumping jacks, push-ups, jumping lunges, plank jacks

ACCESSORY: Additional high-intensity intervals or strength exercises with short rest periods

COOLDOWN: Light stretching and breathing (5 min)

Focus on: Maximum effort during work periods, explosive movements, short rest periods, metabolic conditioning, exercises that can be performed at maximum intensity.`;
  } else if (trainingStyle.includes('ski') || trainingStyle.includes('skiing')) {
    styleInstructions = `CRITICAL: Generate a SKI PREP workout with these SPECIFIC components:

WARMUP: Dynamic leg swings, hip circles, ankle mobility, lateral movements (5-7 min)

STRENGTH: Unilateral exercises, power development, lateral movements, eccentric control. Include: Single-leg squats, lateral lunges, single-leg deadlifts, lateral bounds, box jumps, lateral step-ups, single-leg glute bridges, lateral shuffles

ACCESSORY: Additional unilateral and lateral movements, core stability exercises, balance work

COOLDOWN: Hip flexor stretches, IT band stretches, glute stretches, ankle mobility

Focus on: Unilateral strength, power development, lateral and multiplanar movements, eccentric control, movements that translate to skiing performance, balance and stability.`;
  }

  const user = [
    `User request: ${userMsg}`,
    `Available equipment: ${eqList}`,
    `Preferred duration (min): ${ctx.duration}`,
    ctx.split ? `Requested split: ${ctx.split}` : "",
    mainLiftHint ? `Hinted main lift: ${mainLiftHint}` : "",
    styleInstructions,
    mentionedEquipment.length > 0 ? `IMPORTANT: User specifically mentioned these equipment: ${mentionedEquipment.join(', ')}. Prioritize these heavily in the workout. For 'functional trainer', use cable-based exercises like Cable Chest Press, Cable Rows, Cable Tricep Pushdowns, Cable Bicep Curls, Cable Lateral Raises, Cable Woodchops, Cable Face Pulls, Cable Squats, Cable Deadlifts, Cable Pull-throughs.` : "",
    lastBlock,
    "Output JSON shape:",
    "{",
    '  "split": "<push|pull|legs|upper|hiit|full_body|custom>",',
    '  "duration": <minutes>,',
    '  "phases": [',
    '    { "phase": "warmup", "items": [ { "name": "Bike", "duration": "3-5 min" } ] },',
    '    { "phase": "strength", "items": [ { "name": "Barbell Bench Press", "sets": "4", "reps": "5-8", "last": "185×6", "suggested": "190×5", "isAccessory": false } ] },',
    '    { "phase": "accessory", "items": [ { "name": "Lateral Raise", "sets": "3", "reps": "12-15", "isAccessory": true } ] },',
    '    { "phase": "cooldown", "items": [ { "name": "Chest Stretch", "duration": "1-2 min/side" } ] }',
    "  ]",
    "}",
    "Return only that JSON object. Do not include a coach message in the JSON.",
  ].filter(Boolean).join("\n");

  return { system, user };
}

async function getProfile(userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("preferred_workout_duration, equipment")
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

function extractGoalHints(message: string) {
  const m = (message||'').toLowerCase();
  const hints = {
    sport: null as null | 'ski' | 'run' | 'cycle' | 'general',
    conditioning: null as null | 'hiit' | 'steady' | 'mixed',
    emphasis: [] as string[],     // muscles/qualities to bias
    include: [] as string[],      // patterns to include (isometrics, plyos, carries)
  };
  if (/ski|snow|slopes?/.test(m)) {
    hints.sport = 'ski';
    hints.conditioning = 'mixed';
    hints.emphasis.push('quads','hamstrings','glutes','calves','core','hips','thoracic');
    hints.include.push('isometrics (wall sits, split-squat iso)',
                       'eccentric control',
                       'plyometrics (skater hops, bounds)',
                       'balance/anti-rotation core',
                       'ankle/knee/hip mobility');
  }
  // add other simple mappings if you want later
  if (/hiit|interval/.test(m)) hints.conditioning = 'hiit';
  return hints;
}

// Inline helpers to replace backupWorkouts import
type Split = "pull" | "push" | "legs" | "upper" | "full" | "hiit";

// Minimal title helper
const makeTitle = (split: string, minutes?: number) =>
  `${split.charAt(0).toUpperCase() + split.slice(1)} (~${Number.isFinite(minutes as number) ? minutes : 45} min)`;

// ---- Mobility-only cooldown helpers (server) -----------------
const HIIT_OR_STRENGTHY = /(burpee|sprint|thruster|box\s*jump|mountain\s*climber|jump(ing)?\s*jacks?|press|row|curl|extension|raise|pull-?down|deadlift|squat|lunge|dip|carry|hang)/i;
const STRETCHY = /(stretch|mobility|pose|pigeon|child'?s|hamstring|quad|quadriceps|calf|gastroc|soleus|lat|pec|chest|hip\s*flexor|psoas|thoracic|t-?spine|breath|diaphragm|thread\s*the\s*needle|world'?s\s*greatest|cat[-\s]*cow|wall\s*angel|openers?)/i;

function splitFocus(split: string) {
  const s = (split||'').toLowerCase();
  if (s.includes('legs')) return ['hamstring','quad','glute','hip flexor','calf','thoracic'];
  if (s.includes('push')) return ['pec','chest','shoulder','triceps','thoracic'];
  if (s.includes('pull')) return ['lat','upper back','biceps','thoracic'];
  if (s.includes('upper')) return ['chest','shoulder','back','arms','thoracic'];
  if (s.includes('full')) return ['hips','back','core','glute','quad','hamstring','thoracic','calf'];
  return ['thoracic','breathing'];
}

const FALLBACK_BY_SPLIT: Record<string,string[]> = {
  pull:  ["Doorway Pec Stretch","Cross-Body Shoulder Stretch","Thread the Needle","Foam Roll Lats"],
  push:  ["Doorway Pec Stretch","Overhead Triceps Stretch","Wall Angels","Thread the Needle"],
  legs:  ["Seated Hamstring Stretch","Kneeling Hip Flexor Stretch","Figure-4 Glute Stretch","Standing Calf Stretch"],
  upper: ["Doorway Pec Stretch","Cross-Body Shoulder Stretch","Lat Stretch Against Wall","Child's Pose"],
  full:  ["World's Greatest Stretch","Cat-Cow","Child's Pose","90/90 Breathing"],
  hiit:  ["Child's Pose","Thread the Needle","Calf Wall Stretch","90/90 Breathing"],
};

async function buildCooldownForSplit(
  split: 'pull'|'push'|'legs'|'upper'|'full'|'hiit',
  usedNames: string[] = []
) {
  const focus = splitFocus(split);
  const used = new Set(usedNames.map(n => n.toLowerCase()));

  const { data } = await supabase
    .from('exercises')
    .select('name, primary_muscle, target_muscles, exercise_phase')
    .in('exercise_phase', ['cooldown','warmup'])
    .limit(200);

  const rows = (data ?? [])
    .map(r => ({
      name: String(r.name||'').trim(),
      pm: (r as any).primary_muscle?.toString().toLowerCase() || '',
      tms: Array.isArray((r as any).target_muscles) ? (r as any).target_muscles.map((t:string)=>t.toLowerCase()) : []
    }))
    .filter(r => r.name && STRETCHY.test(r.name) && !HIIT_OR_STRENGTHY.test(r.name));

  const score = (r:any) => {
    let s = 0;
    for (const f of focus) {
      const fL = f.toLowerCase();
      if (r.pm.includes(fL)) s += 2;
      if (r.tms.some((t:string)=>t.includes(fL))) s += 1;
    }
    return s;
  };

  const sorted = rows
    .filter(r => !used.has(r.name.toLowerCase()))
    .sort((a,b)=>score(b)-score(a));

  let picks = sorted.slice(0, 4).map(r => ({ name: r.name, duration: '45–60s' }));

  // Top-up if thin using curated fallback (split-aware)
  if (picks.length < 3) {
    const fb = (FALLBACK_BY_SPLIT[split] || FALLBACK_BY_SPLIT.full);
    for (const name of fb) {
      if (picks.length >= 4) break;
      const k = name.toLowerCase();
      if (!used.has(k) && !picks.some(p => p.name.toLowerCase()===k)) {
        picks.push({ name, duration: '45–60s' });
      }
    }
  }
  return picks.slice(0,4);
}

function filterMobilityOnly(list: any[] = []) {
  const seen = new Set<string>();
  const out: { name: string; duration?: string }[] = [];
  for (const it of (Array.isArray(list)?list:[])) {
    const name = String(it?.name||it?.exercise||'').trim();
    if (!name || !STRETCHY.test(name) || HIIT_OR_STRENGTHY.test(name)) continue;
    const k = name.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ name, duration: it?.duration || (it?.reps && /^\d/.test(String(it.reps)) ? String(it.reps) : '45–60s') });
  }
  return out;
}

async function ensureCooldownOn(plan: any, workout: any, split: string) {
  const fromWorkout = filterMobilityOnly(workout?.cooldown);
  const fromPlan = filterMobilityOnly(
    (Array.isArray(plan?.phases) ? plan.phases : [])
      .find((p:any)=>String(p?.phase).toLowerCase()==='cooldown')?.items
  );

  let cooldown = (fromWorkout.length ? fromWorkout : fromPlan);

  if (cooldown.length < 2) {
    const sessionNames = [
      ...(workout?.warmup||[]).map((x:any)=>x?.name).filter(Boolean),
      ...(workout?.mainExercises||[]).map((x:any)=>x?.name).filter(Boolean)
    ];
    const topups = await buildCooldownForSplit((split||'full') as any, sessionNames);
    const merged = [...cooldown, ...topups];

    // de-dupe
    const seen = new Set<string>();
    cooldown = merged.filter(x=>{
      const k = x.name.toLowerCase();
      if (!k || seen.has(k)) return false;
      seen.add(k); return true;
    }).slice(0,4);
  }

  // write back into both shapes
  if (!Array.isArray(workout.cooldown)) workout.cooldown = [];
  workout.cooldown = cooldown;

  // ensure plan has a cooldown phase
  if (!Array.isArray(plan.phases)) plan.phases = [];
  const idx = plan.phases.findIndex((p:any)=>String(p?.phase).toLowerCase()==='cooldown');
  if (idx >= 0) plan.phases[idx].items = cooldown;
  else plan.phases.push({ phase: 'cooldown', items: cooldown });

  return cooldown;
}

// Catalog-based backup used ONLY if the LLM output is unusable.
// Picks from the names already returned by your DB; no hardcoding of exercises.
const buildRuleBasedBackup = (input: any) => {
  const split = (input?.split || "pull") as Split;
  const minutes = Number(input?.minutes || 45);
  const catalogNames: string[] = Array.isArray(input?.catalog)
    ? input.catalog.map((r: any) => (typeof r === "string" ? r : r?.name)).filter(Boolean)
    : [];

  const names = Array.from(new Set(catalogNames));
  const mainLift = names[0] || "Primary Lift";
  const accessories = names.filter((n) => n !== mainLift).slice(0, 3);
  const warm = names.slice(0, 3);

  const workout = {
    warmup: warm.map((n) => ({ name: n, sets: 1, reps: "8–12" })),
    mainExercises: [
      { name: mainLift, sets: 4, reps: "5", isAccessory: false },
      ...accessories.map((n) => ({ name: n, sets: 3, reps: "8–12", isAccessory: true })),
    ],
    finisher: undefined as any,
  };

  const plan = {
    split,
    duration: minutes,
    name: makeTitle(split, minutes),
    main_lift: mainLift,
    phases: [
      { phase: "prep", items: workout.warmup },
      { phase: "strength", items: workout.mainExercises },
      { phase: "activation", items: [] },
      { phase: "carry", items: [] },
    ],
  };

  return {
    ok: true,
    name: plan.name,
    message: plan.name,
    coach: `${split.toUpperCase()} backup plan. Main lift: ${mainLift}.`,
    plan,
    workout,
  };
};

// ---- Clients ----
// OpenAI client is imported from openaiClient.ts

// MAIN LIFT ANCHORS — only this repeats. Everything else can vary.
const MAIN_LIFTS: Record<string, string[]> = {
  pull: ['Trap Bar Deadlift', 'Conventional Deadlift', 'Dumbbell Romanian Deadlift'],
  push: ['Barbell Bench Press', 'Dumbbell Bench Press', 'Incline Bench Press'],
  legs: ['Back Squat', 'Front Squat', 'Belt Squat'],
  upper: ['Standing Overhead Press', 'Seated DB Shoulder Press'],
  full: ['Trap Bar Deadlift', 'Back Squat', 'Bench Press'],
  hiit: [], // no fixed main lift
};

// ----- local types (unique to avoid collisions) -----
type PhaseKey =
  | 'prep'
  | 'activation'
  | 'strength'
  | 'carry_block'
  | 'conditioning'
  | 'cooldown';

type Item = {
  name: string;
  // allow either number or string since the model sometimes sends "30s" etc.
  sets?: number | string;
  reps?: number | string;
  duration?: number | string;       // <-- add (you use i.duration)
  duration_seconds?: number;        // optional, some schemas use this
  instruction?: string | null;
  rest_seconds?: number | null;
  is_main?: boolean;
  isAccessory?: boolean;            // <-- add (you read i.isAccessory)
};

// Renamed types to avoid duplicate identifier errors
type ChatPlan = {
  name?: string;
  duration_min?: number;
  phases: Array<{ phase: PhaseKey; items: Item[] }>;
};

type ChatWorkout = {
  warmup: Item[];
  main: Item[];
  cooldown: Item[];
};

function titleFor(split: string | undefined, minutes: number) {
  const pretty = split ? split[0].toUpperCase() + split.slice(1) : 'Session';
  return `${pretty} (~${minutes} min)`;
}

// Pick the best main lift given the user's equipment
function pickMainLift(split: string, equipment: string[]): string | null {
  const anchors = MAIN_LIFTS[split] || [];
  const have = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('trap bar')) return equipment.some(e => e.toLowerCase().includes('trap bar'));
    if (n.includes('deadlift')) return equipment.some(e => /barbell|trap bar/.test(e.toLowerCase()));
    if (n.includes('bench')) return equipment.some(e => /bench/.test(e.toLowerCase()));
    if (n.includes('squat')) return equipment.some(e => /rack|belt squat|barbell/.test(e.toLowerCase()));
    if (n.includes('press')) return equipment.some(e => /barbell|dumbbell/.test(e.toLowerCase()));
    return true; // permissive fallback
  };
  for (const lift of anchors) if (have(lift)) return lift;
  return anchors[0] ?? null;
}

// Pull candidate accessories from Supabase (including rotation)
type Candidate = { name: string; instruction?: string | null };

async function getCandidates(equipment: string[], wantedTags: string[], limit = 12): Promise<Candidate[]> {
  // Try exercises_final first
  const eq = equipment.map(e => e.toLowerCase());
  const tags = wantedTags.map(t => t.toLowerCase());

  // 1) Try exercises_final
  let q = supabase
    .from('exercises_final')
    .select('name,instruction,equipment_required,category,target_muscles,movement_pattern', { count: 'exact' })
    .limit(limit * 2); // get extra, we'll filter in JS too

  const { data: efData } = await q;

  const rows1 = (efData ?? []).filter(r => {
    const rowStr = `${r.name} ${r.instruction ?? ''} ${r.category ?? ''} ${r.target_muscles ?? ''} ${r.movement_pattern ?? ''} ${r.equipment_required ?? ''}`.toLowerCase();
    const equipOk = eq.length === 0 || eq.some(k => rowStr.includes(k));
    const hasTag = tags.some(t => rowStr.includes(t));
    return equipOk && hasTag;
  });

  // 2) Fallback to exercises (if needed)
  let rows = rows1;
  if (rows.length < limit) {
    const { data: exData } = await supabase
      .from('exercises')
      .select('name,instruction,category,primary_muscle,equipment_required,exercise_phase,target_muscles,movement_pattern', { count: 'exact' })
      .limit(limit * 2);

    const rows2 = (exData ?? []).filter(r => {
      const rowStr = `${r.name} ${r.instruction ?? ''} ${r.category ?? ''} ${r.primary_muscle ?? ''} ${r.exercise_phase ?? ''} ${r.target_muscles ?? ''} ${r.movement_pattern ?? ''} ${r.equipment_required ?? ''}`.toLowerCase();
      const equipOk = eq.length === 0 || eq.some(k => rowStr.includes(k));
      const hasTag = tags.some(t => rowStr.includes(t));
      return equipOk && hasTag;
    });

    rows = [...rows1, ...rows2];
  }

  // Dedup by name and cap
  const seen = new Set<string>();
  const unique = rows.filter(r => {
    const key = (r.name || '').toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return unique.slice(0, limit).map(r => ({ name: r.name, instruction: r.instruction ?? null }));
}

// Build a deterministic time budget for the LLM
function phaseBudget(totalMin: number) {
  const warmup = Math.min(10, Math.max(5, Math.round(totalMin * 0.18)));
  const main = Math.round(totalMin * 0.42);
  const accessories = Math.max(8, totalMin - warmup - main - 4); // leave ~4 for cooldown
  const cooldown = Math.max(3, totalMin - warmup - main - accessories);
  return { warmup, main, accessories, cooldown };
}

// System prompt to anchor main lift and vary the rest (rotation included)
function buildSystemPrompt(split: string, mainLift: string, budget: ReturnType<typeof phaseBudget>) {
  return [
    `You are TrainAI, a strength coach. Build a ${split.toUpperCase()} workout respecting time budget.`,
    `Rules:`,
    `- The MAIN LIFT is fixed and must appear first in main exercises: "${mainLift}".`,
    `- Everything else (warm-up, accessories, finisher, cooldown) is variable based on equipment and variety.`,
    `- Warm-up MUST be 5–10 minutes and include shoulder/scap prep AND thoracic rotation or anti-rotation.`,
    `- Include at least one rotational or anti-rotation core movement (e.g., chops, lifts, Pallof).`,
    `- Favor high-quality pulls: horizontal pull, vertical pull, scap retraction/ER, posterior chain; add grip/carries if time allows.`,
    `- Fit within minutes: warmup ${budget.warmup}, main ${budget.main}, accessories ${budget.accessories}, cooldown ${budget.cooldown}.`,
    `Output JSON ONLY using keys: plan, workout.warmup[], workout.mainExercises[], workout.finisher (optional).`,
    `For each item use { "name", "sets" (number or string), "reps" (string) OR "duration" (string), "instruction" (optional), "isAccessory" (boolean for accessories) }.`,
  ].join('\n');
}

// Hook your generator route to OpenAI (minimal, safe)
async function callClaudeJson(system: string, user: unknown) {
  return openaiJSON(system, user, { max_tokens: 1200 });
}



// near the top of the file or next to generatePullWorkoutLLM
const sameKey = (a?: string, b?: string) => {
  const norm = (x?: string) => (x || '')
    .toLowerCase()
    .replace(/^\s+|\s+$/g, '')
    .replace(/^trap\s*bar\b(?!\s*deadlift)/, 'trap bar') // keep TB deadlift distinct
    .replace(/^(barbell|bar|dumbbell|db|kettlebell|kb|smith(?:\s*machine)?|machine|cable|band(?:ed)?|bodyweight)\s+/g, '')
    .replace(/^(?:barbell\s+)?bench\s+press\b/, 'bench press')
    .replace(/^(?:barbell\s+)?back\s+squat\b/, 'back squat')
    .replace(/^(?:barbell\s+)?front\s+squat\b/, 'front squat')
    .replace(/\brdl\b/, 'romanian deadlift')
    .replace(/[^a-z0-9]+/g, '');
  return norm(a) === norm(b);
};

// Generate pull workout with anchored main lift and rotating accessories
async function generatePullWorkoutLLM({
  split,
  totalMin,
  equipment,
  chatWithFunctions,
}: {
  split: 'pull';
  totalMin: number;
  equipment: string[];
  chatWithFunctions: (args: { system: string; user: string }) => Promise<any>;
}) {
  const budget = phaseBudget(totalMin);
  const mainLift = pickMainLift(split, equipment) || 'Dumbbell Romanian Deadlift';

  // Pull candidates
  const rot = await getCandidates(equipment, ['chop', 'lift', 'pallof', 'rotation', 'anti-rotation']);
  const horiz = await getCandidates(equipment, ['row', 't-bar', 'seated row']);
  const vert = await getCandidates(equipment, ['pull-up', 'lat pulldown']);
  const scap = await getCandidates(equipment, ['face pull', 'external rotation', 'band pull apart']);
  const post = await getCandidates(equipment, ['rdl', 'hinge', 'good morning']);
  const grip = await getCandidates(equipment, ['farmer carry', 'suitcase carry', 'dead hang']);

  const system = [
    'You are TrainAI. Output JSON only.',
    'Keys: plan, workout.warmup[], workout.mainExercises[], workout.cooldown[] (2–4 items, mobility/stretch only).',
    'Include a real rotational or anti-rotation movement.',
    'Warm-up must be 5–10 min. Anchor the MAIN lift as the first item in mainExercises.',
  ].join('\n');

  const user = {
    split: 'pull',
    minutes: totalMin,
    equipment,
    anchors: { mainLift },
    budget,
    candidates: {
      rotation: rot,
      horizontalPull: horiz,
      verticalPull: vert,
      scapular: scap,
      posterior: post,
      gripCarry: grip,
    },
  };

  const llm = await callClaudeJson(system, user);

  // Then compose your final payload in the exact shape your UI expects:
  const selectedMainLift = user.anchors.mainLift;
  const warmup = Array.isArray(llm?.workout?.warmup) ? llm.workout.warmup : [];
  const rest = Array.isArray(llm?.workout?.mainExercises) ? llm.workout.mainExercises : [];
  const mainExercises = [
    { name: selectedMainLift, sets: 4, reps: '5', instruction: 'Build to working sets @ RPE 7–8', isAccessory: false },
    ...rest
      .filter((x: any) => !sameKey(x?.name, selectedMainLift)) // ← drop dupes like "Barbell Back Squat"
      .map((x: any) => ({ ...x, isAccessory: true })),
  ];

  // guarantee cooldown
  const plan = {
    phases: [
      { phase: 'prep', items: warmup },
      { phase: 'strength', items: mainExercises }
    ]
  };
  const workout = { warmup, mainExercises, cooldown: [] };
  
  await ensureCooldownOn(plan, workout, 'pull');

  // then assemble payload using those mutated objects:
  const finalPlan = {
    split: 'pull',
    duration: user.minutes,
    main_lift: selectedMainLift,
    name: `Pull (~${user.minutes} min)`,
    phases: [
      { phase: 'prep', items: warmup },
      { phase: 'strength', items: mainExercises },
      { phase: 'activation', items: [] },
      { phase: 'carry_block', items: [] },
      { phase: 'conditioning', items: [] },
      { phase: 'cooldown', items: plan.phases.find(p => p.phase === 'cooldown')?.items || [] }
    ],
  };
  const finalWorkout = { 
    warmup, 
    mainExercises, 
    finisher: llm?.workout?.finisher, 
    cooldown: plan.phases.find(p => p.phase === 'cooldown')?.items || []
  };

  const payload = {
    ok: true,
    name: `Pull (~${user.minutes} min)`,
    message: `Pull (~${user.minutes} min)`,
    coach: `Pull day locked. Main lift: ${selectedMainLift}. We'll rotate accessories and include rotation/anti-rotation.`,
    plan: finalPlan,
    workout: finalWorkout,
  };

  return payload;
}

function coachText(split: string | undefined, minutes: number, hasHistory: boolean) {
  if (!hasHistory) {
    return `This is your first workout—great time to set a baseline. We'll do a ${minutes}-minute ${split || 'full'} session. Focus on smooth reps, controlled tempo, and stop 1–2 reps shy of failure.`;
  }
  switch (split) {
    case 'push': return `Push day (chest/shoulders/triceps). Stay tight on bench, control the eccentric, and keep rests ~90–120s.`;
    case 'pull': return `Pull day (back/biceps). Lead pulls with your elbows, squeeze lats at the top, keep bracing on rows.`;
    case 'legs': return `Leg day. Drive through mid-foot/heel, own the bottom position, and control your eccentric on squats/RDLs.`;
    case 'hiit': return `Intervals today. Hit hard on the work sets, nasal-breathe on recovery, and keep posture tall.`;
    default: return `Full body today. Move crisply, leave 1–2 reps in the tank, and keep transitions tight.`;
  }
}



async function getRecentCoreLift(userId: string, mainLift?: string) {
  if (!userId || !mainLift) return null;
  // Pull the last set logged for that lift
  const { data, error } = await supabase
    .from("workout_sets")
    .select("actual_weight,reps,session_id")
    .eq("exercise_name", mainLift)
    .not("actual_weight","is",null)
    .order("session_id", { ascending: false })
    .limit(1);
  if (error || !data || data.length === 0) return null;
  return data[0];
}

async function getEquipmentList(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("user_equipment")
    .select("custom_name");
  if (error || !data) return [];
  return data.map(r => r.custom_name).filter(Boolean);
}

function coachTips(n: ReturnType<typeof normalizePlanLib> extends infer T ? T : any, last?: { actual_weight?: number; reps?: number } | null) {
  const tips: string[] = [];
  if (n?.totalMinutes && n.totalMinutes < 30) {
    tips.push("Tight on time: prioritize the main lift; trim accessories first.");
  }
  if (n?.split && n.split !== "hiit" && n?.mainLiftName) {
    tips.push(`Focus: ${n.mainLiftName}. Warm up well and keep rest ~2–3 min between working sets.`);
  }
  if (last?.actual_weight && last?.reps) {
    tips.push(`Last time on ${n?.mainLiftName}: ${last.actual_weight} x ${last.reps}. Aim to match or add 2.5–5 lb if all sets hit.`);
  }
  return tips;
}

// --- BEGIN: workout-based summary helpers (SAFE) ---
function listify<T = any>(x: any): T[] {
  if (!x) return [];
  if (Array.isArray(x)) return x as T[];
  if (typeof x === "object") return [x as T];
  return [];
}
function getName(it: any) {
  if (!it) return "";
  if (typeof it === "string") return it;
  return it.name ?? it.exercise ?? "";
}
function getReps(it: any) {
  if (!it) return "";
  if (typeof it === "string") return "";
  return it.reps ?? it.rep_range ?? "";
}
function getSets(it: any) {
  if (!it) return "";
  if (typeof it === "string") return "";
  return it.sets ?? it.set_count ?? "";
}
function getDurStr(it: any) {
  if (!it || typeof it === "string") return "";
  if (typeof it.duration_seconds === "number") return `${Math.round(it.duration_seconds / 60)} min`;
  if (typeof it.duration === "string") return it.duration;
  return "";
}

function summarizeFromWorkout(workout: any, split?: string, minutes?: number) {
  if (!workout || typeof workout !== "object") return null;

  // Your payload sometimes uses "mainExercises". Normalize all lists.
  const warm = listify(workout.warmup);
  const main = listify(workout.mainExercises ?? workout.main);
  const cool = listify(workout.cooldown);
  const fin = workout.finisher; // can be object or string

  const title =
    `${(split ?? "Session").slice(0,1).toUpperCase()}${(split ?? "Session").slice(1)}` +
    (minutes ? ` (~${minutes} min)` : "");

  const lines: string[] = [];

  if (warm.length) {
    lines.push("Warm-up:");
    warm.forEach((it: any, i: number) => {
      const bits = [getName(it)];
      const s = getSets(it);
      const r = getReps(it);
      const d = getDurStr(it);
      if (s && r) bits.push(`${s} × ${r}`);
      else if (d) bits.push(d);
      lines.push(`${i + 1}. ${bits.filter(Boolean).join(" — ")}`);
    });
  }

  if (main.length) {
    lines.push("", "Main:");
    main.forEach((it: any, i: number) => {
      const bits = [getName(it)];
      const s = getSets(it);
      const r = getReps(it);
      const d = getDurStr(it);
      if (s && r) bits.push(`${s} × ${r}`);
      else if (d) bits.push(d);
      lines.push(`${i + 1}. ${bits.filter(Boolean).join(" — ")}`);
    });
  }

  if (fin) {
    const bits = [getName(fin)];
    const s = getSets(fin);
    const r = getReps(fin);
    const d = getDurStr(fin);
    if (s && r) bits.push(`${s} × ${r}`);
    else if (d) bits.push(d);
    const finLine = bits.filter(Boolean).join(" — ");
    if (finLine) lines.push("", `Finisher: ${finLine}`);
  }

  if (cool.length) {
    lines.push("", "Cooldown:");
    cool.forEach((it: any, i: number) => {
      const bits = [getName(it)];
      const s = getSets(it);
      const r = getReps(it);
      const d = getDurStr(it);
      if (s && r) bits.push(`${s} × ${r}`);
      else if (d) bits.push(d);
      lines.push(`${i + 1}. ${bits.filter(Boolean).join(" — ")}`);
    });
  }

  const paragraph = lines.join("\n");
  const mainLift = getName(main[0]) || undefined;
  return { title, paragraph, mainLift };
}
// --- END: workout-based summary helpers (SAFE) ---

function extractJson(raw: string): { plan?: ChatPlan; workout?: ChatWorkout; error?: string } {
  // Try ```json fencing first
  const fence = raw.match(/```json([\s\S]*?)```/i);
  const candidate = fence ? fence[1] : raw;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return { error: 'No JSON object found in model output.' };
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1));
    return { plan: parsed.plan, workout: parsed.workout };
  } catch (e) {
    return { error: `JSON.parse failed: ${(e as Error).message}` };
  }
}

function validatePlan(plan?: ChatPlan, workout?: ChatWorkout): { ok: boolean; why?: string } {
  if (workout && (workout.main?.length || workout.warmup?.length || workout.cooldown?.length)) return { ok: true };
  if (!plan) return { ok: false, why: 'Missing plan & workout.' };
  if (!Array.isArray(plan.phases)) return { ok: false, why: 'plan.phases not array.' };
  const anyItems = plan.phases.some(p => Array.isArray(p.items) && p.items.length > 0);
  if (!anyItems) return { ok: false, why: 'All phases empty.' };
  // light shape check
  const badItem = plan.phases.flatMap(p => p.items).find(it => !it?.name);
  if (badItem) return { ok: false, why: 'Item missing name.' };
  return { ok: true };
}

/** Utilities */
const S = (v: any) => (v == null ? "" : String(v).trim());
const uniq = <T,>(arr: T[]) => Array.from(new Set(arr));

/** Exact user equipment names (no guessing) */
async function getEquipmentNames(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from("user_equipment")
    .select("is_available, equipment:equipment_id(name)")
    .eq("user_id", userId);
  const names = (data ?? [])
    .filter((r: any) => r?.is_available !== false && r?.equipment?.name)
    .map((r: any) => String(r.equipment.name).trim());
  return uniq(names);
}

/** Preferences (existing table; optional knobs are nullable) */
type Prefs = {
  preferred_exercises?: string[];
  avoided_exercises?: string[];
  coaching_style?: string | null;
  conditioning_bias?: "hiit" | "steady" | "mixed" | null;
  detail_level?: number | null;
};
async function getUserPrefs(userId: string): Promise<Prefs> {
  const { data } = await supabase
    .from("user_preferences")
    .select(
      "preferred_exercises, avoided_exercises, coaching_style, conditioning_bias, detail_level"
    )
    .eq("user_id", userId)
    .maybeSingle();
  return {
    preferred_exercises: Array.isArray(data?.preferred_exercises) ? data!.preferred_exercises : [],
    avoided_exercises: Array.isArray(data?.avoided_exercises) ? data!.avoided_exercises : [],
    coaching_style: data?.coaching_style ?? null,
    conditioning_bias: (data?.conditioning_bias as any) ?? null,
    detail_level: (typeof data?.detail_level === "number" ? data!.detail_level : null),
  };
}

/** Recent exercise names (for "no repeat" guidance) — from planned + logged */
const NO_REPEAT_DAYS = 7;
async function getRecentExerciseNames(userId: string): Promise<string[]> {
  const since = new Date();
  since.setDate(since.getDate() - NO_REPEAT_DAYS);
  const sinceISO = since.toISOString().slice(0, 10);

  const seen = new Set<string>();

  // Planned (workout_sessions.planned_exercises)
  const { data: sess } = await supabase
    .from("workout_sessions")
    .select("planned_exercises, date")
    .eq("user_id", userId)
    .gte("date", sinceISO)
    .order("date", { ascending: false })
    .limit(16);
  for (const s of sess || []) {
    const pe = s?.planned_exercises || {};
    const phases = ["warmup", "main", "accessory", "conditioning", "cooldown"];
    for (const ph of phases) {
      const items = Array.isArray(pe?.[ph]) ? pe[ph] : [];
      for (const it of items) {
        const nm = S(it?.name);
        if (nm) seen.add(nm.toLowerCase());
      }
    }
  }

  // Logged (workout_entries.exercise_name)
  if (seen.size < 64) {
    const { data: entries } = await supabase
      .from("workout_entries")
      .select("exercise_name, date")
      .eq("user_id", userId)
      .gte("date", sinceISO)
      .order("date", { ascending: false })
      .limit(256);
    for (const e of entries || []) {
      const nm = S(e?.exercise_name);
      if (nm) seen.add(nm.toLowerCase());
    }
  }

  return Array.from(seen);
}

/** Light normalizer to coerce numbers → strings & cap phases */
type PlanItem = {
  name: string;
  sets?: string;
  reps?: string;
  duration?: string;
  instruction?: string;
  isAccessory?: boolean;
};
type PlanPhase = { phase: "prep" | "activation" | "strength" | "carry_block" | "conditioning" | "cooldown"; items: PlanItem[] };
type Plan = { name: string; duration_min?: number | string; est_total_minutes?: number | string; phases: PlanPhase[] };

function normalizePlan(input: any): { plan: Plan; warnings: string[] } {
  const warnings: string[] = [];
  const allowed = new Set(["prep","activation","strength","carry_block","conditioning","cooldown"]);

  const plan: Plan = {
    name: S(input?.name) || "Planned Session",
    duration_min: input?.duration_min ?? input?.est_total_minutes,
    est_total_minutes: input?.est_total_minutes ?? input?.duration_min,
    phases: [],
  };

  const rawPhases = Array.isArray(input?.phases) ? input.phases : [];
  for (const p of rawPhases) {
    const ph = S(p?.phase).toLowerCase();
    if (!allowed.has(ph)) { warnings.push(`Unknown phase "${ph}" dropped`); continue; }
    const items: PlanItem[] = Array.isArray(p?.items) ? p.items.map((it: any) => ({
      name: S(it?.name),
      sets: it?.sets != null ? S(it.sets) : undefined,
      reps: it?.reps != null ? S(it.reps) : undefined,
      duration: it?.duration != null ? S(it.duration) : undefined,
      instruction: it?.instruction != null ? S(it.instruction) : undefined,
      isAccessory: Boolean(it?.isAccessory),
    })).filter((x: PlanItem) => x.name) : [];
    plan.phases.push({ phase: ph as PlanPhase["phase"], items });
  }

  // Ensure buckets exist (don't auto-add content — let LLM decide)
  const ensure = (k: PlanPhase["phase"]) => {
    if (!plan.phases.some(ph => ph.phase === k)) plan.phases.push({ phase: k, items: [] });
  };
  ensure("prep"); ensure("activation"); ensure("strength"); ensure("carry_block"); ensure("conditioning"); ensure("cooldown");

  return { plan, warnings };
}

/** Legacy bridge for your UI */
function toLegacyWorkout(plan: ChatPlan) {
  const get = (k: PlanPhase["phase"]) => plan.phases.find(p => p.phase === k)?.items ?? [];
  const warmup = get("prep").map(i => ({ name: i.name, sets: i.sets ?? "1", reps: i.reps ?? "10-15", instruction: i.instruction ?? "" }));
  
  // Make mapping resilient to either duration or duration_seconds
  const mainPrim = get("strength").map(i => {
    const dur = (i.duration ?? (typeof i.duration_seconds === 'number' ? `${i.duration_seconds}s` : undefined));
    return { 
      name: i.name, 
      sets: i.sets ?? '3', 
      reps: i.reps ?? (dur ?? '8-12'), 
      instruction: i.instruction ?? '', 
      isAccessory: !!i.isAccessory 
    };
  });
  
  const acc = get("activation").map(i => ({ name: i.name, sets: i.sets ?? "3", reps: i.reps ?? "10-15", instruction: i.instruction ?? "", isAccessory: true }));
  const carry = get("carry_block").map(i => ({ name: i.name, sets: i.sets ?? "3", reps: i.reps ?? "10-15", instruction: i.instruction ?? "", isAccessory: true }));
  
  const cond = get("conditioning").map(i => {
    const dur = (i.duration ?? (typeof i.duration_seconds === 'number' ? `${i.duration_seconds}s` : undefined));
    return { 
      name: i.name, 
      sets: i.sets ?? '4', 
      reps: i.reps ?? (dur ?? '30s'), 
      instruction: i.instruction ?? '', 
      isAccessory: true 
    };
  });
  
  const cooldown = get("cooldown").map(i => ({ name: i.name, duration: i.duration ?? (i.reps || "60s"), instruction: i.instruction ?? "" }));
  return { warmup, main: [...mainPrim, ...acc, ...carry, ...cond], cooldown };
}

/** Pretty "coach" narrative */
function formatCoach(plan: ChatPlan, workout: ReturnType<typeof toLegacyWorkout>): string {
  const title = plan?.name || "Planned Session";
  const minutes = S(plan?.duration_min);
  const lines: string[] = [];
  lines.push(`${title}${minutes ? ` — ${minutes} min` : ""}`);

  const add = (label: string, arr: any[]) => {
    if (!arr?.length) return;
    lines.push("");
    lines.push(label + ":");
    arr.forEach((it, i) => {
      const sets = it?.sets ? `${it.sets}×` : "";
      const repsOrDur = it?.duration || it?.reps || "";
      const cue = it?.instruction ? ` — ${it.instruction}` : "";
      lines.push(`${i + 1}. ${it.name} ${sets}${repsOrDur}${cue}`.trim());
    });
  };

  add("🔥 Prep", workout.warmup);
  add("💪 Strength", workout.main);
  add("🧘 Cool-down", workout.cooldown);
  return lines.join("\n");
}

/** Robust JSON parsing helper */
function tryParseWorkout(raw: string) {
  // 1) try JSON.parse directly
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj === 'object') return { plan: obj, coach: null, parseError: null };
  } catch (_) { /* ignore */ }

  // 2) try to extract the first {...} block (common when model wraps JSON in narration)
  const first = raw.indexOf('{');
  const last = raw.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    const maybe = raw.slice(first, last + 1);
    try {
      const obj = JSON.parse(maybe);
      return { plan: obj, coach: null, parseError: null };
    } catch (e) {
      return { plan: null, coach: raw, parseError: String(e) };
    }
  }

  // 3) fallback: treat as chat text only
  return { plan: null, coach: raw, parseError: 'no-json-found' };
}

/** LLM JSON helper - handles two-pass workflow for optimal workout generation */
async function llmJSON(opts: { system: string; user: string; max_tokens?: number; temperature?: number }) {
  const resp = await openaiJSON(opts.system, opts.user, {
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.max_tokens ?? 1600,
    model: "gpt-4o"
  });
  return JSON.stringify(resp); // Return JSON string
}



export async function POST(req: Request) {
  const body = await req.json();

  const userMsg: string = String(body?.message ?? '');
  const userId = String(body?.userId ?? '');

  // Parse context from request (DB fetch can be wired later; this path is DB-agnostic and won't break TS strict)
  const duration = Number(body?.duration ?? body?.preferred_workout_duration ?? 45);
  const equipment = normList(body?.equipment ?? body?.equipmentList ?? []);
  const splitInput = typeof body?.split === 'string' ? body.split.trim().toLowerCase() : undefined;
  const lastSets = Array.isArray(body?.lastSets) ? body.lastSets as Array<{ name: string; last: string }> : undefined;

  // Debug: Log what we're receiving
  console.log('🔍 Request Debug:', {
    userMsg,
    splitInput,
    equipment,
    duration,
    bodyKeys: Object.keys(body || {})
  });

  // Fetch allowed DB exercise names from database
  const { data: exerciseData, error: exerciseError } = await supabase
    .from('exercises')
    .select('name')
    .limit(1000);
  
  if (exerciseError) {
    console.error('❌ Database error fetching exercises:', exerciseError);
  }
  
  const allowedExercises: string[] = (exerciseData ?? [])
    .map(r => String(r.name || '').trim())
    .filter(Boolean);

  // Extract equipment mentioned in user request (this takes priority)
  const mentionedEquipment = userMsg.toLowerCase().match(/\b(functional trainer|cables?|kettlebells?|dumbbells?|barbell|trap bar|sled|trx|bands?|resistance bands?|medicine ball|battle ropes?|sandbag|tire|box|step|bench|rack|machine|pulley|rope|chain|weighted vest|bodyweight|calisthenics)\b/g) || [];
  
  // Use mentioned equipment first, then request equipment, then profile equipment as fallback
  let userEquipment = mentionedEquipment.length > 0 ? mentionedEquipment : equipment;
  if (userEquipment.length === 0) {
    const profile = await getProfile(userId);
    const equipmentList = (profile?.equipment ? String(profile.equipment).split(',') : [])
      .map(s => s.trim()).filter(Boolean);
    userEquipment = equipmentList;
  }

  const ctx: Ctx = { userId, duration: Number.isFinite(duration) && duration > 0 ? duration : 45, equipment: userEquipment, split: splitInput, lastSets };

  // If the user is just chatting (non-workout), allow a concise reply (kept server-side to avoid JSON pollution).
  // You can extend this with a classifier later; for now, assume any message with "workout", "program", splits, or named coach implies generation.
  const maybeWorkout = /\b(workout|program|ocho|holder|cavaliere|push|pull|legs|upper|hiit|wod|tabata|ski|training|exercise|functional|strength|cardio|conditioning|fitness|gym|train)\b/i.test(userMsg);

  console.log('🔍 Path Decision:', {
    maybeWorkout,
    splitInput,
    willUseLLM: maybeWorkout,
    userEquipment,
    equipmentFromRequest: equipment,
    mentionedEquipment
  });

  const out: any = { ok: true };

  // LLM-first generation (smart coach). Strict JSON via response_format.
  if (maybeWorkout) {
    console.log('✅ Using LLM path');
    const { system, user } = buildSmartCoachPrompt(userMsg, ctx, mentionedEquipment);
    
    console.log('🤖 LLM Prompt Debug:', {
      system: system.substring(0, 200) + '...',
      user: user.substring(0, 300) + '...',
      mentionedEquipment
    });

    const completion = await openaiJSON(system, user, {
      temperature: 0.4,
      max_tokens: 1200,
      model: "gpt-4o"
    });

    console.log('🤖 LLM Response:', JSON.stringify(completion, null, 2).substring(0, 500) + '...');
    
    let plan: WorkoutPlan;

    try {
      plan = completion as WorkoutPlan;
      console.log('✅ Parsed Plan:', JSON.stringify(plan, null, 2));
    } catch {
      console.log('❌ JSON Parse Error:', completion);
      return new Response(JSON.stringify({ ok: false, error: "Invalid JSON from model" }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }

    // Smart post-processing: repair, normalize, and ensure duration
    let repaired = plan;
    
    // Basic validation first
    const valid = validateWorkoutPlan(repaired);
    if (!valid.ok) {
      return new Response(JSON.stringify({ ok: false, error: valid.error }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }

    // Normalize main vs accessory flags in strength
    repaired = normalizeStrengthAccessories(repaired);
    
    // Ensure duration by padding or trimming to target with style-aware choices
    repaired = ensureDuration(repaired, ctx.duration, userMsg, ctx.equipment);

    // Sanitize item names to DB-approved list, then re-ensure duration in case drops occurred
    repaired = sanitizePlanExercises(repaired, allowedExercises, { dropUnknown: true, minScore: 0.6 });
    // If sanitization removed too much, pad again to hit time
    repaired = ensureDuration(repaired, ctx.duration, userMsg, ctx.equipment);

    const finalCheck = validateWorkoutPlanPhases(repaired);
    if (!finalCheck.ok) {
      // If still incomplete after repair, fail fast
      return new Response(JSON.stringify({ ok: false, error: finalCheck.error }), {
        status: 400,
        headers: { "content-type": "application/json" }
      });
    }

    // ---- Response adapter: map phases[] to legacy shape the UI may still expect ----
    const byPhase = (name: string) =>
      repaired.phases.find((p: SchemaPlanPhase) => p.phase === name)?.items ?? [];

    const legacy = {
      warmup: byPhase("warmup"),
      main: byPhase("strength"),
      accessory: byPhase("accessory"),
      cooldown: byPhase("cooldown")
    };

    const phaseCounts = {
      warmup: legacy.warmup.length,
      strength: legacy.main.length,
      accessory: legacy.accessory.length,
      cooldown: legacy.cooldown.length
    };

    return new Response(
      JSON.stringify({
        ok: true,
        // New contract
        plan: repaired,
        // Legacy contract for existing UI render paths
        workout: legacy,
        phaseCounts,
        coach: coachFor(repaired, userMsg)
      }),
      {
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store"
        }
      }
    );
  }

  // Only use hardcoded path for simple split requests (push/pull/legs/upper/hiit)
  // Complex requests (like "ski prep with functional trainer") should always use LLM
  const isSimpleSplit = splitInput && ['push', 'pull', 'legs', 'upper', 'hiit'].includes(splitInput);
  
  console.log('🔍 Hardcoded Path Check:', {
    splitInput,
    isSimpleSplit,
    willUseHardcoded: isSimpleSplit
  });
  
  if (isSimpleSplit) {
    console.log('✅ Using hardcoded path');
    // Load profile/equipment from your existing helper
    const profile = await getProfile(userId);
    const equipmentList = (profile?.equipment ? String(profile.equipment).split(',') : [])
      .map(s => s.trim()).filter(Boolean);

    // Determine a main lift for the chosen split
    const main = mainLiftForSplit(splitInput, equipmentList);

    // Build a STRICT JSON plan (no chatty text). Keep coach brief.
    const plan = {
      split: splitInput,
      duration: Number(profile?.preferred_workout_duration ?? 45),
      phases: [
        {
          phase: 'warmup',
          items: [
            { name: 'Bike or Row', duration: '3-5 min', instruction: 'Easy pace to raise core temp' },
            { name: 'Dynamic Shoulder + T-Spine', duration: '2-3 min', instruction: 'Arm circles, band pull-aparts' },
          ],
        },
        {
          phase: 'strength',
          items: [
            ...(main ? [{ name: main, sets: '4', reps: '5-8', instruction: 'Build to a moderate-heavy top set' }] : []),
          ],
        },
        {
          phase: 'accessory',
          items: [
            // Keep minimal; your cooldown builder will append cooldown later
            { name: 'Incline DB Press', sets: '3', reps: '8-12' },
            { name: 'Lateral Raise', sets: '3', reps: '12-15' },
            { name: 'Cable Triceps Pressdown', sets: '3', reps: '10-12' },
          ],
        },
      ],
    };

    // Sanitize the hardcoded plan as well
    const sanitizedPlan = sanitizePlanExercises(plan, allowedExercises, { dropUnknown: true, minScore: 0.6 });
    
    out.plan = sanitizedPlan;
    out.message = `${splitInput.charAt(0).toUpperCase()}${splitInput.slice(1)} — Day`;
    out.coach = 'Move with control, leave 1–2 reps in reserve on main sets, and prioritize quality over load.';

    return new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json' } });
  }

  // ...otherwise fall through to your existing (intent/program) behavior
  // (no changes below this line)

  // Non-workout small talk: reply succinctly (avoid JSON so the UI doesn't try to render a plan)
  const msg = userMsg.trim() || "How can I help with training today?";
  return new Response(JSON.stringify({ ok: true, message: msg, coach: "Stay consistent—you're building momentum." }), {
    headers: { 'content-type': 'application/json' }
  });
}


