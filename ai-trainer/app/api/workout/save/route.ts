import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/app/lib/db";
import type { SaveWorkoutRequest, SaveWorkoutResponse } from "@/app/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SaveWorkoutRequest;
    if (!body?.plan || !body?.startedAt || !body?.endedAt) {
      const res: SaveWorkoutResponse = { ok: false, error: "Missing required fields" };
      return new Response(JSON.stringify(res), { status: 400, headers: { "content-type": "application/json" } });
    }

    const started = new Date(body.startedAt).getTime();
    const ended = new Date(body.endedAt).getTime();
    const durationMin = Math.max(0, Math.round((ended - started) / 1000 / 60));

    const sb = supabaseAdmin();
    const insertPayload = {
      workout_name: body.plan.name,
      workout_type: guessFromName(body.plan.name),
      planned_exercises: body.plan as unknown as Record<string, unknown>,
      completed_exercises: { sets_completed: body.setsCompleted } as Record<string, unknown>,
      chat_context: { utterances: body.chat.utterances, timeline: body.timeline } as Record<string, unknown>,
      actual_duration_minutes: durationMin,
      user_id: body.userId ?? null,
      started_at: body.startedAt,
      finished_at: body.endedAt,
      workout_source: "ai_generated",
    };

    const { data, error } = await sb
      .from("workout_sessions")
      .insert(insertPayload)
      .select("id")
      .single();

    if (error) {
      const res: SaveWorkoutResponse = { ok: false, error: error.message };
      return new Response(JSON.stringify(res), { status: 500, headers: { "content-type": "application/json" } });
    }

    const res: SaveWorkoutResponse = { ok: true, sessionId: String((data as any)?.id) };
    return new Response(JSON.stringify(res), { headers: { "content-type": "application/json" } });
  } catch {
    const res: SaveWorkoutResponse = { ok: false, error: "Internal error" };
    return new Response(JSON.stringify(res), { status: 500, headers: { "content-type": "application/json" } });
  }
}

function guessFromName(n: string): string {
  const s = n.toLowerCase();
  if (s.includes("back")) return "back";
  if (s.includes("push")) return "push";
  if (s.includes("pull")) return "pull";
  if (s.includes("legs")) return "legs";
  if (s.includes("upper")) return "upper";
  if (s.includes("hiit")) return "hiit";
  return "custom";
}