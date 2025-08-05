import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function POST(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { timeAvailable, workoutType, focus } = await request.json();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user data and equipment
    const [profileResult, equipmentResult, exercisesResult] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', user.id).single(),
      supabase.from('user_equipment')
        .select('equipment:equipment_id(name)')
        .eq('user_id', user.id)
        .eq('is_available', true),
      supabase.from('exercises')
        .select('*')
        .contains('category', [workoutType.toLowerCase()])
        .limit(50)
    ]);

    const profile = profileResult.data;
    const equipment = equipmentResult.data?.map((eq: any) => eq.equipment.name) || [];
    const exercisePool = exercisesResult.data || [];

    // Build Claude prompt with database knowledge
    const prompt = `You are an elite fitness coach with access to a database of exercises. Create an optimized ${workoutType} workout.

User Profile:
- Current: ${profile.current_weight} lbs → Goal: ${profile.goal_weight} lbs
- Training Goal: ${profile.training_goal || 'weight_loss'}
- Fitness Level: ${profile.fitness_level || 'intermediate'}
- Available Equipment: ${equipment.join(', ')}
- Time Available: ${timeAvailable} minutes

Exercise Database Sample (${exercisePool.length} exercises available):
${exercisePool.slice(0, 10).map((ex: any) => `- ${ex.name}: ${ex.primary_muscle}, ${ex.equipment_required}`).join('\n')}

IMPORTANT: 
1. Select exercises that work synergistically for ${workoutType} training
2. Use ONLY equipment from the available list
3. For weight loss: moderate weight, 12-15 reps, shorter rest (45-60s)
4. Structure: 5-10 min warmup, main work, 5 min cooldown
5. If an exercise requires unavailable equipment, find the best substitute

Return this EXACT JSON structure:
{
  "workoutName": "Descriptive name based on focus",
  "description": "2-3 sentence overview of the workout",
  "estimatedDuration": ${timeAvailable},
  "targetMuscles": ["primary", "secondary"],
  "phases": {
    "warmup": [
      {
        "name": "Exercise Name",
        "duration": "30-60 seconds",
        "sets": "2",
        "reps": "10-12",
        "notes": "Focus on mobility"
      }
    ],
    "main": [
      {
        "name": "Exercise Name",
        "sets": "3-4",
        "reps": "12-15",
        "rest": "60",
        "weight": "moderate",
        "notes": "Key form cue"
      }
    ],
    "cooldown": [
      {
        "name": "Stretch Name",
        "duration": "30-60 seconds",
        "notes": "Breathing focus"
      }
    ]
  },
  "coachNotes": "Specific tips for this workout"
}`;

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      temperature: 0.7,
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.content[0];
    const workout = JSON.parse(content.type === 'text' ? content.text : '{}');

    // Save to workout_sessions
    const { data: session } = await supabase
      .from('workout_sessions')
      .insert({
        user_id: user.id,
        date: new Date().toISOString().split('T')[0],
        workout_source: 'ai_generated',
        workout_type: workoutType,
        workout_name: workout.workoutName,
        planned_exercises: workout,
        actual_duration_minutes: timeAvailable
      })
      .select()
      .single();

    // Format for frontend
    return NextResponse.json({
      sessionId: session.id,
      planId: session.id,
      warmup: workout.phases.warmup.map((ex: any) => ex.name),
      workout: workout.phases.main.map((ex: any) => ex.name),
      cooldown: workout.phases.cooldown.map((ex: any) => ex.name),
      details: workout,
      prompt: `AI-optimized ${workoutType} workout for weight loss`
    });

  } catch (error) {
    console.error('Workout generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate workout' },
      { status: 500 }
    );
  }
} 