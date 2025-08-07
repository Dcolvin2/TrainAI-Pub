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

    // Get recent workouts to check main lift history
    const { data: recentMainLifts } = await supabase
      .from('workout_sessions')
      .select('workout_name, planned_exercises')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    console.log('Recent workouts:', recentMainLifts?.map(w => w.workout_name));

    // Extract the main lifts that were used recently
    const recentlyUsedMainLifts: string[] = [];
    recentMainLifts?.forEach(workout => {
      if (workout.planned_exercises?.main?.[0]?.isMainLift) {
        recentlyUsedMainLifts.push(workout.planned_exercises.main[0].name);
      }
    });

    console.log('Recently used main lifts:', recentlyUsedMainLifts);

    // Get all possible main lifts for this workout type
    const possibleMainLifts = coreLifts[workoutType as keyof typeof coreLifts]?.primary || [];
    console.log('💪 Possible main lifts:', coreLifts[workoutType as keyof typeof coreLifts]?.primary);

    // Filter for available equipment AND not recently used
    let availableMainLifts = possibleMainLifts.filter(lift => {
      // Check equipment availability
      if (lift.includes('Barbell') && !allAvailableEquipment.includes('Barbells')) {
        console.log(`Skipping ${lift} - no barbell`);
        return false;
      }
      if (lift.includes('Dumbbell') && !allAvailableEquipment.includes('Dumbbells')) {
        console.log(`Skipping ${lift} - no dumbbells`);
        return false;
      }
      if (lift.includes('Trap Bar') && !allAvailableEquipment.includes('Trap Bar')) {
        console.log(`Skipping ${lift} - no trap bar`);
        return false;
      }
      return true;
    });

    console.log('Main lifts with available equipment:', availableMainLifts);

    // Remove the most recently used main lift (but keep others)
    if (recentlyUsedMainLifts.length > 0 && availableMainLifts.length > 1) {
      const lastUsedLift = recentlyUsedMainLifts[0];
      const filteredLifts = availableMainLifts.filter(lift => lift !== lastUsedLift);
      
      if (filteredLifts.length > 0) {
        availableMainLifts = filteredLifts;
        console.log(`Filtered out recently used: ${lastUsedLift}`);
      }
    }

    // IMPORTANT: Actually randomize the selection
    const randomIndex = Math.floor(Math.random() * availableMainLifts.length);
    let selectedMainLift = availableMainLifts[randomIndex] || possibleMainLifts[0];

    console.log('✅ MAIN LIFT SELECTED:', selectedMainLift);

    // Get the main lift details
    const { data: mainLiftData } = await supabase
      .from('exercises')
      .select('*')
      .eq('name', selectedMainLift)
      .single();

    console.log('🔍 Main lift data structure:', {
      mainLiftData,
      isArray: Array.isArray(mainLiftData),
      name: mainLiftData?.name
    });

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

    // Get a large pool of potential accessories
    const { data: allAccessoryExercises } = await supabase
      .from('exercises')
      .select('*')
      .in('primary_muscle', accessoryMuscles)
      .limit(100); // Get lots of options

    console.log('📊 Accessories found:', allAccessoryExercises?.length);
    console.log('🔍 First accessory from DB:', allAccessoryExercises?.[0]);
    console.log('🔍 Is it an array?', Array.isArray(allAccessoryExercises?.[0]));

    // Filter out main lifts and recently used
    const freshAccessories = allAccessoryExercises?.filter(ex => {
      // Never use a main lift as an accessory
      if (isCoreLift(ex.name)) return false;
      
      // Prefer exercises not recently used
      if (recentAccessories.has(ex.name)) return false;
      
      return true;
    });

    console.log('🔄 Fresh accessories:', freshAccessories?.map(e => e.name));

    // IMPORTANT: Fully randomize the array before selecting
    const shuffledAccessories = freshAccessories
      ?.sort(() => Math.random() - 0.5)  // First shuffle
      .sort(() => Math.random() - 0.5)  // Double shuffle for better randomization
      .slice(0, 5);  // Take 5 (we'll use 4, but have a backup)

    console.log('✨ Final selected accessories:', shuffledAccessories?.map(e => e.name));
    console.log('🔍 Accessory structure check:', {
      firstAccessory: shuffledAccessories?.[0],
      isArray: Array.isArray(shuffledAccessories?.[0]),
      name: shuffledAccessories?.[0]?.name
    });

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
      .eq('exercise_name', selectedMainLift)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Force main lift rotation by checking last used
    const lastWorkout = recentWorkouts?.[0];
    const lastMainLift = lastWorkout?.planned_exercises?.main?.[0]?.name;

    console.log('🔄 Last main lift was:', lastMainLift);

    // If the same main lift was used last time, force a different one
    if (lastMainLift === selectedMainLift && availableMainLifts.length > 1) {
      const alternativeLifts = availableMainLifts.filter(lift => lift !== selectedMainLift);
      const newMainLift = alternativeLifts[Math.floor(Math.random() * alternativeLifts.length)];
      console.log('🔄 Forcing rotation from', selectedMainLift, 'to', newMainLift);
      selectedMainLift = newMainLift;
    }

    // Build the workout with proper structure
    const workout = {
      warmup: randomWarmups?.map(ex => ({
        name: ex.name,
        sets: '2',
        reps: '10-15',
        instruction: ex.instruction
      })) || [],
      
      main: [
        // The ONE main lift - handle array vs object properly
        {
          name: Array.isArray(mainLiftData) ? mainLiftData[0]?.name : mainLiftData?.name || selectedMainLift,
          sets: '4-5',
          reps: '3-5',
          instruction: Array.isArray(mainLiftData) ? mainLiftData[0]?.instruction : mainLiftData?.instruction || 'Main lift - focus on progressive overload',
          isMainLift: true,
          restMinutes: '3-5'
        },
        // All 4 accessories - handle array vs object properly
        ...(shuffledAccessories?.slice(0, 4).map(ex => ({
          name: Array.isArray(ex) ? ex[0]?.name : ex.name,
          sets: '3',
          reps: '8-12',
          instruction: Array.isArray(ex) ? ex[0]?.instruction : ex.instruction,
          isAccessory: true,
          restMinutes: '1.5-2'
        })) || [])
      ],
      
      cooldown: randomCooldowns?.map(ex => ({
        name: ex.name,
        duration: '30-60 seconds',
        instruction: ex.instruction
      })) || []
    };

    // Save the workout with clear naming
    const { data: session } = await supabase
      .from('workout_sessions')
      .insert({
        user_id: user.id,
        workout_source: 'chat',
        workout_name: `${workoutType} - ${selectedMainLift}`,
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

    // Create response message highlighting variety
    const responseMessage = `Here's your ${workoutType} workout! 

**Today's Focus:** ${selectedMainLift} (${mainLiftData?.instruction || 'Progressive overload day'})

I've selected ${shuffledAccessories?.length || 0} fresh accessory exercises you haven't done recently, along with new warmup and cooldown routines. 

${lastPerformance ? `Last ${selectedMainLift}: ${lastPerformance.actual_weight}lbs x ${lastPerformance.reps}. Try to beat it!` : ''}

The main lift stays consistent for strength gains while everything else rotates for variety. Let me know if you want to swap any exercises!`;

    return NextResponse.json({
      success: true,
      message: responseMessage,
      workout: workout
    });

  } catch (error) {
    console.error('Chat workout error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to generate workout' 
    }, { status: 500 });
  }
} 