// app/api/chat-workout/test/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Return the exact sample payload you pasted (simulate the generator)
    const payload = {
      ok: true,
      name: 'Push (~45 min)',
      message: 'Push (~45 min)',
      coach:
        "This is your first workout—great time to set a baseline. We'll do a 45-minute push session. Focus on smooth reps, controlled tempo, and stop 1–2 reps shy of failure.",
      chatMsg: 'Workout\n\n🔥 Warm-up:\n1. Exercise 3×5 minutes\n2. Exercise 1×10 each direction\n\n',
      plan: {
        split: 'push',
        duration: 45,
        focus: ['chest', 'shoulders', 'triceps'],
        intensity: 'moderate-high',
        restPeriods: '45-60 seconds',
        name: 'Push (~45 min)',
      },
      workout: {
        warmup: [
          { exercise: 'Treadmill Walk/Light Jog', duration: '5 minutes' },
          { exercise: 'Arm Circles', sets: 1, reps: '10 each direction' },
        ],
        mainExercises: [
          { exercise: 'Barbell Bench Press', sets: 4, reps: '8-10', equipment: ['Bench', 'Barbells', 'Bumper Plates'] },
          { exercise: 'Standing Military Press', sets: 3, reps: '10-12', equipment: ['Barbells', 'Bumper Plates'] },
          { exercise: 'Incline Dumbbell Press', sets: 3, reps: '12', equipment: ['Adjustable Bench', 'Dumbbells'] },
          { exercise: 'Cable Tricep Pushdowns', sets: 3, reps: '12-15', equipment: ['Cables', 'Cable Attachments'] },
          { exercise: 'Lateral Raises', sets: 3, reps: '15', equipment: ['Dumbbells'] },
        ],
        finisher: { exercise: 'Push-up Burnout', sets: 1, reps: 'To failure', equipment: [] },
      },
      debug: {
        usedTwoPass: false,
        minutesRequested: 45,
        split: 'push',
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
