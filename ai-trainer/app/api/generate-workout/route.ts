// app/api/generate-workout/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { type, timeMinutes, userId } = await req.json();
    const url = new URL(req.url);
    const origin = url.origin;
    const split = String(type || "").toLowerCase();     // 'push'|'pull'|'legs'|'upper'|'full'|'hiit'
    const minutes = Number(timeMinutes) || 45;

    // Call the unified planner (/api/chat). We pass split/minutes so the server can:
    // - pick main lift deterministically
    // - LLM-fill warmup/accessory
    // - build cooldown with DB+LLM (varied & user-scoped)
    const chatUrl = new URL(`/api/chat`, origin);
    const res = await fetch(chatUrl.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // x-user-id lets the route scope recent cooldowns to this user
      // (RLS cookies will still flow automatically if present)
      // @ts-ignore — RequestInit supports headers object
      next: { revalidate: 0 },
      body: JSON.stringify({
        userId,
        split,
        minutes,
        messages: [{ role: "user", content: `${split} workout ${minutes} min` }]
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      return NextResponse.json({ ok: false, error: `planner failed: ${res.status}`, details: t }, { status: 500 });
    }
    const j = await res.json();
    const title = j?.name || j?.plan?.name || `${String(type || "Workout").toUpperCase()} Workout`;

    const w = j?.workout || { warmup: [], main: [], cooldown: [] };
    const warmup = Array.isArray(w.warmup) ? w.warmup : [];
    const mainAll = Array.isArray(w.main) ? w.main : (Array.isArray(w.mainExercises) ? w.mainExercises : []);
    // Prefer explicit workout.cooldown; if absent, read from plan.phases["cooldown"]
    const cooldown = 
      Array.isArray(w.cooldown) && w.cooldown.length
        ? w.cooldown
        : (Array.isArray(j?.plan?.phases)
            ? (j.plan.phases.find((p: any) => String(p?.phase || "").toLowerCase() === "cooldown")?.items || [])
            : []);

    const primaries   = mainAll.filter((i: any) => !i?.isAccessory);
    const accessories = mainAll.filter((i: any) =>  i?.isAccessory);

    return NextResponse.json({
      ok: true,
      name: title,
      warmup,
      main: primaries,
      accessories,
      cooldown,
      duration: minutes,
      focus: split
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "failed" }, { status: 500 });
  }
} 