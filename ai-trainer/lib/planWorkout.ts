// lib/planWorkout.ts
export type LegacyItem = {
  name: string;
  sets?: string;
  reps?: string;
  duration?: string;
  instruction?: string;
  isAccessory?: boolean;
};

export type LegacyWorkout = {
  warmup: LegacyItem[];
  main: LegacyItem[];
  cooldown: LegacyItem[];
};

type Split = "push" | "pull" | "legs" | "upper" | "full" | "hiit";
type Style = "strength" | "balanced" | "hiit";

export async function planWorkout(opts: {
  userId: string;
  split: Split;
  minutes: number;
  style?: Style;        // non-HIIT splits
  message?: string;     // optional free text
  debug?: "none" | "deep";
}): Promise<{ workout: LegacyWorkout; plan: any; coach: string; debug: any }> {
  const { userId, split, minutes, message, debug } = opts;
  const style = split === "hiit" ? "hiit" : (opts.style ?? "strength");

  const params = new URLSearchParams({
    user: userId,
    split,
    min: String(minutes),
    style,
  });
  if (debug === "deep") params.set("debug", "deep");

  const res = await fetch(`/api/chat-workout?${params.toString()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: message || `${split} workout ${minutes} min use my equipment` }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `chat-workout failed (${res.status})`);
  }

  const json = await res.json();
  // Defensive: ensure legacy shape exists
  const workout: LegacyWorkout = json?.workout ?? { warmup: [], main: [], cooldown: [] };
  return { workout, plan: json?.plan, coach: json?.message, debug: json?.debug };
}
