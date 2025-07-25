import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    // For now, return a sample workout structure
    // In the future, this would fetch from the database based on the current user's workout plan
    const sampleWorkout = {
      warmup: [
        "5 minutes light cardio",
        "Dynamic stretching",
        "Joint mobility exercises"
      ],
      details: [
        {
          name: "Barbell Bench Press",
          sets: [
            {
              previous: 185,
              prescribed: 190,
              reps: 8,
              rest: 180,
              rpe: 8
            },
            {
              previous: 190,
              prescribed: 195,
              reps: 8,
              rest: 180,
              rpe: 8
            },
            {
              previous: 195,
              prescribed: 200,
              reps: 6,
              rest: 180,
              rpe: 9
            }
          ]
        },
        {
          name: "Dumbbell Flyes",
          sets: [
            {
              previous: 45,
              prescribed: 50,
              reps: 12,
              rest: 90,
              rpe: 7
            },
            {
              previous: 50,
              prescribed: 55,
              reps: 12,
              rest: 90,
              rpe: 8
            },
            {
              previous: 55,
              prescribed: 60,
              reps: 10,
              rest: 90,
              rpe: 8
            }
          ]
        }
      ],
      cooldown: [
        "Static stretching",
        "Foam rolling",
        "Deep breathing exercises"
      ]
    };

    return NextResponse.json(sampleWorkout);
  } catch (error) {
    console.error('Current workout error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch current workout' 
    }, { status: 500 });
  }
} 