export function generateDynamicWarmup(workoutType: string, targetMuscles: string[]): any[] {
  const warmupDatabase = {
    legs: [
      { name: 'Bodyweight Squats', reps: '10', duration: '30s' },
      { name: 'Leg Swings', reps: '10 each', duration: '30s' },
      { name: 'Walking Lunges', reps: '8 each', duration: '30s' },
      { name: 'High Knees', reps: '20', duration: '30s' },
      { name: 'Glute Bridges', reps: '15', duration: '30s' }
    ],
    upper: [
      { name: 'Arm Circles', reps: '10 each way', duration: '30s' },
      { name: 'Band Pull-Aparts', reps: '15', duration: '30s' },
      { name: 'Push-Up to T', reps: '8', duration: '30s' },
      { name: 'Shoulder Rolls', reps: '10', duration: '30s' }
    ],
    push: [
      { name: 'Shoulder Dislocations', reps: '10', duration: '30s' },
      { name: 'Scapular Push-Ups', reps: '10', duration: '30s' },
      { name: 'Light Push-Ups', reps: '10', duration: '30s' },
      { name: 'Arm Circles', reps: '10 each way', duration: '30s' },
      { name: 'Chest Stretch', reps: '30s hold', duration: '30s' }
    ],
    pull: [
      { name: 'Dead Hangs', reps: '20s', duration: '30s' },
      { name: 'Scapular Pull-Ups', reps: '10', duration: '30s' },
      { name: 'Band Rows', reps: '15', duration: '30s' },
      { name: 'Arm Circles', reps: '10 each way', duration: '30s' },
      { name: 'Back Stretch', reps: '30s hold', duration: '30s' }
    ],
    full: [
      { name: 'Bodyweight Squats', reps: '10', duration: '30s' },
      { name: 'Arm Circles', reps: '10 each way', duration: '30s' },
      { name: 'Light Push-Ups', reps: '5', duration: '30s' },
      { name: 'Walking Lunges', reps: '5 each', duration: '30s' },
      { name: 'Full Body Stretch', reps: '30s hold', duration: '30s' }
    ],
    hiit: [
      { name: 'Light Jogging', reps: '2 minutes', duration: '2min' },
      { name: 'Arm Circles', reps: '10 each way', duration: '30s' },
      { name: 'Leg Swings', reps: '10 each', duration: '30s' },
      { name: 'High Knees', reps: '20', duration: '30s' },
      { name: 'Dynamic Stretches', reps: '30s each', duration: '2min' }
    ]
  };

  // Select 3-4 random warmup exercises based on workout type
  const exercises = warmupDatabase[workoutType as keyof typeof warmupDatabase] || warmupDatabase.upper;
  const shuffled = exercises.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 3);
} 