import { NextResponse } from 'next/server';
import { supabase as supabaseClient } from '@/lib/supabaseClient';
import { getUserContext } from '@/lib/workoutContext';
import { buildStrictPrompt } from '@/lib/workoutPrompt';
import { chatClaude } from '@/lib/claudeClient';
import { handleNikeWorkoutRequest } from '@/lib/nikeWorkoutHandler';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const message: string = body.message || '';
    const sessionId: string | null = body.sessionId || body.userId || null;
    const conversationHistory = body.conversationHistory || body.context || [];

    // Back-compat: allow missing sessionId (skip DB writes in that case)
    const shouldInsert = !!sessionId;
    const user = { id: (sessionId as string) || `anon_${Date.now()}` };
    const supabase = supabaseClient;

    const ctx = await getUserContext(user.id);

    // Nike workout
    if (message.toLowerCase().includes('nike workout')) {
      return handleNikeWorkoutRequest(user, ctx.profile);
    }

    const prompt = buildStrictPrompt({
      userMessage: message,
      profile: ctx.profile,
      availableEquipment: ctx.availableEquipment,
      exercisesByPhase: ctx.exercisesByPhase
    });

    const aiText = await chatClaude(prompt);
    const jsonText = aiText.trim().replace(/^```[a-zA-Z]*\n?/, '').replace(/```\s*$/, '');

    let workoutPlan: any;
    try {
      workoutPlan = JSON.parse(jsonText);
    } catch {
      return NextResponse.json({ error: 'Invalid AI response JSON' }, { status: 502 });
    }

    // Insert workout session (only if we have a user id)
    const today = new Date();
    const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
      .toISOString()
      .split('T')[0];

    let session: any | null = null;
    if (shouldInsert) {
      const insertRes = await supabase
        .from('workout_sessions')
        .insert({
          user_id: user.id,
          date: localDate,
          workout_source: 'chat',
          workout_name: workoutPlan.name,
          workout_type: ctx.profile.training_goal,
          planned_exercises: workoutPlan,
          actual_duration_minutes: workoutPlan.duration_minutes,
          chat_context: { message, conversationHistory }
        })
        .select()
        .single();
      if (insertRes.error) {
        // Non-fatal for back-compat: continue without session
        session = null;
      } else {
        session = insertRes.data;
      }
    }

    // Prepare workout sets
    const setRows: any[] = [];
    for (const phase of workoutPlan.phases || []) {
      for (const exercise of phase.exercises || []) {
        const exerciseData = ctx.allowedExercises.find((e: any) => e.id === exercise.exercise_id);
        for (const set of exercise.sets || []) {
          setRows.push({
            session_id: session.id,
            exercise_id: exercise.exercise_id,
            exercise_name: exercise.exercise_name,
            set_number: set.set_number,
            prescribed_weight: set.prescribed_weight ?? null,
            prescribed_load: set.prescribed_load || null,
            reps: typeof set.reps === 'number' ? set.reps : 0,
            rest_seconds: set.rest_seconds || exerciseData?.rest_seconds_default || 90
          });
        }
      }
    }

    if (shouldInsert && setRows.length) {
      await supabase.from('workout_sets').insert(setRows);

      const entryRows = setRows.map((set) => ({
        user_id: user.id,
        date: localDate,
        exercise_id: set.exercise_id,
        exercise_name: set.exercise_name,
        set_number: set.set_number,
        prescribed_weight: set.prescribed_weight,
        reps: set.reps,
        rest_seconds: set.rest_seconds,
        workout_source: 'chat'
      }));

      await supabase.from('workout_entries').insert(entryRows);
    }

    // Back-compat response for Chat Panel UI (expects phases.warmup/main/cooldown.exercises[].name)
    const sessionIdToReturn = session?.id || user.id;
    const byPhaseMap: Record<string, any[]> = {};
    for (const p of workoutPlan.phases || []) {
      byPhaseMap[p.phase] = (p.exercises || []).map((e: any) => ({ name: e.exercise_name }));
    }
    const legacyWorkout = {
      phases: {
        warmup: { exercises: byPhaseMap['warmup'] || [] },
        main: { exercises: byPhaseMap['main'] || [] },
        cooldown: { exercises: byPhaseMap['cooldown'] || [] }
      }
    };

    const formattedResponse = `Planned: ${workoutPlan.name} (about ${workoutPlan.duration_minutes} min)\n` +
      ['warmup', 'main', 'cooldown']
        .map((ph) => `- ${ph}: ${(legacyWorkout.phases as any)[ph].exercises.map((e: any) => e.name).join(', ')}`)
        .join('\n');

    return NextResponse.json({
      type: 'custom_workout',
      formattedResponse,
      sessionId: sessionIdToReturn,
      workout: legacyWorkout
    });
  } catch (error) {
    console.error('chat-workout error:', error);
    return NextResponse.json({ error: 'Failed to generate workout' }, { status: 500 });
  }
}


