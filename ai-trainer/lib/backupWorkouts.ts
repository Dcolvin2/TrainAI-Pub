// lib/backupWorkouts.ts
type PhaseKey = 'prep'|'activation'|'strength'|'carry_block'|'conditioning'|'cooldown';

type WorkoutItem = {
  name: string;
  sets?: number;
  reps?: string | number;
  duration_seconds?: number;
  load?: string | number | null;
  instruction?: string | null;
  rest_seconds?: number | null;
};

type PlanShape = {
  name: string;
  phases: Array<{ phase: PhaseKey; items: WorkoutItem[] }>;
};

type WorkoutShape = {
  warmup: WorkoutItem[];
  main: WorkoutItem[];
  cooldown: WorkoutItem[];
};

export function buildRuleBasedBackup(split: string, minutes: number, equipment: string[]) {
  // Minimal, deterministic plan that never returns empty arrays.
  // Keep names aligned with your DB to avoid instruction lookups failing.
  const has = (needle: string) => equipment.some(e => e.toLowerCase().includes(needle));

  const warm: WorkoutItem[] = [
    { name: 'Bike Easy', duration_seconds: 180 },
    { name: 'Band Pull-Apart', reps: 15, sets: 2 },
  ];

  const cool: WorkoutItem[] = [
    { name: 'Child\'s Pose', duration_seconds: 60 },
    { name: 'Doorway Pec Stretch', duration_seconds: 60 },
  ];

  let main: WorkoutItem[] = [];

  switch (split) {
    case 'push':
      main = [
        { name: has('barbell') ? 'Barbell Bench Press' : 'Dumbbell Bench Press', sets: 4, reps: '6-8' },
        { name: 'Overhead Press (DB or Barbell)', sets: 3, reps: '8-10' },
        { name: 'Incline DB Press', sets: 3, reps: '10-12' },
        { name: 'Cable Triceps Pressdown', sets: 3, reps: '10-12' },
      ];
      break;
    case 'pull':
      main = [
        { name: has('cable') ? 'Lat Pulldown' : 'Pull-Up or Assisted Pull-Up', sets: 4, reps: '6-8' },
        { name: 'One-Arm DB Row', sets: 3, reps: '8-10' },
        { name: 'Chest-Supported Row', sets: 3, reps: '10-12' },
        { name: 'DB Hammer Curl', sets: 3, reps: '10-12' },
      ];
      break;
    case 'legs':
      main = [
        { name: has('barbell') ? 'Back Squat' : 'Goblet Squat', sets: 4, reps: '6-8' },
        { name: 'Romanian Deadlift (DB or Barbell)', sets: 3, reps: '8-10' },
        { name: 'Walking Lunge (DB)', sets: 3, reps: '10 each' },
        { name: 'Seated Calf Raise (Machine or DB on knees)', sets: 3, reps: '12-15' },
      ];
      break;
    case 'hiit':
      main = [
        { name: has('row') ? 'Row Erg Intervals 30/30' : 'Bike Intervals 30/30', duration_seconds: 600 },
        { name: 'Kettlebell Swing EMOM', duration_seconds: 300 },
        { name: 'Battle Rope 20/10 x 6', duration_seconds: 180 },
      ];
      break;
    default:
      main = [{ name: 'Full Body Circuit (DB)', sets: 3, reps: '12' }];
  }

  const workout: WorkoutShape = { warmup: warm, main, cooldown: cool };

  const plan: PlanShape = {
    name: 'Planned Session',
    phases: [
      { phase: 'prep', items: warm },
      { phase: 'activation', items: [] },
      { phase: 'strength', items: main },
      { phase: 'carry_block', items: [] },
      { phase: 'conditioning', items: split === 'hiit' ? main : [] },
      { phase: 'cooldown', items: cool },
    ],
  };

  return { plan, workout };
}

export function makeTitle(split: string, minutes: number) {
  const pretty = split ? split[0].toUpperCase() + split.slice(1) : 'Session';
  return `${pretty} Session (~${minutes} min)`;
}
