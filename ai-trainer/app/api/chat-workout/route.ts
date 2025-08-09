// app/api/chat-workout/route.ts
import { NextResponse } from 'next/server';
import { buildStrictWorkoutPrompt } from '@/lib/workoutPrompt';
import { getUserContext } from '@/lib/workoutContext';
import { claude } from '@/lib/claudeClient';
import { createClient } from '@supabase/supabase-js';

// IMPORTANT: your column name is literally "workout source"
const ENTRIES_TABLE = 'workout_entries';
const WORKOUT_SOURCE_COL = 'workout source';

type PlanItemSet = {
  set_number: number;
  reps: number | string;
  prescribed_weight: number | string | null;
  rest_seconds: number;
};
type PlanItem = {
  exercise_id: string;
  display_name: string;
  sets: PlanItemSet[];
  notes?: string | null;
};
type PlanPhase = {
  phase: 'warmup' | 'main' | 'conditioning' | 'cooldown';
  items: PlanItem[];
};
type StrictPlan = {
  name: string;
  duration_min: number;
  phases: PlanPhase[];
  est_total_minutes: number;
};

export async function POST(req: Request) {
  // Use the same pattern as other routes in this repo
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const body = await req.json().catch(() => ({} as any));
  const message: string = body?.message ?? '';
  const fallbackUserId: string | undefined = body?.userId;

  let {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user && fallbackUserId) {
    // Fallback to provided userId when auth context isn't available in the route
    user = { id: fallbackUserId } as any;
  }
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 1) Build user context
  const { profile, availableEquipment, allowedExercises } = await getUserContext(user.id);

  // 2) Call model with strict prompt
  const prompt = buildStrictWorkoutPrompt({
    userMessage: message,
    profile,
    availableEquipment,
    allowedExercises
  });

  const ai = await claude.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 2000,
    temperature: 0.4,
    messages: [{ role: 'user', content: prompt }]
  });

  const raw = (ai as any)?.content?.[0]?.text ?? '';
  let plan: StrictPlan | null = null;
  try {
    plan = JSON.parse(raw) as StrictPlan;
  } catch {
    // keep chat UX intact even if JSON parsing fails
    return NextResponse.json({ response: raw, error: 'Model did not return JSON' }, { status: 200 });
  }

  // 3) Optional insert: one row per set -> public.workout_entries
  //    We do a safe "try insert; fall back if table/column not present".
  let entriesInserted = 0;

  if (plan?.phases?.length) {
    const now = new Date();
    const rows: Record<string, unknown>[] = [];

    for (const ph of plan.phases) {
      for (const it of ph.items) {
        for (const s of it.sets) {
          rows.push({
            user_id: user.id,
            date: now.toISOString().slice(0, 10),
            started_at: now.toISOString(),
            finished_at: null,
            total_volume: 0,
            program_day_id: null,
            // optimistic include of the spaced column:
            [WORKOUT_SOURCE_COL]: 'ai_generated',

            exercise_id: it.exercise_id,
            exercise_name: it.display_name,
            set_number: typeof s.set_number === 'number' ? s.set_number : Number(s.set_number) || 1,
            previous_weight: null,
            prescribed_weight: typeof s.prescribed_weight === 'number' ? s.prescribed_weight : null,
            actual_weight: null,
            reps: typeof s.reps === 'number' ? s.reps : null,
            rest_seconds: typeof s.rest_seconds === 'number' ? s.rest_seconds : 120,
            rpe: 7,
            session_id_old: null,
            set_id_old: null
          });
        }
      }
    }

    if (rows.length) {
      // attempt with "workout source"
      let ins = await supabase.from(ENTRIES_TABLE).insert(rows);
      if (ins.error) {
        // retry WITHOUT the spaced column if the first insert failed due to missing column/table
        const sanitized = rows.map((r) => {
          const { [WORKOUT_SOURCE_COL]: _drop, ...rest } = r as any;
          return rest;
        });
        ins = await supabase.from(ENTRIES_TABLE).insert(sanitized);
      }
      if (!ins.error) entriesInserted = rows.length;
    }
  }

  // 4) Return raw text (so your existing chat UI shows the reply) + parsed plan for any future UI enhancements
  return NextResponse.json({
    response: raw,
    plan,
    entriesInserted
  });
}


