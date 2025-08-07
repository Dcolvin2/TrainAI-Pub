export const coreLifts = {
  push: {
    primary: [
      'Barbell Bench Press',
      'Dumbbell Bench Press', 
      'Barbell Incline Press',
      'Dumbbell Incline Press',
      'Barbell Overhead Press',
      'Dumbbell Shoulder Press'
    ],
    accessories: ['chest', 'shoulders', 'triceps']
  },
  pull: {
    primary: [
      'Barbell Deadlift',
      'Trap Bar Deadlift',
      'Barbell Sumo Deadlift'
    ],
    accessories: ['back', 'biceps', 'rear delts', 'lats']
  },
  legs: {
    primary: [
      'Barbell Back Squat',
      'Barbell Front Squat'
    ],
    accessories: ['quads', 'hamstrings', 'glutes', 'calves']
  },
  upper: {
    primary: [
      'Barbell Bench Press',
      'Dumbbell Bench Press',
      'Barbell Incline Press',
      'Barbell Overhead Press',
      'Dumbbell Shoulder Press'
    ],
    accessories: ['chest', 'back', 'shoulders', 'arms', 'triceps', 'biceps']
  },
  lower: {
    primary: [
      'Barbell Back Squat',
      'Barbell Front Squat',
      'Barbell Deadlift',
      'Trap Bar Deadlift'
    ],
    accessories: ['quads', 'hamstrings', 'glutes', 'calves']
  },
  back: {
    primary: [
      'Barbell Deadlift',
      'Trap Bar Deadlift',
      'Barbell Sumo Deadlift'
    ],
    accessories: ['back', 'lats', 'rear delts', 'biceps']
  }
};

// Common accessory exercises to prioritize (not exhaustive, just examples)
export const accessoryExercises = {
  pull: [
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
  ],
  push: [
    'Dumbbell Flyes',
    'Cable Chest Fly',
    'Dips',
    'Cable Lateral Raise',
    'Dumbbell Lateral Raise',
    'Cable Tricep Pushdown',
    'Overhead Tricep Extension',
    'Close-Grip Bench Press'
  ],
  legs: [
    'Barbell Romanian Deadlift',
    'Dumbbell Bulgarian Split Squat',
    'Leg Press',
    'Lunges',
    'Leg Curls',
    'Leg Extensions',
    'Calf Raises',
    'Barbell Hip Thrust'
  ]
};

export function getMainLift(workoutType: string, availableEquipment: string[]): string {
  const lifts = coreLifts[workoutType]?.primary || coreLifts.upper.primary;
  
  // Filter by available equipment
  const availableLifts = lifts.filter(lift => {
    if (lift.includes('Barbell') && !availableEquipment.includes('Barbells')) return false;
    if (lift.includes('Dumbbell') && !availableEquipment.includes('Dumbbells')) return false;
    if (lift.includes('Trap Bar') && !availableEquipment.includes('Trap Bar')) return false;
    return true;
  });
  
  // Pick one randomly from available
  return availableLifts[Math.floor(Math.random() * availableLifts.length)] || lifts[0];
}

export function isCoreLift(exerciseName: string): boolean {
  // Check if an exercise is a core lift
  const allCoreLifts = Object.values(coreLifts).flatMap(category => category.primary);
  return allCoreLifts.includes(exerciseName);
} 