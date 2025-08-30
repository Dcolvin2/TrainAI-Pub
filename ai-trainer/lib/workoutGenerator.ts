import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface WorkoutType {
  id: 'pull' | 'push' | 'legs' | 'upper' | 'full' | 'hiit' | string;
  name: string;
  category: string;
  target_muscles: string[];
  movement_patterns: string[]; // e.g. ['hinge','row','vertical_pull']
}

export interface Exercise {
  id: string;
  name: string;
  category: string | null;
  primary_muscle: string | null;     // text in your CSV, not an array
  movement_pattern: string | null;   // text in your CSV
  equipment_required: string | null; // JSON string in your CSV
  instruction: string | null;
  exercise_phase: string | null;
  rest_seconds_default: number | null;
  set_duration_seconds: number | null;
}

export interface GeneratedWorkout {
  type: WorkoutType;
  warmup: any[];
  mainExercises: any[];
  accessories: any[];
  cooldown: any[];
  duration: number;
  focus: string;
}

const parseJsonArray = (v: unknown): string[] => {
  if (Array.isArray(v)) return v.map(String);
  if (v == null) return [];
  if (typeof v === 'string') {
    try {
      const j = JSON.parse(v);
      return Array.isArray(j) ? j.map(String) : [];
    } catch { return []; }
  }
  return [];
};

const normalize = (s?: string | null) => (s || '').toLowerCase().trim();

const equipCompatible = (req: string[], have: string[]): boolean => {
  if (!req.length) return true;
  const H = new Set(have.map(normalize));
  const syn = (x: string) => {
    const y = normalize(x);
    if (y.includes('band')) return ['band', 'bands', 'minibands', 'superbands'];
    if (y.includes('trx') || y.includes('suspension')) return ['trx', 'suspension'];
    if (y.includes('bodyweight')) return ['bodyweight'];
    return [y];
  };
  return req.some(r => syn(r).some(s => H.has(s)));
};

const splitBiasRx: Record<string, RegExp> = {
  pull: /(deadlift|hinge|row|pull[\s-]?up|pull[\s-]?down|lat|rear delt|face pull|shrug)/i,
  push: /(bench|press|push[\s-]?up|dip|overhead|triceps|chest)/i,
  legs: /(squat|lunge|hinge|deadlift|step[\s-]?up|hamstring|quad|posterior|calf)/i,
  upper: /(press|row|pull[\s-]?down|pull[\s-]?up|rear delt|face pull|overhead|push[\s-]?up)/i,
  full: /(squat|press|row|hinge|carry|thruster|clean|snatch|burpee|swing)/i,
  hiit: /(interval|emom|amrap|circuit|burpee|swing|sled|rope)/i,
};

export async function generateWorkoutForType(workoutType: WorkoutType, userId: string): Promise<GeneratedWorkout> {
  const equipment = await getUserEquipment(userId);
  const exercises = await getExercisesForWorkoutType(workoutType, equipment);

  const mainExercises = selectMainExercises(exercises, workoutType);
  const accessories  = selectAccessories(exercises, workoutType, mainExercises.map(e => e.name));

  return {
    type: workoutType,
    warmup: selectWarmupExercises(workoutType, equipment),
    mainExercises,
    accessories,
    cooldown: selectCooldown(workoutType),
    duration: 45,
    focus: workoutType.target_muscles[0] || 'strength'
  };
}

async function getUserEquipment(userId: string): Promise<string[]> {
  // Prefer explicit join (FK: user_equipment.equipment_id -> equipment.id)
  const { data, error } = await supabase
    .from('user_equipment')
    .select('is_available,equipment:equipment_id(name)')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching user equipment:', error);
    return [];
  }

  const names = (data || [])
    .filter((r: any) => r?.is_available !== false)
    .map((r: any) => r?.equipment?.name)
    .filter(Boolean)
    .map((s: string) => s.toLowerCase());

  return Array.from(new Set(names));
}

async function getExercisesForWorkoutType(workoutType: WorkoutType, availableEquipment: string[]): Promise<Exercise[]> {
  // Pull the raw rows with fields we actually use
  let q = supabase
    .from('exercises')
    .select('id,name,category,primary_muscle,movement_pattern,equipment_required,instruction,exercise_phase,rest_seconds_default,set_duration_seconds');

  // Build a dynamic OR expression: matches primary_muscle or movement_pattern
  const ors: string[] = [];
  for (const m of (workoutType.target_muscles || [])) {
    const mm = normalize(m);
    if (mm) ors.push(`primary_muscle.ilike.%${mm}%`);
  }
  for (const p of (workoutType.movement_patterns || [])) {
    const pp = normalize(p).replace(/_/g, ' ');
    if (pp) ors.push(`movement_pattern.ilike.%${pp}%`);
  }
  if (ors.length) q = q.or(ors.join(','));

  // Slightly prioritize strength/core lifts first
  q = q.order('category', { ascending: true }); // depends on your data; we'll sort again locally

  const { data, error } = await q;
  if (error) {
    console.error('Error fetching exercises:', error);
    return [];
  }

  // Filter by compatible equipment
  const filtered = (data || []).filter((ex: Exercise) => {
    const req = parseJsonArray(ex.equipment_required);
    return equipCompatible(req, availableEquipment);
  });

  // Bias ranking by split keyword presence
  const rx = splitBiasRx[workoutType.id] || splitBiasRx.full;
  filtered.sort((a, b) => {
    const aTxt = `${a.name} ${a.movement_pattern || ''} ${a.category || ''} ${a.primary_muscle || ''}`;
    const bTxt = `${b.name} ${b.movement_pattern || ''} ${b.category || ''} ${b.primary_muscle || ''}`;
    const aHit = rx.test(aTxt);
    const bHit = rx.test(bTxt);
    if (aHit && !bHit) return -1;
    if (!aHit && bHit) return 1;
    // then prefer core/strength
    const aCore = (a.exercise_phase || '').toLowerCase().includes('core') || (a.category || '').toLowerCase().includes('strength');
    const bCore = (b.exercise_phase || '').toLowerCase().includes('core') || (b.category || '').toLowerCase().includes('strength');
    if (aCore && !bCore) return -1;
    if (!aCore && bCore) return 1;
    return 0;
  });

  return filtered;
}

