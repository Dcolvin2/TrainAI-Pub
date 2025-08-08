// /app/api/generate-workout/route.ts
// BACKEND ONLY - Works with existing UI

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { WorkoutService } from '@/lib/services/workoutService';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const { workoutType, timeAvailable = 45, focus } = await request.json();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // Initialize workout service
    const workoutService = new WorkoutService();
    
    // Generate comprehensive prompt using BOTH tables
    const prompt = await workoutService.generateWorkoutPrompt(
      workoutType || focus || 'upper',
      timeAvailable,
      user.id,
      profile
    );

    console.log(`Generating ${timeAvailable}-min workout using Nike + Exercises tables`);

    // Call Claude with the enhanced prompt
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 2000,
        temperature: 0.7,
        system: `You are an expert fitness coach. You MUST:
1. Use exercises ONLY from the provided lists
2. Mix Nike workout exercises with regular database exercises
3. Ensure ALL accessories use equipment (no bodyweight accessories)
4. Include ${timeAvailable < 30 ? '3-5' : '5-10'} minute warmup
5. Include ${timeAvailable < 30 ? '2-3' : '5-10'} minute cooldown
6. Follow the exact time structure provided`,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const claudeResponse = await response.json();
    const workoutPlan = JSON.parse(claudeResponse.content[0].text);

    // Validate accessories have equipment
    if (workoutPlan.accessories) {
      workoutPlan.accessories = workoutPlan.accessories.map((ex: any) => {
        if (!ex.equipment || ex.equipment.length === 0) {
          // Infer equipment from name
          const name = ex.name.toLowerCase();
          if (name.includes('dumbbell') || name.includes('db')) {
            ex.equipment = ['Dumbbells'];
          } else if (name.includes('barbell') || name.includes('bb')) {
            ex.equipment = ['Barbell'];
          } else if (name.includes('cable')) {
            ex.equipment = ['Cables'];
          } else if (name.includes('kettlebell') || name.includes('kb')) {
            ex.equipment = ['Kettlebells'];
          } else {
            ex.equipment = ['Dumbbells']; // Default fallback
          }
        }
        return ex;
      });
    }

    // Format response to match existing UI expectations
    const formattedResponse = {
      warmup: workoutPlan.warmup || [],
      main: workoutPlan.main || [],
      accessories: workoutPlan.accessories || [],
      cooldown: workoutPlan.cooldown || [],
      // Additional metadata for logging
      metadata: {
        duration: timeAvailable,
        type: workoutType || focus,
        exerciseCount: {
          warmup: workoutPlan.warmup?.length || 0,
          main: workoutPlan.main?.length || 0,
          accessories: workoutPlan.accessories?.length || 0,
          cooldown: workoutPlan.cooldown?.length || 0
        }
      }
    };

    // Log exercise sources for monitoring
    console.log('Workout generated:', {
      warmupCount: formattedResponse.metadata.exerciseCount.warmup,
      mainCount: formattedResponse.metadata.exerciseCount.main,
      accessoryCount: formattedResponse.metadata.exerciseCount.accessories,
      cooldownCount: formattedResponse.metadata.exerciseCount.cooldown,
      totalExercises: Object.values(formattedResponse.metadata.exerciseCount).reduce((a: number, b: number) => a + b, 0)
    });

    return NextResponse.json(formattedResponse);

  } catch (error) {
    console.error('Workout generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate workout' },
      { status: 500 }
    );
  }
} 