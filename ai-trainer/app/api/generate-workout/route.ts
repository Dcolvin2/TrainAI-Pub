// /app/api/generate-workout/route.ts
// DEBUG VERSION - Extensive logging to identify the issue

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { WorkoutService } from '@/lib/services/workoutService';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  console.log('🚀 Starting workout generation...');
  
  try {
    const requestBody = await request.json();
    const { workoutType, timeAvailable = 45, focus } = requestBody;
    
    console.log('📝 Request params:', { workoutType, timeAvailable, focus });
    
    // Check user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) {
      console.error('❌ Auth error:', authError);
      return NextResponse.json({ error: 'Authentication failed', details: authError }, { status: 401 });
    }
    if (!user) {
      console.error('❌ No user found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log('✅ User authenticated:', user.id);

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    if (profileError) {
      console.error('❌ Profile error:', profileError);
      return NextResponse.json({ error: 'Failed to get profile', details: profileError }, { status: 500 });
    }
    console.log('✅ Profile loaded:', { 
      current_weight: profile?.current_weight, 
      goal_weight: profile?.goal_weight 
    });

    // Get user equipment directly to debug
    const { data: userEquipment, error: equipmentError } = await supabase
      .from('user_equipment')
      .select('equipment:equipment_id(name)')
      .eq('user_id', user.id)
      .eq('is_available', true);
    
    if (equipmentError) {
      console.error('❌ Equipment error:', equipmentError);
      return NextResponse.json({ error: 'Failed to get equipment', details: equipmentError }, { status: 500 });
    }
    
    const equipmentList = userEquipment?.map((eq: any) => eq.equipment?.name).filter(Boolean) || [];
    console.log('✅ User equipment found:', equipmentList);
    console.log('📊 Equipment count:', equipmentList.length);

    // Check if tables have data
    const { count: nikeCount } = await supabase
      .from('nike_workouts')
      .select('*', { count: 'exact', head: true });
    
    const { count: exercisesCount } = await supabase
      .from('exercises')
      .select('*', { count: 'exact', head: true });
    
    console.log('📊 Table counts:', { nike_workouts: nikeCount, exercises: exercisesCount });

    // Initialize workout service
    let workoutService;
    try {
      workoutService = new WorkoutService();
      console.log('✅ WorkoutService initialized');
    } catch (serviceError) {
      console.error('❌ WorkoutService initialization error:', serviceError);
      return NextResponse.json({ error: 'Service initialization failed', details: serviceError }, { status: 500 });
    }
    
    // Generate comprehensive prompt using BOTH tables
    let prompt;
    try {
      prompt = await workoutService.generateWorkoutPrompt(
        workoutType || focus || 'upper',
        timeAvailable,
        user.id,
        profile
      );
      console.log('✅ Prompt generated, length:', prompt.length);
      console.log('📝 First 500 chars of prompt:', prompt.substring(0, 500));
    } catch (promptError) {
      console.error('❌ Prompt generation error:', promptError);
      return NextResponse.json({ error: 'Failed to generate prompt', details: promptError }, { status: 500 });
    }

    console.log(`🏋️ Generating ${timeAvailable}-min ${workoutType || focus} workout...`);

    // Call Claude with the enhanced prompt
    let response;
    try {
      response = await fetch('https://api.anthropic.com/v1/messages', {
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
6. Follow the exact time structure provided
7. Return valid JSON only`,
          messages: [{ role: "user", content: prompt }]
        })
      });
      console.log('✅ Claude response received');
    } catch (claudeError: any) {
      console.error('❌ Claude API error:', claudeError);
      return NextResponse.json({ 
        error: 'Failed to generate workout with Claude', 
        details: claudeError.message 
      }, { status: 500 });
    }

    // Parse Claude's response
    let workoutPlan;
    try {
      const claudeResponse = await response.json();
      const responseText = claudeResponse.content[0].text;
      console.log('📝 Claude raw response (first 200 chars):', responseText.substring(0, 200));
      
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        workoutPlan = JSON.parse(jsonMatch[0]);
      } else {
        workoutPlan = JSON.parse(responseText);
      }
      
      console.log('✅ Workout plan parsed successfully');
      console.log('📊 Exercise counts:', {
        warmup: workoutPlan.warmup?.length || 0,
        main: workoutPlan.main?.length || 0,
        accessories: workoutPlan.accessories?.length || 0,
        cooldown: workoutPlan.cooldown?.length || 0
      });
    } catch (parseError: any) {
      console.error('❌ JSON parse error:', parseError);
      return NextResponse.json({ 
        error: 'Failed to parse workout plan', 
        details: parseError.message,
        raw: 'Response parsing failed'
      }, { status: 500 });
    }

    // Validate and fix accessories
    if (workoutPlan.accessories) {
      workoutPlan.accessories = workoutPlan.accessories.map((ex: any) => {
        if (!ex.equipment || ex.equipment.length === 0) {
          const name = ex.name.toLowerCase();
          console.log('⚠️ Fixing equipment for accessory:', ex.name);
          
          if (name.includes('dumbbell') || name.includes('db')) {
            ex.equipment = ['Dumbbells'];
          } else if (name.includes('barbell') || name.includes('bb')) {
            ex.equipment = ['Barbell'];
          } else if (name.includes('cable')) {
            ex.equipment = ['Cables'];
          } else if (name.includes('kettlebell') || name.includes('kb')) {
            ex.equipment = ['Kettlebells'];
          } else {
            ex.equipment = ['Dumbbells'];
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

    console.log('✅ Workout generated successfully:', {
      warmupCount: formattedResponse.metadata.exerciseCount.warmup,
      mainCount: formattedResponse.metadata.exerciseCount.main,
      accessoryCount: formattedResponse.metadata.exerciseCount.accessories,
      cooldownCount: formattedResponse.metadata.exerciseCount.cooldown,
      totalExercises: Object.values(formattedResponse.metadata.exerciseCount).reduce((a: number, b: number) => a + b, 0)
    });

    return NextResponse.json(formattedResponse);

  } catch (error: any) {
    console.error('❌ Unexpected error:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { 
        error: 'Failed to generate workout',
        message: error.message,
        stack: error.stack
      },
      { status: 500 }
    );
  }
} 