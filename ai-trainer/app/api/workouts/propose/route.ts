import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildCoreLiftPool } from '@/lib/buildCoreLiftPool';
import { getUserEquipment } from '@/lib/getUserEquipment';
import { dbg } from '@/lib/debug';

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

    const userEquip = await getUserEquipment(user.id);   // ['Barbell', 'Squat Rack', …]
    dbg('userEquip', userEquip);
    const corePool = await buildCoreLiftPool(focus, userEquip);

    // pick strongest candidate (later: weight progression logic)
    const coreLift = corePool[0];

    // Fail-loud guardrail
    if (coreLift.name === 'Push-up') {
      console.warn('⚠️  Fallback core-lift used – user lacks equipment for focus:', focus);
    }

    console.log(`[propose] Selected core lift: ${coreLift.name}`);

    // For now, use a simple accessory pool
    const accessories = [
      { name: 'Dumbbell Flyes', sets: 3, reps: '12-15' },
      { name: 'Overhead Press', sets: 3, reps: '10-12' },
      { name: 'Lateral Raises', sets: 3, reps: '15-20' }
    ];

    const plan = {
      focus,
      minutes,
      coreLift: coreLift.name,
      accessoriesList: accessories.map(a => a.name).join(', '),
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
      accessories,
      cooldown: [
        { name: 'Chest Stretch', duration: '30 sec each side' },
        { name: 'Shoulder Stretch', duration: '30 sec each arm' }
      ]
    };

    console.table({ 
      focus, 
      minutes, 
      equipment: userEquip, 
      coreLiftCandidates: corePool.map(lift => lift.name), 
      accessoriesPool: accessories.map(acc => acc.name) 
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