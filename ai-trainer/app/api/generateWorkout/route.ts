import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildClaudePrompt } from "@/lib/claudeWorkoutPrompt";
import { chatClaude } from "@/lib/claudeClient";
import { coreByDay, muscleMap, dayStringMap } from "@/lib/coreMap";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const mins = Number(req.nextUrl.searchParams.get("durationMin") ?? "45");
  const debugDay = req.nextUrl.searchParams.get("debugDay");
  
  // Handle both numeric and string day parameters
  let weekday: number;
  if (debugDay) {
    const dayLower = debugDay.toLowerCase();
    if (dayStringMap[dayLower]) {
      weekday = dayStringMap[dayLower];
    } else {
      const numericDay = Number(debugDay);
      if (isNaN(numericDay) || numericDay < 0 || numericDay > 6) {
        return NextResponse.json({ 
          error: "Invalid day parameter. Use 0-6 or day names like 'monday', 'mon', etc." 
        }, { status: 400 });
      }
      weekday = numericDay;
    }
  } else {
    weekday = new Date().getDay();
  }

  /* 1️⃣ determine core lift */
  const coreLift = coreByDay[weekday];
  if (!coreLift) return NextResponse.json({ error: "No plan for that day" }, { status: 400 });

  /* Handle rest/cardio/hiit days */
  if (coreLift === "Rest") return NextResponse.json({ rest: true });
  if (["Cardio", "HIIT"].includes(coreLift)) {
    return NextResponse.json({
      focus: coreLift.toLowerCase(),
      duration: mins,
      warmup: [
        { name: "Light Cardio", duration: "2 min" },
        { name: "Dynamic Stretches", duration: "2 min" },
        { name: "Movement Prep", duration: "1 min" }
      ],
      main: [
        {
          name: coreLift === "HIIT" ? "Burpees / Jump Circuit" : "Moderate Cardio",
          sets: coreLift === "HIIT" ? 6 : 1,
          reps: coreLift === "HIIT" ? "40 sec on / 20 sec off" : `${mins - 7} min`,
          duration: "–"
        }
      ],
      accessories: [],
      cooldown: [
        { name: "Light Stretching", duration: "2 min" },
        { name: "Deep Breathing", duration: "1 min" },
        { name: "Cool Down Walk", duration: "1 min" }
      ]
    });
  }

  /* 2️⃣ pull user equipment */
  const { data: eqRows } = await supabase
    .from("user_equipment")
    .select("equipment!inner(name)")
    .eq("user_id", userId);
  const equipment = (eqRows ?? []).map((r: any) => r.equipment.name);

  /* 3️⃣ build Claude prompt & call */
  const prompt = buildClaudePrompt({
    day: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][weekday],
    coreLift,
    muscleTargets: muscleMap[coreLift] || [],
    duration: mins,
    equipment
  });

  try {
    const rawJson = await chatClaude(prompt);

    /* 4️⃣ parse + basic sanity check */
    let plan;
    try { 
      plan = JSON.parse(rawJson); 
    } catch (error) {
      console.error('Claude JSON parse error:', error);
      console.error('Raw response:', rawJson);
      return NextResponse.json({ error: "Claude JSON invalid" }, { status: 502 });
    }

    if (!plan?.main?.[0]?.name) {
      console.error('No core lift in Claude response:', plan);
      return NextResponse.json({ error: "No core lift" }, { status: 502 });
    }

    /* 5️⃣ add duration and focus */
    plan.duration = mins;
    plan.focus = muscleMap[coreLift]?.[0] || "strength";

    return NextResponse.json(plan);

  } catch (error) {
    console.error('Claude API error:', error);
    return NextResponse.json({ error: "Claude API error" }, { status: 502 });
  }
} 