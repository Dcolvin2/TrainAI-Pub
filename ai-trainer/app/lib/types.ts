export type PlanPhase = "warmup" | "strength" | "accessory" | "finisher" | "cooldown";

export type PlanItem = {
  name: string;
  sets?: number;
  reps?: string;
  weightHint?: string;
  restSeconds?: number;
  isAccessory?: boolean;
};

export type WorkoutPlan = {
  name: string;
  durationMinutes: number;
  exercisesCount: number;
  totalSets: number;
  phases: Array<{ phase: PlanPhase; items: PlanItem[] }>;
  coach: string; // short one-liner for TTS
  summaryMarkdown: string; // human recap ("Fitness Coach said: …")
};

export type VoiceCoachRequest = {
  message: string;
  userId?: string | null;
  durationMinutes?: number | null;
};

export type VoiceCoachResponse =
  | { ok: true; plan: WorkoutPlan }
  | { ok: false; error: string };

export type ChatUtterance = { from: "user" | "coach"; text: string; at: number };

export type TimelineEvent = {
  t: number;
  type: "start" | "done" | "skip" | "pause" | "resume" | "restStart" | "restEnd";
  detail?: string;
};

export type SaveWorkoutRequest = {
  userId?: string | null;
  plan: WorkoutPlan;
  chat: { utterances: ChatUtterance[] };
  timeline: TimelineEvent[];
  startedAt: string;
  endedAt: string;
  setsCompleted: number;
};

export type SaveWorkoutResponse =
  | { ok: true; sessionId: string }
  | { ok: false; error: string };