function selectWarmupExercises(workoutType: WorkoutType, available: string[]): any[] {
  // Rotation / scap-prep bias; avoids bike/erg if not owned
  const has = (k: string) => available.some(e => normalize(e).includes(k));
  const list: any[] = [];

  list.push({ name: has('trx') ? 'TRX Row' : 'Band Face Pulls', sets: 1, reps: '10', instruction: 'Scap retraction + depression' });

  if (workoutType.id === 'pull') {
    list.push({ name: 'Cat-Cow Stretch', duration: '30s', instruction: 'Thoracic mobility' });
    list.push({ name: 'Pallof Press', sets: 1, reps: '10/side', instruction: 'Anti-rotation' });
  } else if (workoutType.id === 'push') {
    list.push({ name: 'Scapular Wall Slides', sets: 1, reps: '10' });
    list.push({ name: 'Arm Circles', duration: '30s' });
  } else if (workoutType.id === 'legs') {
    list.push({ name: 'Bodyweight Squat', sets: 1, reps: '10', instruction: 'Hip & knee tracking' });
    list.push({ name: 'Hip Airplanes', sets: 1, reps: '5/side' });
  } else {
    list.push({ name: 'World's Greatest Stretch', duration: '60s', instruction: 'T-spine + hips' });
  }

  return list;
}

function selectMainExercises(exercises: Exercise[], workoutType: WorkoutType): any[] {
  const mains: any[] = [];

  const isCore = (ex: Exercise) =>
    normalize(ex.exercise_phase).includes('core') ||
    normalize(ex.category).includes('strength');

  const candidates = exercises.filter(isCore);

  // Guarantee at least one main
  const chosen = candidates.length ? candidates.slice(0, 2) : exercises.slice(0, 1);

  for (const ex of chosen) {
    mains.push({
      name: ex.name,
      sets: 4,
      reps: '5-8',
      rest: ex.rest_seconds_default ?? 150,
      instruction: ex.instruction ?? undefined,
      isAccessory: false,
    });
  }

  return mains;
}

function selectAccessories(exercises: Exercise[], workoutType: WorkoutType, excludeNames: string[]): any[] {
  const excl = new Set(excludeNames.map(n => normalize(n)));
  const acc: any[] = [];

  const isAccessory = (ex: Exercise) =>
    normalize(ex.exercise_phase).includes('accessory') ||
    normalize(ex.category).includes('hypertrophy') ||
    !normalize(ex.category).includes('strength');

  const pool = exercises.filter(ex => isAccessory(ex) && !excl.has(normalize(ex.name)));

  for (const ex of pool.slice(0, 4)) {
    acc.push({
      name: ex.name,
      sets: 3,
      reps: '8-12',
      rest: ex.rest_seconds_default ?? 90,
      instruction: ex.instruction ?? undefined,
      isAccessory: true,
    });
  }

  return acc;
}

function selectCooldown(workoutType: WorkoutType): any[] {
  if (workoutType.id === 'pull') {
    return [
      { name: 'Child\'s Pose', duration: '60s' },
      { name: 'Lat Stretch Against Wall', duration: '45s/side' },
    ];
  }
  if (workoutType.id === 'push') {
    return [
      { name: 'Doorway Pec Stretch', duration: '60s' },
      { name: 'Triceps Stretch', duration: '45s/side' },
    ];
  }
  if (workoutType.id === 'legs') {
    return [
      { name: 'Hamstring Stretch', duration: '45s/side' },
      { name: 'Quad Stretch', duration: '45s/side' },
    ];
  }
  return [
    { name: 'Deep Breathing', duration: '60s' },
    { name: 'Light Walking', duration: '2 min' },
  ];
}

export async function saveWorkout(userId: string, workoutData: any, workoutTypeId: string) {
  const { data, error } = await supabase
    .from('workouts')
    .insert({
      user_id: userId,
      workout_data: workoutData,
      workout_type_id: workoutTypeId,
      created_at: new Date().toISOString()
    });
  if (error) {
    console.error('Error saving workout:', error);
    throw error;
  }
  return data;
}

export async function getWorkoutSuggestions(userId: string) {
  try {
    const response = await fetch('/api/workoutSuggestions', { headers: { 'x-user-id': userId } });
    const data = await response.json();
    return data.suggestion;
  } catch (error) {
    console.error('Error getting workout suggestions:', error);
    return null;
  }
} 