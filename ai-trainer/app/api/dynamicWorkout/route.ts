import { NextRequest, NextResponse } from 'next/server';
import { DynamicWorkoutGenerator } from '@/lib/dynamicWorkoutGenerator';

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  try {
    const generator = new DynamicWorkoutGenerator();
    const workout = await generator.generateWorkout(userId);
    
    return NextResponse.json(workout);
  } catch (error) {
    console.error('Dynamic workout generation error:', error);
    return NextResponse.json({ error: "Failed to generate workout" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  try {
    const { workoutData } = await req.json();
    const generator = new DynamicWorkoutGenerator();
    
    const result = await generator.completeWorkout(userId, workoutData);
    
    return NextResponse.json({ 
      success: true, 
      suggestion: result?.suggestion || null,
      pattern: result?.pattern || null
    });
  } catch (error) {
    console.error('Workout completion error:', error);
    return NextResponse.json({ error: "Failed to complete workout" }, { status: 500 });
  }
} 