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

    // Call our own chat planner so logic stays in one place (no-repeat, equipment gating, prefs, etc.)
    const chatUrl = new URL(`/api/chat-workout?user=${encodeURIComponent(userId)}&split=${encodeURIComponent(split)}&minutes=${minutes}`, origin);
    const res = await fetch(chatUrl.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: `${split} workout ${minutes} min` }),
      // Next automatically keeps internal cookies/RLS context if needed
    });

    if (!res.ok) {
      const t = await res.text();
      return NextResponse.json({ ok: false, error: `planner failed: ${res.status}`, details: t }, { status: 500 });
    }
    const j = await res.json();

    // Shape back to your old arrays
    const w = j?.workout || { warmup: [], main: [], cooldown: [] };
    const warmup = Array.isArray(w.warmup) ? w.warmup : [];
    const mainAll = Array.isArray(w.main) ? w.main : [];
    const cooldown = Array.isArray(w.cooldown) ? w.cooldown : [];

    const primaries   = mainAll.filter((i: any) => !i?.isAccessory);
    const accessories = mainAll.filter((i: any) =>  i?.isAccessory);

    return NextResponse.json({
      ok: true,
      name: `${String(type || "Workout").toUpperCase()} Workout`,
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