import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Workout {
  type: any;
  warmup: any[];
  mainExercises: any[];
  accessories: any[];
  cooldown: any[];
  duration: number;
  focus: string;
}

export async function modifyWorkout(currentWorkout: Workout, instruction: string): Promise<Workout> {
  const modifiedWorkout = { ...currentWorkout };
  const instructionLower = instruction.toLowerCase();

  // Parse the instruction and apply modifications
  if (instructionLower.includes('add')) {
    await handleAddExercise(modifiedWorkout, instruction);
  } else if (instructionLower.includes('replace')) {
    await handleReplaceExercise(modifiedWorkout, instruction);
  } else if (instructionLower.includes('harder') || instructionLower.includes('more intense')) {
    await handleIncreaseIntensity(modifiedWorkout);
  } else if (instructionLower.includes('easier') || instructionLower.includes('less intense')) {
    await handleDecreaseIntensity(modifiedWorkout);
  } else if (instructionLower.includes('more') || instructionLower.includes('increase')) {
    await handleAddMoreExercises(modifiedWorkout);
  } else if (instructionLower.includes('less') || instructionLower.includes('reduce')) {
    await handleReduceExercises(modifiedWorkout);
  } else if (instructionLower.includes('rest') || instructionLower.includes('time')) {
    await handleModifyRestTime(modifiedWorkout, instruction);
  } else if (instructionLower.includes('core')) {
    await handleAddCoreWork(modifiedWorkout);
  } else {
    // Default: try to add a relevant exercise
    await handleAddExercise(modifiedWorkout, instruction);
  }

  return modifiedWorkout;
}

async function handleAddExercise(workout: Workout, instruction: string) {
  const instructionLower = instruction.toLowerCase();
  
  // Determine what type of exercise to add based on instruction
  if (instructionLower.includes('face pull') || instructionLower.includes('face pulls')) {
    workout.accessories.push({
      name: 'Cable Face Pull',
      sets: 3,
      reps: '12-15',
      rest: 60,
      instruction: 'Pull cable to face level, separate hands at face'
    });
  } else if (instructionLower.includes('core') || instructionLower.includes('abs')) {
    workout.accessories.push({
      name: 'Plank',
      sets: 3,
      reps: '30-60 seconds',
      rest: 45,
      instruction: 'Hold plank position with straight body'
    });
  } else if (instructionLower.includes('pull') || instructionLower.includes('row')) {
    workout.accessories.push({
      name: 'Dumbbell Row',
      sets: 3,
      reps: '10-12',
      rest: 60,
      instruction: 'Row dumbbell to hip, squeeze shoulder blades'
    });
  } else if (instructionLower.includes('push') || instructionLower.includes('press')) {
    workout.accessories.push({
      name: 'Dumbbell Shoulder Press',
      sets: 3,
      reps: '8-10',
      rest: 90,
      instruction: 'Press dumbbells overhead, keep core tight'
    });
  } else if (instructionLower.includes('leg') || instructionLower.includes('squat')) {
    workout.accessories.push({
      name: 'Walking Lunges',
      sets: 3,
      reps: '10-12 each leg',
      rest: 60,
      instruction: 'Step forward into lunge, alternate legs'
    });
  }
}

async function handleReplaceExercise(workout: Workout, instruction: string) {
  const instructionLower = instruction.toLowerCase();
  
  if (instructionLower.includes('squat') && instructionLower.includes('lunge')) {
    // Replace squats with lunges
    const squatIndex = workout.mainExercises.findIndex(ex => 
      ex.name.toLowerCase().includes('squat')
    );
    if (squatIndex !== -1) {
      workout.mainExercises[squatIndex] = {
        name: 'Walking Lunges',
        sets: 4,
        reps: '10-12 each leg',
        rest: 120,
        instruction: 'Step forward into lunge, alternate legs'
      };
    }
  } else if (instructionLower.includes('bench') && instructionLower.includes('push-up')) {
    // Replace bench press with push-ups
    const benchIndex = workout.mainExercises.findIndex(ex => 
      ex.name.toLowerCase().includes('bench')
    );
    if (benchIndex !== -1) {
      workout.mainExercises[benchIndex] = {
        name: 'Push-Ups',
        sets: 4,
        reps: '8-12',
        rest: 90,
        instruction: 'Standard push-up form, full range of motion'
      };
    }
  }
}

async function handleIncreaseIntensity(workout: Workout) {
  // Increase sets and reduce rest time
  workout.mainExercises.forEach(exercise => {
    exercise.sets = Math.min(6, exercise.sets + 1);
    exercise.rest = Math.max(60, exercise.rest - 30);
  });
  
  workout.accessories.forEach(exercise => {
    exercise.sets = Math.min(4, exercise.sets + 1);
    exercise.rest = Math.max(45, exercise.rest - 15);
  });
}

async function handleDecreaseIntensity(workout: Workout) {
  // Decrease sets and increase rest time
  workout.mainExercises.forEach(exercise => {
    exercise.sets = Math.max(2, exercise.sets - 1);
    exercise.rest = Math.min(180, exercise.rest + 30);
  });
  
  workout.accessories.forEach(exercise => {
    exercise.sets = Math.max(2, exercise.sets - 1);
    exercise.rest = Math.min(90, exercise.rest + 15);
  });
}

async function handleAddMoreExercises(workout: Workout) {
  // Add more accessories
  const additionalExercises = [
    {
      name: 'Dumbbell Lateral Raises',
      sets: 3,
      reps: '12-15',
      rest: 60,
      instruction: 'Raise dumbbells out to sides to shoulder height'
    },
    {
      name: 'Tricep Dips',
      sets: 3,
      reps: '8-12',
      rest: 60,
      instruction: 'Dip movement focusing on tricep extension'
    }
  ];
  
  workout.accessories.push(...additionalExercises);
}

async function handleReduceExercises(workout: Workout) {
  // Remove some accessories
  if (workout.accessories.length > 2) {
    workout.accessories = workout.accessories.slice(0, -1);
  }
}

async function handleModifyRestTime(workout: Workout, instruction: string) {
  const instructionLower = instruction.toLowerCase();
  
  if (instructionLower.includes('reduce') || instructionLower.includes('less')) {
    workout.mainExercises.forEach(exercise => {
      exercise.rest = Math.max(60, exercise.rest - 30);
    });
    workout.accessories.forEach(exercise => {
      exercise.rest = Math.max(45, exercise.rest - 15);
    });
  } else if (instructionLower.includes('increase') || instructionLower.includes('more')) {
    workout.mainExercises.forEach(exercise => {
      exercise.rest = Math.min(180, exercise.rest + 30);
    });
    workout.accessories.forEach(exercise => {
      exercise.rest = Math.min(90, exercise.rest + 15);
    });
  }
}

async function handleAddCoreWork(workout: Workout) {
  const coreExercises = [
    {
      name: 'Plank',
      sets: 3,
      reps: '30-60 seconds',
      rest: 45,
      instruction: 'Hold plank position with straight body'
    },
    {
      name: 'Russian Twists',
      sets: 3,
      reps: '20-30 each side',
      rest: 45,
      instruction: 'Rotate torso side to side while seated'
    }
  ];
  
  // Add core exercises to accessories
  workout.accessories.push(...coreExercises);
}

// Helper function to get exercises from database
async function getExercisesByMuscleGroup(muscleGroup: string) {
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .eq('primary_muscle', muscleGroup)
    .limit(5);
  
  if (error) {
    console.error('Error fetching exercises:', error);
    return [];
  }
  
  return data || [];
} 