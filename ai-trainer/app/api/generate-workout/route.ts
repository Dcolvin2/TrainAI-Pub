// app/api/generate-workout/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { type, timeMinutes, userId } = await req.json();
    const url = new URL(req.url);
    const origin = url.origin;

    const split = String(type || "").toLowerCase();   // 'push'|'pull'|'legs'|'upper'|'full'|'hiit'
    const minutes = Number(timeMinutes) || 45;

    // ✅ Always use /api/chat so cooldown builder + policies run
    const chatUrl = new URL(`/api/chat`, origin);
    const res = await fetch(chatUrl.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        split,
        minutes,
        messages: [{ role: "user", content: `${split} workout ${minutes} min` }],
        debug: true
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      return NextResponse.json({ ok: false, error: `planner failed: ${res.status}`, details: t }, { status: 500 });
    }

    const j = await res.json();
    const title = j?.name || j?.plan?.name || `${String(type || "Workout").toUpperCase()} Workout`;

    const w = j?.workout || {};
    const warmup = Array.isArray(w.warmup) ? w.warmup : [];

    // Your UI expects `main` split into primaries/accessories — accept both shapes
    const mainAll = Array.isArray(w.main)
      ? w.main
      : (Array.isArray(w.mainExercises) ? w.mainExercises : []);

    // ✅ Bridge cooldown: prefer workout.cooldown; else pull from plan.phases['cooldown']
    const cooldown = Array.isArray(w.cooldown) && w.cooldown.length
      ? w.cooldown
      : (
          Array.isArray(j?.plan?.phases)
            ? (j.plan.phases.find((p: any) => String(p?.phase || "").toLowerCase() === "cooldown")?.items || [])
            : []
        );

    const primaries   = mainAll.filter((i: any) => !i?.isAccessory);
    const accessories = mainAll.filter((i: any) =>  i?.isAccessory);

    return NextResponse.json({
      ok: true,
      name: title,
      warmup,
      main: primaries,
      accessories,
      cooldown,           // ← now populated even if the LLM put it in plan.phases
      duration: j?.plan?.duration || minutes,
      focus: split,
      debug: j?.debug || undefined
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "failed" }, { status: 500 });
  }
} 