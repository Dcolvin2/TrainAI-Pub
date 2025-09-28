import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { VoiceCoachRequest, VoiceCoachResponse, WorkoutPlan, PlanItem, PlanPhase } from "@/lib/types";
import { REST_BY_PHASE, filterBlacklisted, hasEquip, bodyAwareCooldown, computeCounts, trimPlanToDuration } from "@/lib/workout-helpers";

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

    // ---------- intent parsing (more robust; supports "instead of X" / "not X") ----------
    const footSafe = /\b(foot|ankle|plantar)\b/.test(msgLower);
    const saidNotBack = /\b(instead of|not)\s+back\b/.test(msgLower);
    const saidNotLegs = /\b(instead of|not)\s+(legs|leg)\b/.test(msgLower);
    const saidNotChest = /\b(instead of|not)\s+(chest|push)\b/.test(msgLower);
    const mentionsBack = /\b(back|pull|lat|posterior)\b/.test(msgLower);
    const mentionsChest = /\b(chest|push|pec|bench)\b/.test(msgLower);
    const mentionsLegs = /\b(legs|quads|hams|glute|squat)\b/.test(msgLower);
    const cableOnly = /\b(cable|functional trainer)\b/.test(msgLower) || hasEquip(equipment, "cable");
    const useFunctional = hasEquip(equipment, "functional") || /\bfunctional\b/.test(msgLower);

    // primary target
    let target: "pull" | "push" | "legs" | "upper" | "custom" = "custom";
    if (mentionsChest && !saidNotChest) target = "push";
    if (mentionsLegs && !saidNotLegs) target = "legs";
    if (mentionsBack && !saidNotBack) target = "pull";
    // prefer explicit chest/legs over back if both appear
    if (mentionsChest && !saidNotChest) target = "push";
    if (mentionsLegs && !saidNotLegs) target = "legs";

    const warmup: PlanItem[] = [
      { name: "Straight-Arm Lat Pulldown (Cable)", sets: 2, reps: "12–15", restSeconds: REST_BY_PHASE.warmup },
      { name: "Face Pulls (Cable, Rope)", sets: 2, reps: "12–15", restSeconds: REST_BY_PHASE.warmup },
    ];

    let strength: PlanItem[] = [];
    let accessory: PlanItem[] = [];
    let finisher: PlanItem[] = [];
    let cooldown: PlanItem[] = [];

    if (target === "push") {
      strength = filterBlacklisted([
        cableOnly
          ? { name: "Cable Chest Press", sets: 4, reps: "8–12", restSeconds: REST_BY_PHASE.strength }
          : { name: "Barbell Bench Press", sets: 4, reps: "5–8", restSeconds: REST_BY_PHASE.strength },
      ]);
      accessory = filterBlacklisted([
        cableOnly ? { name: "Cable Fly", sets: 3, reps: "12–15", restSeconds: REST_BY_PHASE.accessory, isAccessory: true }
                  : { name: "Incline DB Press", sets: 3, reps: "8–12", restSeconds: REST_BY_PHASE.accessory, isAccessory: true },
        { name: "Lateral Raise", sets: 3, reps: "12–15", restSeconds: REST_BY_PHASE.accessory, isAccessory: true },
        { name: "Cable Triceps Pressdown", sets: 3, reps: "10–12", restSeconds: REST_BY_PHASE.accessory, isAccessory: true },
      ]);
      finisher = [{ name: "Push-Up Mechanical Drop Set", sets: 2, reps: "AMRAP", restSeconds: REST_BY_PHASE.finisher, isAccessory: true }];
      cooldown = bodyAwareCooldown("push chest shoulder");

    } else if (target === "legs") {
      strength = filterBlacklisted([
        footSafe ? { name: "Leg Press", sets: 4, reps: "8–12", restSeconds: REST_BY_PHASE.strength }
                 : { name: "Back Squat", sets: 4, reps: "5–8", restSeconds: REST_BY_PHASE.strength },
      ]);
      accessory = filterBlacklisted([
        { name: "Romanian Deadlift (DB/BB)", sets: 3, reps: "8–12", restSeconds: REST_BY_PHASE.accessory, isAccessory: true },
        { name: "Leg Curl (Machine/Cable)", sets: 3, reps: "10–12", restSeconds: REST_BY_PHASE.accessory, isAccessory: true },
        { name: "Split Squat (DB)", sets: 2, reps: "8–10/side", restSeconds: REST_BY_PHASE.accessory, isAccessory: true },
      ]);
      finisher = [{ name: "Bike Sprint", sets: 4, reps: "15s on / 45s off", restSeconds: REST_BY_PHASE.finisher, isAccessory: true }];
      cooldown = bodyAwareCooldown("legs squat");

    } else {
      // default to pull/back when requested or no explicit match
      strength = filterBlacklisted(
        cableOnly || useFunctional || footSafe || target === "pull"
          ? [{ name: "Lat Pulldown (Neutral/Supinated)", sets: 4, reps: "8–12", restSeconds: REST_BY_PHASE.strength }]
          : [{ name: "Barbell Row", sets: 4, reps: "6–8", restSeconds: REST_BY_PHASE.strength }],
      );
      accessory = filterBlacklisted([
        ...(cableOnly || useFunctional
          ? [{ name: "Seated Cable Row (Neutral/Wide)", sets: 3, reps: "10–12", restSeconds: REST_BY_PHASE.accessory, isAccessory: true }]
          : [{ name: "Chest-Supported DB Row", sets: 3, reps: "10–12", restSeconds: REST_BY_PHASE.accessory, isAccessory: true }]),
        ...(footSafe ? [{ name: "Reverse Hypers", sets: 3, reps: "15–20", restSeconds: REST_BY_PHASE.accessory, isAccessory: true }] : []),
        { name: (cableOnly || useFunctional) ? "Rear Delt Cable Fly" : "Rear Delt DB Fly", sets: 3, reps: "12–15", restSeconds: REST_BY_PHASE.accessory, isAccessory: true },
      ]);
      finisher = [{ name: "Band Pull-Aparts", sets: 2, reps: "20", restSeconds: REST_BY_PHASE.finisher, isAccessory: true }];
      cooldown = bodyAwareCooldown("back pull lat");
    }

    const phases: Array<{ phase: PlanPhase; items: PlanItem[] }> = [
      { phase: "warmup", items: warmup },
      { phase: "strength", items: strength },
      { phase: "accessory", items: accessory },
      { phase: "finisher", items: finisher },
      { phase: "cooldown", items: cooldown },
    ];

    const counts = computeCounts(phases);
    const label =
      target === "push" ? (cableOnly ? "Cable Chest/Push Day (~45m)" : "Push Day (~45m)") :
      target === "legs" ? "Leg Day (~45m)" :
      cableOnly ? "Cable Back Day (~45m)" :
      "Back Day (~45m)";

    let plan: WorkoutPlan = {
      name: label,
      durationMinutes: duration,
      exercisesCount: counts.exercisesCount,
      totalSets: counts.totalSets,
      phases,
      coach: "Move clean; leave 1–2 reps in reserve on main sets.",
      summaryMarkdown:
        "Fitness Coach said:\n\n" +
        (target === "push"
          ? "Chest/shoulder/triceps emphasis with joint-friendly loads.\n\n"
          : target === "legs"
          ? "Strong lower-body focus with balanced quad–hamstring work.\n\n"
          : cableOnly
          ? "Cable-focused back session—minimal ground loading, big lat/upper-back stimulus.\n\n"
          : "Let's hit a strong back session with controlled pulls and rear-delt focus.\n\n") +
        "Warm-up\n" +
        "• Straight-Arm Lat Pulldown — 2 × 12–15\n" +
        "• Face Pulls — 2 × 12–15\n\n" +
        "Strength\n" +
        `• ${strength[0].name} — ${strength[0].sets} × ${strength[0].reps}\n\n` +
        "Accessories\n" +
        accessory.map(a => `• ${a.name} — ${a.sets} × ${a.reps}`).join("\n") +
        "\n\nFinisher\n" +
        `${finisher[0].name} — ${finisher[0].sets} × ${finisher[0].reps}\n\n` +
        "Cooldown\n" +
        (target === "push"
          ? "• Doorway Pec Stretch · Sleeper Stretch\n"
          : target === "legs"
          ? "• Hip Flexor Stretch · Seated Hamstring Stretch\n"
          : "• Lat-focused Child's Pose · Cat-Cow (light)\n"),
    };

    if (duration < plan.durationMinutes) plan = trimPlanToDuration(plan, duration);

    const res: VoiceCoachResponse = { ok: true, plan };
    return new Response(JSON.stringify(res), { headers: { "content-type": "application/json" } });
  } catch {
    const res: VoiceCoachResponse = { ok: false, error: "Internal error" };
    return new Response(JSON.stringify(res), { status: 500, headers: { "content-type": "application/json" } });
  }
}