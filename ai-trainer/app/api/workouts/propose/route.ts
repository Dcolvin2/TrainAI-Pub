import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildCoreLiftPool } from '@/lib/buildCoreLiftPool';
import { getUserEquipment } from '@/lib/getUserEquipment';
import { pickCoreLift } from '@/lib/pickCoreLift';
import { loadNextNike } from '@/lib/loadNextNike';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { focus, minutes } = await req.json();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    console.log(`[propose] Generating workout for focus: ${focus}, minutes: ${minutes}`);

    // Handle Nike WOD
    if (focus === 'nike') {
      const nikePlan = await loadNextNike(user.id);
      return NextResponse.json(nikePlan);
    }

    const equip = await getUserEquipment(user.id);
    console.log(`[propose] User equipment:`, equip);

    const hardLift = pickCoreLift(focus, equip);
    console.log(`[propose] Hard-coded core lift:`, hardLift);

    if (hardLift) {
      // Use hard-coded core lift
      const plan = {
        focus,
        minutes,
        coreLift: hardLift,
        warmup: [
          { name: 'Arm Circles', reps: '10 each way' },
          { name: 'Push-up to T', reps: '8 each side' }
        ],
        mainLift: {
          name: hardLift,
          sets: 4,
          reps: '8-10',
          rest: '2-3 min'
        },
        accessories: [
          { name: 'Dumbbell Flyes', sets: 3, reps: '12-15' },
          { name: 'Overhead Press', sets: 3, reps: '10-12' },
          { name: 'Lateral Raises', sets: 3, reps: '15-20' }
        ],
        cooldown: [
          { name: 'Chest Stretch', duration: '30 sec each side' },
          { name: 'Shoulder Stretch', duration: '30 sec each arm' }
        ]
      };

      console.table({ 
        focus, 
        minutes, 
        equipment: equip, 
        coreLiftCandidates: [hardLift], 
        accessoriesPool: plan.accessories.map(acc => acc.name) 
      });

      return NextResponse.json(plan);
    }

    // Fallback to database lookup for non-mapped foci
    const corePool = await buildCoreLiftPool(focus, equip);
    const coreLift = corePool[0];

    // Fail-loud guardrail
    if (coreLift.name === 'Push-up') {
      console.warn('⚠️  Fallback core-lift used – user lacks equipment for focus:', focus);
    }

    console.log(`[propose] Selected core lift: ${coreLift.name}`);

    const plan = {
      focus,
      minutes,
      coreLift: coreLift.name,
      warmup: [
        { name: 'Arm Circles', reps: '10 each way' },
        { name: 'Push-up to T', reps: '8 each side' }
      ],
      mainLift: {
        name: coreLift.name,
        sets: 4,
        reps: '8-10',
        rest: '2-3 min'
      },
      accessories: [
        { name: 'Dumbbell Flyes', sets: 3, reps: '12-15' },
        { name: 'Overhead Press', sets: 3, reps: '10-12' },
        { name: 'Lateral Raises', sets: 3, reps: '15-20' }
      ],
      cooldown: [
        { name: 'Chest Stretch', duration: '30 sec each side' },
        { name: 'Shoulder Stretch', duration: '30 sec each arm' }
      ]
    };

    console.table({ 
      focus, 
      minutes, 
      equipment: equip, 
      coreLiftCandidates: corePool.map(lift => lift.name), 
      accessoriesPool: plan.accessories.map((acc: any) => acc.name) 
    });

    return NextResponse.json(plan);

  } catch (error) {
    console.error('[propose] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate workout proposal' },
      { status: 500 }
    );
  }
} 