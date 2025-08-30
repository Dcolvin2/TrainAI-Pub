// app/api/chat-workout/test/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Simulate the new pull workout generation with anchored main lift
    const payload = {
      ok: true,
      name: 'Push (~45 min)',
      message: 'Push (~45 min)',
              coach:
          "Pull day locked. Main lift: Trap Bar Deadlift. I'll rotate accessories based on your equipment and time.",
        chatMsg: 'Pull day locked. Main lift: Trap Bar Deadlift. I\'ll rotate accessories based on your equipment and time.\n\nEquipment available: Cables, Cable Attachments, Barbells, Bumper Plates, Bench, Dumbbells, Kettlebells, Trap Bar',
              plan: {
          split: 'pull',
          duration: 45,
          main_lift: 'Trap Bar Deadlift',
          focus: ['back', 'biceps', 'posterior chain'],
          intensity: 'moderate-high',
          restPeriods: '2-3 minutes for main lift, 60-90s for accessories',
          name: 'Pull (~45 min)',
        },
      workout: {
        warmup: [
          { exercise: 'Easy Bike/Row', duration: '3 minutes', instruction: 'Increase HR to 120-140' },
          { exercise: 'Quadruped T-Spine Rotations', sets: 1, reps: '8/side' },
          { exercise: 'Banded Face Pulls', sets: 2, reps: '15' },
          { exercise: 'Half-Kneeling Pallof Press', sets: 2, reps: '10/side', instruction: 'Anti-rotation' },
        ],
        mainExercises: [
          { exercise: 'Trap Bar Deadlift', sets: 4, reps: '5', instruction: 'Build to working weight', isAccessory: false },
          { exercise: 'One-Arm Cable Row', sets: 3, reps: '10/side', equipment: ['Cables', 'Cable Attachments'], isAccessory: true },
          { exercise: 'Lat Pulldown', sets: 3, reps: '8-10', equipment: ['Cables', 'Cable Attachments'], isAccessory: true },
          { exercise: 'Face Pull', sets: 3, reps: '12-15', equipment: ['Cables', 'Cable Attachments'], isAccessory: true },
          { exercise: 'Half-Kneeling High-to-Low Cable Chop', sets: 2, reps: '10/side', equipment: ['Cables', 'Cable Attachments'], isAccessory: true },
        ],
        finisher: { exercise: 'Dead Hang', sets: 2, reps: '30-45s', equipment: [] },
      },
              debug: {
          usedTwoPass: false,
          minutesRequested: 45,
          split: 'pull',
        equipmentList: [
          'Adjustable Bench',
          'Barbells',
          'Battle Rope',
          'Dip Machine',
          'Dumbbells',
          'Exercise Ball',
          'Exercise Bike',
          'Kettlebells',
          'Minibands',
          'Plyo Box',
          'Slam Ball',
          'Superbands',
          'Trap Bar',
          'Cables',
          'Cable Attachments',
          'Bumper Plates',
          'Bench',
          'Squat Rack',
          'Treadmill',
          'TRX',
        ],
        parseError: null,
        validity: 'ok',
      },
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (err: any) {
    console.error('chat-workout.test error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'Unknown error' }, { status: 200 });
  }
}
