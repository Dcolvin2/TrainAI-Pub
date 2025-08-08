import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  try {
    // Test 1: Check push exercises
    const { data: pushExercises } = await supabase
      .from('exercises')
      .select('name, primary_muscle, exercise_phase')
      .in('primary_muscle', ['chest', 'shoulders', 'triceps'])
      .limit(50);
    
    // Test 2: Check warmup exercises
    const { data: warmups } = await supabase
      .from('exercises')
      .select('name, exercise_phase')
      .eq('exercise_phase', 'warmup')
      .limit(20);
    
    // Test 3: Check for duplicates
    const { data: allExercises } = await supabase
      .from('exercises')
      .select('name');
    
    const nameCounts: Record<string, number> = {};
    allExercises?.forEach(ex => {
      nameCounts[ex.name] = (nameCounts[ex.name] || 0) + 1;
    });
    
    const duplicates = Object.entries(nameCounts)
      .filter(([_, count]) => count > 1)
      .map(([name, count]) => ({ name, count }));
    
    // Test 4: Random number generation
    const randomTests = [];
    for (let i = 0; i < 10; i++) {
      randomTests.push(Math.random());
    }
    
    // Test 5: Check main lifts
    const { data: mainLifts } = await supabase
      .from('exercises')
      .select('name, primary_muscle')
      .in('name', [
        'Barbell Bench Press',
        'Barbell Incline Press', 
        'Dumbbell Bench Press',
        'Barbell Overhead Press',
        'Dumbbell Shoulder Press'
      ]);
    
    return NextResponse.json({
      pushExerciseCount: pushExercises?.length,
      warmupCount: warmups?.length,
      duplicates,
      randomTests,
      samplePushExercises: pushExercises?.slice(0, 10),
      sampleWarmups: warmups?.slice(0, 5),
      mainLifts,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Debug API error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch debug data',
      details: error 
    }, { status: 500 });
  }
} 