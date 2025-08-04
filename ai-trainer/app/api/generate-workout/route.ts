import { NextRequest, NextResponse } from 'next/server';
import { generateWorkoutForType } from '@/lib/workoutGenerator';

export async function POST(request: NextRequest) {
  try {
    const { type, timeMinutes, userId } = await request.json();

    // Exercise count scaling based on time
    const exerciseCount: Record<number, { warmup: number; accessories: number; cooldown: number }> = {
      15: { warmup: 2, accessories: 2, cooldown: 1 },
      30: { warmup: 3, accessories: 3, cooldown: 2 },
      45: { warmup: 3, accessories: 4, cooldown: 2 },
      60: { warmup: 4, accessories: 5, cooldown: 3 }
    };

    // Use timeMinutes to determine exercise count
    const counts = exerciseCount[timeMinutes as keyof typeof exerciseCount] || exerciseCount[45];

    // Create workout type object
    const workoutType = {
      id: type,
      name: type,
      category: 'split',
      target_muscles: type === 'push' ? ['chest', 'shoulders', 'triceps'] : 
                     type === 'pull' ? ['back', 'biceps'] : 
                     type === 'legs' ? ['quads', 'hamstrings', 'glutes'] :
                     type === 'hiit' ? ['all'] : ['all'],
      movement_patterns: []
    };

    // Generate workout using the existing function
    const workout = await generateWorkoutForType(workoutType, userId);

    // Structure the response with proper exercise counts
    const response = {
      warmup: workout.warmup.slice(0, counts.warmup),
      mainLift: workout.mainExercises[0] || { name: 'Bench Press', sets: 4, reps: '8-10' },
      accessories: workout.accessories.slice(0, counts.accessories),
      cooldown: workout.cooldown.slice(0, counts.cooldown)
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error generating workout:', error);
    
    // Fallback workout structure
    const fallbackWorkout = {
      warmup: [
        { name: 'High Knees', duration: '2 min' },
        { name: 'Treadmill Walking', duration: '3 min' }
      ],
      mainLift: { name: 'Bench Press', sets: 4, reps: '8-10' },
      accessories: [
        { name: 'Dips', sets: 3, reps: '12-15' },
        { name: 'Lateral Raises', sets: 3, reps: '15-20' }
      ],
      cooldown: [
        { name: 'Foam Roll Quads', duration: '2 min' },
        { name: 'Stretching', duration: '3 min' }
      ]
    };

    return NextResponse.json(fallbackWorkout);
  }
} 