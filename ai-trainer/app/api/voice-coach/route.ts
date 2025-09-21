import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/app/lib/db";
import type { VoiceCoachRequest, VoiceCoachResponse, WorkoutPlan, PlanItem, PlanPhase } from "@/app/lib/types";
import { REST_BY_PHASE, filterBlacklisted, hasEquip, bodyAwareCooldown, computeCounts, trimPlanToDuration } from "@/app/lib/workout-helpers";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<VoiceCoachRequest> | null;
    const message = String(body?.message ?? "").trim();
    if (!message) {
      const res: VoiceCoachResponse = { ok: false, error: "Missing message" };
      return new Response(JSON.stringify(res), { status: 400, headers: { "content-type": "application/json" } });
    }

    const userId = body?.userId ?? null;
    const duration = typeof body?.durationMinutes === "number" && body.durationMinutes > 0 ? Math.round(body.durationMinutes) : 45;
    const msgLower = message.toLowerCase();

    // Pull equipment from DB if userId present
    let equipment: string[] = ["Functional Trainer", "Bands", "Lat Pulldown", "Seated Row"];
    if (userId) {
      const sb = supabaseAdmin();
      const { data: ueRows } = await sb.from("user_equipment").select("custom_name").eq("user_id", userId);
      if (Array.isArray(ueRows) && ueRows.length) equipment = ueRows.map(r => String((r as any).custom_name)).filter(Boolean);
    }

    // very light intent parsing
    const footSafe = /\b(foot|ankle|plantar)\b/.test(msgLower);
    const isBack = /\b(back|pull|lat|posterior)\b/.test(msgLower);
    const cableOnly = /\b(cable|functional trainer)\b/.test(msgLower) || hasEquip(equipment, "cable");
    const useFunctional = hasEquip(equipment, "functional") || /\bfunctional\b/.test(msgLower);

    const warmup: PlanItem[] = [
      { name: "Straight-Arm Lat Pulldown (Cable)", sets: 2, reps: "12–15", restSeconds: REST_BY_PHASE.warmup },
      { name: "Face Pulls (Cable, Rope)", sets: 2, reps: "12–15", restSeconds: REST_BY_PHASE.warmup },
    ];

    const strength: PlanItem[] = filterBlacklisted(
      cableOnly || useFunctional || footSafe || isBack
        ? [{ name: "Lat Pulldown (Neutral/Supinated)", sets: 4, reps: "8–12", restSeconds: REST_BY_PHASE.strength }]
        : [{ name: "Barbell Row", sets: 4, reps: "6–8", restSeconds: REST_BY_PHASE.strength }],
    );

    const accessory: PlanItem[] = filterBlacklisted([
      ...(cableOnly || useFunctional
        ? [{ name: "Seated Cable Row (Neutral/Wide)", sets: 3, reps: "10–12", restSeconds: REST_BY_PHASE.accessory, isAccessory: true }]
        : [{ name: "Chest-Supported DB Row", sets: 3, reps: "10–12", restSeconds: REST_BY_PHASE.accessory, isAccessory: true }]),
      ...(footSafe ? [{ name: "Reverse Hypers", sets: 3, reps: "15–20", restSeconds: REST_BY_PHASE.accessory, isAccessory: true }] : []),
      { name: (cableOnly || useFunctional) ? "Rear Delt Cable Fly" : "Rear Delt DB Fly", sets: 3, reps: "12–15", restSeconds: REST_BY_PHASE.accessory, isAccessory: true },
    ]);

    const finisher: PlanItem[] = [{ name: "Band Pull-Aparts", sets: 2, reps: "20", restSeconds: REST_BY_PHASE.finisher, isAccessory: true }];
    const cooldown = bodyAwareCooldown(msgLower);

    const phases: Array<{ phase: PlanPhase; items: PlanItem[] }> = [
      { phase: "warmup", items: warmup },
      { phase: "strength", items: strength },
      { phase: "accessory", items: accessory },
      { phase: "finisher", items: finisher },
      { phase: "cooldown", items: cooldown },
    ];

    const counts = computeCounts(phases);
    const label =
      cableOnly ? "Cable Back Day (~45m)" :
      isBack ? (footSafe ? "Back Day (Foot-Safe) (~45m)" : "Back Day (~45m)") :
      "Session (~45m)";

    let plan: WorkoutPlan = {
      name: label,
      durationMinutes: duration,
      exercisesCount: counts.exercisesCount,
      totalSets: counts.totalSets,
      phases,
      coach: "Move clean; leave 1–2 reps in reserve on main sets.",
      summaryMarkdown:
        "Fitness Coach said:\n\n" +
        (cableOnly
          ? "Cable-focused back session—minimal ground loading, big lat and upper-back stimulus.\n\n"
          : isBack
          ? "Let's hit a strong back session with controlled pulls and rear-delt focus.\n\n"
          : "Here's a solid session balancing warm-up, strength, accessories, and a short finisher.\n\n") +
        "Warm-up\n" +
        "• Straight-Arm Lat Pulldown — 2 × 12–15\n" +
        "• Face Pulls — 2 × 12–15\n\n" +
        "Strength\n" +
        `• ${strength[0].name} — 4 × 8–12\n\n` +
        "Accessories\n" +
        accessory.map(a => `• ${a.name} — ${a.sets} × ${a.reps}`).join("\n") +
        "\n\nFinisher\n" +
        "• Band Pull-Apart — 2 × 20\n\n" +
        "Cooldown\n" +
        "• Lat-focused Child's Pose · Cat-Cow (light)\n",
    };

    if (duration < plan.durationMinutes) plan = trimPlanToDuration(plan, duration);

    const res: VoiceCoachResponse = { ok: true, plan };
    return new Response(JSON.stringify(res), { headers: { "content-type": "application/json" } });
  } catch {
    const res: VoiceCoachResponse = { ok: false, error: "Internal error" };
    return new Response(JSON.stringify(res), { status: 500, headers: { "content-type": "application/json" } });
  }
}