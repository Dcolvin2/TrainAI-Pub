import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Import core lift functions
import { getMainLift, isCoreLift, coreLifts } from '../../../lib/coreLiftRotation';

export async function POST(request: Request) {
  console.log('🟦 CHAT-WORKOUT ENDPOINT CALLED');
  
  try {
    const { message, currentWorkout, sessionId } = await request.json();
    console.log('📝 Message received:', message);
    
    // Get user from auth context or request body
    const user = { id: sessionId }; // Simplified for now
    
    console.log('Chat request:', { message, hasCurrentWorkout: !!currentWorkout });

    // Check if this is a Nike workout request
    if (message.toLowerCase().includes('nike')) {
      const nikeMatch = message.match(/nike\s+(\d+)/i);
      if (nikeMatch) {
        const workoutNumber = parseInt(nikeMatch[1]);
        const nikeResponse = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/nike_workouts?workout_number=eq.${workoutNumber}`, {
          headers: {
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
          }
        });
        
        if (nikeResponse.ok) {
          const nikeWorkout = await nikeResponse.json();
          if (nikeWorkout && nikeWorkout.length > 0) {
            return NextResponse.json({
              success: true,
              message: `Nike Workout #${workoutNumber}: ${nikeWorkout[0].workout_name}`,
              workout: {
                warmup: [],
                main: [{ name: nikeWorkout[0].workout_name, sets: '1', reps: 'AMRAP', instruction: nikeWorkout[0].description }],
                cooldown: []
              }
            });
          }
        }
      }
    }

    // Check if this is a modification request
    const messageLower = message.toLowerCase();
    const modificationKeywords = ['swap', 'replace', 'change', 'remove', 'different', 'instead', 'substitute', 'switch'];
    const isModificationRequest = modificationKeywords.some(keyword => messageLower.includes(keyword));

    if (isModificationRequest && currentWorkout) {
      console.log('Modification request detected');
      
      // Determine what equipment type we're working with
      let requiredEquipment: string[] = [];
      
      // Check if current workout is kettlebell, dumbbell, etc.
      if (messageLower.includes('kettlebell') || (currentWorkout.main && currentWorkout.main.some((ex: any) => ex.name?.toLowerCase().includes('kettlebell')))) {
        requiredEquipment = ['Kettlebells'];
      } else if (messageLower.includes('dumbbell') || (currentWorkout.main && currentWorkout.main.some((ex: any) => ex.name?.toLowerCase().includes('dumbbell')))) {
        requiredEquipment = ['Dumbbells'];
      } else if (messageLower.includes('barbell') || (currentWorkout.main && currentWorkout.main.some((ex: any) => ex.name?.toLowerCase().includes('barbell')))) {
        requiredEquipment = ['Barbells'];
      }

      // Find which exercise to replace
      let exerciseToReplace = null;
      let exerciseIndex = -1;
      let exercisePhase = 'main'; // default to main

      // Try to identify the exercise from the message
      const allExercises = [
        ...(currentWorkout.warmup || []).map((ex: any, i: number) => ({...ex, phase: 'warmup', index: i})),
        ...(currentWorkout.main || []).map((ex: any, i: number) => ({...ex, phase: 'main', index: i})),
        ...(currentWorkout.cooldown || []).map((ex: any, i: number) => ({...ex, phase: 'cooldown', index: i}))
      ];

      // Find exercise mentioned in message
      for (const ex of allExercises) {
        if (messageLower.includes(ex.name.toLowerCase())) {
          exerciseToReplace = ex.name;
          exerciseIndex = ex.index;
          exercisePhase = ex.phase;
          break;
        }
      }

      // If no specific exercise mentioned, replace the last mentioned or first main exercise
      if (!exerciseToReplace && currentWorkout.main && currentWorkout.main.length > 0) {
        exerciseToReplace = currentWorkout.main[0].name;
        exerciseIndex = 0;
        exercisePhase = 'main';
      }

      // Get a replacement exercise WITH THE SAME EQUIPMENT
      let query = supabase
        .from('exercises')
        .select('*')
        .eq('exercise_phase', exercisePhase);

      // Filter by equipment if specified
      if (requiredEquipment.length > 0) {
        query = query.contains('equipment_required', requiredEquipment);
      }

      // Exclude the current exercise
      if (exerciseToReplace) {
        query = query.neq('name', exerciseToReplace);
      }

      const { data: replacementExercises } = await query.limit(20);

      if (replacementExercises && replacementExercises.length > 0) {
        // Pick a random replacement
        const replacement = replacementExercises[Math.floor(Math.random() * replacementExercises.length)];

        // Create updated workout
        const updatedWorkout = { ...currentWorkout };

        // Update the specific exercise in the workout
        if (exercisePhase === 'warmup' && updatedWorkout.warmup) {
          updatedWorkout.warmup[exerciseIndex] = {
            name: replacement.name,
            sets: '2',
            reps: '10-15',
            instruction: replacement.instruction
          };
        } else if (exercisePhase === 'main' && updatedWorkout.main) {
          updatedWorkout.main[exerciseIndex] = {
            name: replacement.name,
            sets: '3',
            reps: '8-12',
            instruction: replacement.instruction
          };
        } else if (exercisePhase === 'cooldown' && updatedWorkout.cooldown) {
          updatedWorkout.cooldown[exerciseIndex] = {
            name: replacement.name,
            duration: replacement.set_duration_seconds ? `${replacement.set_duration_seconds} seconds` : '30 seconds',
            instruction: replacement.instruction
          };
        }

        return NextResponse.json({
          success: true,
          isModification: true,
          message: `Sure! Let's swap ${exerciseToReplace} with ${replacement.name}. ${replacement.instruction || 'This is a great alternative that targets the same muscle groups.'}`,
          workout: updatedWorkout,
          modification: {
            original: exerciseToReplace,
            replacement: replacement.name,
            phase: exercisePhase,
            index: exerciseIndex
          }
        });
      } else {
        return NextResponse.json({
          success: true,
          isModification: true,
          message: `I couldn't find a suitable ${requiredEquipment.join('/')} replacement. Try asking for a different type of exercise.`
        });
      }
    }

    // Get user's equipment
    const { data: userEquipment } = await supabase
      .from('user_equipment')
      .select('equipment_name')
      .eq('user_id', user.id);

    const availableEquipment = userEquipment?.map(e => e.equipment_name) || [];

    // Detect equipment mentioned in message
    const mentionedEquipment: string[] = [];
    const equipmentKeywords: Record<string, string[]> = {
      'Superbands': ['superband', 'resistance band', 'band', 'resistance bands', 'superbands'],
      'Kettlebells': ['kettlebell', 'kb', 'kettlebells'],
      'Dumbbells': ['dumbbell', 'db', 'dumbbells'],
      'Barbells': ['barbell', 'bb', 'barbells', 'barbell strength', 'barbell workout'],
      'Bench': ['bench'],
      'Pull Up Bar': ['pull-up bar', 'pullup bar', 'bar', 'pull up bar'],
      'Cables': ['cable', 'cable machine', 'cables'],
      'Machine': ['machine'],
      'Bodyweight': ['bodyweight', 'no equipment', 'no weights']
    };

    Object.entries(equipmentKeywords).forEach(([equipment, keywords]) => {
      if (keywords.some(keyword => messageLower.includes(keyword))) {
        mentionedEquipment.push(equipment);
      }
    });

    const allAvailableEquipment = [...new Set([...availableEquipment, ...mentionedEquipment])];

    // Get user's last 5 workouts to avoid repetition
    const { data: recentWorkouts } = await supabase
      .from('workout_sessions')
      .select('planned_exercises')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    // Extract recently used exercises
    const recentlyUsedExercises = new Set();
    recentWorkouts?.forEach(workout => {
      if (workout.planned_exercises) {
        ['warmup', 'main', 'cooldown'].forEach(phase => {
          workout.planned_exercises[phase]?.forEach((ex: any) => {
            if (ex.name && !isCoreLift(ex.name)) {
              recentlyUsedExercises.add(ex.name);
            }
          });
        });
      }
    });

    console.log('Recently used exercises to avoid:', Array.from(recentlyUsedExercises));

    // Determine workout type from message
    let workoutType = 'upper'; // default
    if (messageLower.includes('push')) workoutType = 'push';
    else if (messageLower.includes('pull') || messageLower.includes('back')) workoutType = 'pull';
    else if (messageLower.includes('leg') || messageLower.includes('lower')) workoutType = 'legs';
    else if (messageLower.includes('upper')) workoutType = 'upper';
    else if (messageLower.includes('lower')) workoutType = 'lower';
    else if (messageLower.includes('full body') || messageLower.includes('fullbody')) workoutType = 'upper';

    console.log('🎯 Workout type detected:', workoutType);

    // Debug: Log what we're working with
    console.log('Workout type requested:', workoutType);
    console.log('🔧 Available equipment:', allAvailableEquipment);

    // Define what accessories to include based on workout type
    let accessoryExerciseNames: string[] = [];
    let accessoryMuscles: string[] = [];

    if (workoutType === 'pull' || workoutType === 'back') {
      accessoryExerciseNames = [
        'Pull-Up',
        'Chin-Up',
        'Barbell Bent-Over Row',
        'Dumbbell Single-Arm Row',
        'Cable Row',
        'Lat Pulldown',
        'Barbell Romanian Deadlift',
        'Face Pulls',
        'Barbell Curl',
        'Dumbbell Hammer Curl'
      ];
      accessoryMuscles = ['back', 'biceps', 'rear delts', 'lats'];
    } else if (workoutType === 'push') {
      accessoryExerciseNames = [
        'Dumbbell Flyes',
        'Cable Chest Fly',
        'Dips',
        'Cable Lateral Raise',
        'Dumbbell Lateral Raise',
        'Close-Grip Bench Press',
        'Cable Tricep Pushdown',
        'Overhead Tricep Extension'
      ];
      accessoryMuscles = ['chest', 'shoulders', 'triceps'];
    } else if (workoutType === 'legs') {
      accessoryExerciseNames = [
        'Barbell Romanian Deadlift',
        'Dumbbell Bulgarian Split Squat',
        'Walking Lunges',
        'Leg Curls',
        'Leg Extensions',
        'Calf Raises',
        'Barbell Hip Thrust',
        'Goblet Squat'
      ];
      accessoryMuscles = ['quads', 'hamstrings', 'glutes', 'calves'];
    } else {
      // Upper/Lower/Full Body
      accessoryExerciseNames = [
        'Pull-Up',
        'Chin-Up',
        'Barbell Bent-Over Row',
        'Dumbbell Single-Arm Row',
        'Dumbbell Flyes',
        'Cable Chest Fly',
        'Dips',
        'Cable Lateral Raise',
        'Dumbbell Lateral Raise',
        'Barbell Romanian Deadlift',
        'Face Pulls',
        'Barbell Curl',
        'Dumbbell Hammer Curl',
        'Cable Tricep Pushdown',
        'Overhead Tricep Extension'
      ];
      accessoryMuscles = ['chest', 'back', 'shoulders', 'arms', 'triceps', 'biceps'];
    }

    // ============ DEBUG MAIN LIFT SELECTION ============
    console.log('🔵 === MAIN LIFT DEBUG ===');

    // Check what main lifts are possible
    const possibleMainLifts = coreLifts[workoutType as keyof typeof coreLifts]?.primary || [];
    console.log('1️⃣ Possible main lifts:', possibleMainLifts);

    // Check recent workouts
    const lastMainLift = recentWorkouts?.[0]?.planned_exercises?.main?.[0]?.name;
    console.log('2️⃣ Last main lift used:', lastMainLift);

    // Filter available lifts
    const availableMainLifts = possibleMainLifts.filter(lift => lift !== lastMainLift);
    console.log('3️⃣ Available after filtering:', availableMainLifts);

    // Show the random selection
    const randomIndex = Math.floor(Math.random() * availableMainLifts.length);
    console.log('4️⃣ Random index chosen:', randomIndex, 'out of', availableMainLifts.length);

    let mainLift = availableMainLifts[randomIndex] || possibleMainLifts[0];
    console.log('5️⃣ FINAL MAIN LIFT:', mainLift);

    // ============ DEBUG ACCESSORY SELECTION ============
    console.log('🟢 === ACCESSORY DEBUG ===');

    // Fisher-Yates shuffle function
    function shuffle<T>(array: T[]): T[] {
      const result = [...array];
      for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
      }
      return result;
    }

    // Get ALL accessories
    const { data: allAccessories } = await supabase
      .from('exercises')
      .select('*')
      .in('primary_muscle', ['chest', 'shoulders', 'triceps'])
      .neq('name', mainLift)  // Exclude the main lift
      .not('name', 'ilike', '%bench press%')  // Exclude other bench variations
      .not('name', 'ilike', '%overhead press%')  // Exclude other presses
      .limit(100);

    console.log(`Found ${allAccessories?.length} total accessories`);

    // Shuffle ALL accessories properly
    const shuffledAccessories = shuffle(allAccessories || []);

    // Take the first 4 from the shuffled list
    const selectedAccessories = shuffledAccessories.slice(0, 4);

    console.log('Selected accessories after proper shuffle:');
    selectedAccessories.forEach((acc, i) => {
      console.log(`  ${i + 1}. ${acc.name}`);
    });

    // ============ DEBUG WARMUP SELECTION ============
    console.log('🟡 === WARMUP DEBUG ===');

    const { data: warmupExercises } = await supabase
      .from('exercises')
      .select('name')
      .eq('exercise_phase', 'warmup')
      .limit(30);

    console.log('1️⃣ Total warmups available:', warmupExercises?.length);
    console.log('2️⃣ Sample warmups:', warmupExercises?.slice(0, 5).map(e => e.name));

    const warmupShuffle = [...(warmupExercises || [])].sort(() => Math.random() - 0.5);
    console.log('3️⃣ Selected warmups:', warmupShuffle.slice(0, 3).map(e => e.name));

    // ============ FORCE COMPLETE RANDOMIZATION ============
    console.log('🟠 === FORCE RANDOMIZATION DEBUG ===');

    // Get today's used exercises
    const { data: todaysWorkouts } = await supabase
      .from('workout_sessions')
      .select('planned_exercises')
      .eq('user_id', user.id)
      .gte('created_at', new Date().toISOString().split('T')[0])
      .order('created_at', { ascending: false });

    const usedToday = new Set();
    todaysWorkouts?.forEach(w => {
      w.planned_exercises?.main?.forEach((ex: any) => {
        usedToday.add(ex.name);
      });
    });

    console.log('❌ Already used today:', Array.from(usedToday));

    // Filter out everything used today
    const availableAccessories = allAccessories?.filter(ex => !usedToday.has(ex.name));
    console.log('✅ Still available:', availableAccessories?.length);

    // Check data structure before building workout
    console.log('🔍 === DATA STRUCTURE CHECK ===');
    console.log('Main lift is array?', Array.isArray(mainLift));
    console.log('First accessory is array?', Array.isArray(selectedAccessories?.[0]));
    console.log('First warmup is array?', Array.isArray(warmupShuffle?.[0]));

    // Get the main lift details
    const { data: mainLiftData } = await supabase
      .from('exercises')
      .select('*')
      .eq('name', mainLift)
      .single();

    console.log('🔍 Main lift data structure:', {
      mainLiftData,
      isArray: Array.isArray(mainLiftData),
      name: mainLiftData?.name
    });

    // Get recently used accessories (not main lifts)
    const recentAccessories = new Set();
    recentWorkouts?.forEach(workout => {
      workout.planned_exercises?.main?.forEach((ex: any) => {
        // Skip the main lift, only track accessories
        if (ex.name && !ex.isMainLift) {
          recentAccessories.add(ex.name);
        }
      });
    });

    console.log('Recently used accessories:', Array.from(recentAccessories));

    // Get FRESH warmup exercises (avoiding recent ones)
    const { data: allWarmupExercises } = await supabase
      .from('exercises')
      .select('*')
      .eq('exercise_phase', 'warmup')
      .limit(50);

    // Filter out recently used and randomize
    const freshWarmups = allWarmupExercises
      ?.filter(ex => !recentlyUsedExercises.has(ex.name))
      .sort(() => 0.5 - Math.random())
      .slice(0, 3) || [];

    // If we don't have enough fresh ones, use any warmups
    const randomWarmups = freshWarmups.length >= 3 
      ? freshWarmups 
      : allWarmupExercises?.sort(() => 0.5 - Math.random()).slice(0, 3) || [];

    // Get FRESH cooldown exercises
    const { data: allCooldownExercises } = await supabase
      .from('exercises')
      .select('*')
      .eq('exercise_phase', 'cooldown')
      .limit(50);

    const freshCooldowns = allCooldownExercises
      ?.filter(ex => !recentlyUsedExercises.has(ex.name))
      .sort(() => 0.5 - Math.random())
      .slice(0, 3) || [];

    const randomCooldowns = freshCooldowns.length >= 3
      ? freshCooldowns
      : allCooldownExercises?.sort(() => 0.5 - Math.random()).slice(0, 3) || [];

    // Get last performance for the main lift
    const { data: lastPerformance } = await supabase
      .from('workout_sets')
      .select('actual_weight, reps')
      .eq('exercise_name', mainLift)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Force main lift rotation by checking last used
    const lastWorkout = recentWorkouts?.[0];
    const lastMainLiftUsed = lastWorkout?.planned_exercises?.main?.[0]?.name;

    console.log('🔄 Last main lift was:', lastMainLiftUsed);

    // If the same main lift was used last time, force a different one
    if (lastMainLiftUsed === mainLift && availableMainLifts.length > 1) {
      const alternativeLifts = availableMainLifts.filter(lift => lift !== mainLift);
      const newMainLift = alternativeLifts[Math.floor(Math.random() * alternativeLifts.length)];
      console.log('🔄 Forcing rotation from', mainLift, 'to', newMainLift);
      mainLift = newMainLift;
    }

    // Build the workout
    const workout = {
      warmup: randomWarmups?.map(ex => ({
        name: ex.name,
        sets: '2',
        reps: '10-15',
        instruction: ex.instruction
      })) || [],
      
      main: [
        // The ONE main lift
        {
          name: mainLift,
          sets: '4-5',
          reps: '3-5',
          instruction: 'Main lift - progressive overload',
          isMainLift: true
        },
        // Use the properly shuffled accessories
        ...selectedAccessories.map(acc => ({
          name: acc.name,
          sets: '3',
          reps: '8-12',
          instruction: acc.instruction,
          isAccessory: true
        }))
      ],
      
      cooldown: randomCooldowns?.map(ex => ({
        name: ex.name,
        duration: '30-60 seconds',
        instruction: ex.instruction
      })) || []
    };

    console.log('📦 === FINAL WORKOUT CHECK ===');
    console.log('Final warmups:', workout.warmup?.map(e => e.name));
    console.log('Final main lift:', workout.main?.[0]?.name);
    console.log('Final accessories:', workout.main?.slice(1).map(e => e.name));

    // Save the workout with clear naming
    const { data: session } = await supabase
      .from('workout_sessions')
      .insert({
        user_id: user.id,
        workout_source: 'chat',
        workout_name: `${workoutType} - ${mainLift}`,
        planned_exercises: workout,
        date: new Date().toISOString()
      })
      .select()
      .single();

    console.log('📤 Returning workout with:', {
      mainLift: workout.main[0].name,
      accessories: workout.main.slice(1).map(e => e.name),
      warmups: workout.warmup.map(e => e.name),
      cooldowns: workout.cooldown.map(e => e.name)
    });

    // CRITICAL DEBUG - Right before returning
    console.log('🚨 FINAL CHECK BEFORE RETURNING:');
    console.log('Workout object:', JSON.stringify({
      mainLift: workout.main?.[0]?.name,
      accessories: workout.main?.slice(1).map(e => e.name),
      warmups: workout.warmup?.map(e => e.name)
    }, null, 2));

    // Create response message highlighting variety
    const responseMessage = `Here's your ${workoutType} workout! 

**Today's Focus:** ${mainLift} (${mainLiftData?.instruction || 'Progressive overload day'})

I've selected ${selectedAccessories?.length || 0} fresh accessory exercises you haven't done recently, along with new warmup and cooldown routines. 

${lastPerformance ? `Last ${mainLift}: ${lastPerformance.actual_weight}lbs x ${lastPerformance.reps}. Try to beat it!` : ''}

The main lift stays consistent for strength gains while everything else rotates for variety. Let me know if you want to swap any exercises!`;

    return NextResponse.json({
      success: true,
      message: responseMessage,
      workout: workout,
      debug: {
        mainLiftName: workout.main?.[0]?.name,
        accessoryNames: workout.main?.slice(1).map(e => e.name),
        warmupNames: workout.warmup?.map(e => e.name),
        timestamp: Date.now()
      }
    });

  } catch (error) {
    console.error('Chat workout error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to generate workout' 
    }, { status: 500 });
  }
} 