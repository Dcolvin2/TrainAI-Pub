import { NextRequest, NextResponse } from 'next/server';

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  // Legacy endpoint → proxy to /api/chat so cooldown builder is consistent everywhere
  const userId = req.headers.get("x-user-id") || "";
  const url = new URL(req.url);
  const minutes = Number(url.searchParams.get("durationMin") || "45") || 45;
  const split = String(url.searchParams.get("type") || url.searchParams.get("split") || "full").toLowerCase();
  const origin = url.origin;
  const chatUrl = new URL(`/api/chat`, origin);
  const res = await fetch(chatUrl.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      split,
      minutes,
      messages: [{ role: "user", content: `${split} workout ${minutes} min` }]
    })
  });
  if (!res.ok) {
    const t = await res.text();
    return NextResponse.json({ ok: false, error: `planner failed: ${res.status}`, details: t }, { status: 500 });
  }
  const j = await res.json();
  const w = j?.workout || {};
  const warmup = Array.isArray(w.warmup) ? w.warmup : [];
  const mainAll = Array.isArray(w.main) ? w.main : (Array.isArray(w.mainExercises) ? w.mainExercises : []);
  const cooldown =
    Array.isArray(w.cooldown) && w.cooldown.length
      ? w.cooldown
      : (Array.isArray(j?.plan?.phases)
          ? (j.plan.phases.find((p: any) => String(p?.phase || "").toLowerCase() === "cooldown")?.items || [])
          : []);
  return NextResponse.json({
    ok: true,
    name: j?.name || j?.plan?.name || "Workout",
    warmup,
    main: mainAll.filter((i: any) => !i?.isAccessory),
    accessories: mainAll.filter((i: any) => i?.isAccessory),
    cooldown,
    duration: j?.plan?.duration || minutes,
    focus: split
  });
} 