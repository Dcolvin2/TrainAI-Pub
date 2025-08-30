// app/api/chat-workout/test/route.ts
import { NextResponse } from 'next/server';

// Minimal, deterministic test payload for Pull (~45)
export async function GET() {
  try {
    // Equipment-based main lift selection (static for test; wire to real later)
    const userEquipment = [
      'adjustable bench', 'barbells', 'bumper plates', 'trap bar', 'cables', 'dumbbells', 'bench', 'squat rack', 'trx'
    ].map(s => s.toLowerCase());

    const MAIN_LIFTS: Record<string, string[]> = {
      pull: ['Trap Bar Deadlift', 'Conventional Deadlift', 'Dumbbell Romanian Deadlift'],
    };

    const have = (needle: string) => userEquipment.some(e => e.includes(needle));
    const pickMainLift = (): string => {
      const anchors = MAIN_LIFTS.pull;
      for (const lift of anchors) {
        const n = lift.toLowerCase();
        if (n.includes('trap bar') && have('trap bar')) return lift;
        if (n.includes('deadlift') && (have('barbell') || have('trap bar'))) return lift;
        if (n.includes('romanian') && have('dumbbells')) return lift;
      }
      return anchors[0];
    };

    const mainLift = pickMainLift();

    // Time budget
    const duration = 45;
    const warmupMin = 8;
    const mainMin = 19;
    const accessoriesMin = 14;
    const cooldownMin = duration - warmupMin - mainMin - accessoriesMin;

    // Compose workout with rotation/anti-rotation guaranteed
    const payload = {
      ok: true,
      name: `Pull (~${duration} min)`,
      message: `Pull (~${duration} min)`,
      coach: `Pull day locked. Main lift: ${mainLift}. We'll prime shoulders/scaps, include thoracic rotation/anti-rotation, then finish with back/lat accessories and grip.`,
      chatMsg: `Today's focus: posterior chain + lats. Main lift is ${mainLift}.`,
      plan: {
        split: 'pull',
        duration,
        focus: ['back', 'lats', 'posterior chain'],
        intensity: 'moderate-high',
        restPeriods: '75–120s on main, 45–60s on accessories',
        main_lift: mainLift,
        name: `Pull (~${duration} min)`,
      },
      workout: {
        warmup: [
          { name: 'Bike or Row Erg (easy)', duration: '3 min', instruction: 'RPE 4–5 to elevate HR' },
          { name: 'Quadruped T-Spine Rotations', sets: 1, reps: '8/side', instruction: 'Slow, full range' },
          { name: 'Banded Face Pulls', sets: 2, reps: '15', instruction: 'Scap retraction + ER' },
          { name: 'Half-Kneeling Pallof Press', sets: 2, reps: '10/side', instruction: 'Anti-rotation brace' },
        ],
        mainExercises: [
          { name: mainLift, sets: 4, reps: '5', instruction: 'Build to working sets @ RPE 7–8', isAccessory: false },
          { name: 'One-Arm Cable Row (with slight rotation)', sets: 3, reps: '10/side', instruction: 'Square hips; rotate through upper back', isAccessory: true },
          { name: 'Lat Pulldown or Assisted Pull-Up', sets: 3, reps: '8–10', instruction: 'Full stretch at top', isAccessory: true },
          { name: 'Face Pull', sets: 2, reps: '12–15', instruction: 'Elbows high, rope to forehead', isAccessory: true },
          { name: 'High-to-Low Cable Chop', sets: 2, reps: '10/side', instruction: 'Rotational core power (or banded)', isAccessory: true },
        ],
        finisher: { name: 'Farmer Carry', duration: '2–3 min', instruction: 'Heavy DBs/KBs, short walks; strong brace' },
      },
      debug: {
        validity: 'ok',
        usedTwoPass: false,
        minutesRequested: duration,
        split: 'pull',
        parseError: null,
      },
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (err: any) {
    console.error('chat-workout.test error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'Unknown error' }, { status: 200 });
  }
}
