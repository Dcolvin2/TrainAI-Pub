"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSpeechRecognition, speak } from "@/app/components/useSpeech";
import type { WorkoutPlan, PlanItem, ChatUtterance, TimelineEvent, SaveWorkoutRequest } from "@/app/lib/types";

type StepPointer = { phaseIndex: number; itemIndex: number; setIndex: number };
type SetEntry = { set: number; reps: number; weight: number };

function useVoices() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const loadVoices = () => {
      setVoices(window.speechSynthesis.getVoices());
    };
    
    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
    };
  }, []);
  
  return voices;
}

export default function WorkoutVoiceCoach({ userId }: { userId?: string | null }) {
  const { listening, transcript, start, stop, continuous, setContinuous } = useSpeechRecognition();
  const voices = useVoices();
  const [voiceName, setVoiceName] = useState<string | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    return localStorage.getItem("ttsVoiceName") || undefined;
  });
  const [rate, setRate] = useState<number>(() => {
    if (typeof window === "undefined") return 1;
    const v = Number(localStorage.getItem("ttsRate"));
    return Number.isFinite(v) && v > 0 ? v : 1;
  });
  const [pitch, setPitch] = useState<number>(() => {
    if (typeof window === "undefined") return 1;
    const v = Number(localStorage.getItem("ttsPitch"));
    return Number.isFinite(v) && v > 0 ? v : 1;
  });
  const [input, setInput] = useState("");
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [pointer, setPointer] = useState<StepPointer | null>(null);
  const [restSeconds, setRestSeconds] = useState<number>(0);
  const [utterances, setUtterances] = useState<ChatUtterance[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [started, setStarted] = useState(false);
  const [saving, setSaving] = useState(false);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const lastTranscript = useRef("");

  // per-exercise set entries keyed by "phaseIndex:itemIndex"
  const [setBook, setSetBook] = useState<Record<string, SetEntry[]>>({});

  const currentItem: PlanItem | null = useMemo(() => {
    if (!plan || !pointer) return null;
    const p = plan.phases[pointer.phaseIndex];
    return p?.items[pointer.itemIndex] ?? null;
  }, [plan, pointer]);

  const currentKey = useMemo(
    () => (pointer ? `${pointer.phaseIndex}:${pointer.itemIndex}` : null),
    [pointer],
  );

  const resetTimer = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRestSeconds(0);
  };

  const tickRest = useCallback(() => {
    timerRef.current = window.setInterval(() => {
      setRestSeconds(prev => {
        if (prev <= 1) {
          if (timerRef.current) window.clearInterval(timerRef.current);
          timerRef.current = null;
          addCoachLog("Rest over. Get ready for your next set.", setUtterances);
          setTimeline(t => t.concat({ t: Date.now(), type: "restEnd" }));
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const beginExecution = useCallback((p: WorkoutPlan) => {
    setPointer({ phaseIndex: 0, itemIndex: 0, setIndex: 0 });
    setLog(l => l.concat(`Plan: ${p.name} · ${p.exercisesCount} exercises · ${p.totalSets} sets`));
    addCoachLog(
      `First up: ${p.phases[0]?.items[0]?.name ?? "Warm-up"}. You can type or say "done" or give details like "1,8,50" for set 1, 8 reps, 50 lbs.`,
      setUtterances,
    );
    startedAtRef.current = Date.now();
    setTimeline([{ t: startedAtRef.current, type: "start" }]);
    setStarted(true);
  }, []);

  const nextPointer = useCallback((p: WorkoutPlan, ptr: StepPointer | null): StepPointer | null => {
    if (!ptr) return null;
    const phase = p.phases[ptr.phaseIndex];
    if (!phase) return null;
    const item = phase.items[ptr.itemIndex];
    const totalSets = item?.sets ?? 1;
    if (ptr.setIndex + 1 < totalSets) return { ...ptr, setIndex: ptr.setIndex + 1 };
    if (ptr.itemIndex + 1 < phase.items.length) return { phaseIndex: ptr.phaseIndex, itemIndex: ptr.itemIndex + 1, setIndex: 0 };
    if (ptr.phaseIndex + 1 < p.phases.length) return { phaseIndex: ptr.phaseIndex + 1, itemIndex: 0, setIndex: 0 };
    return null;
  }, []);

  const handleDone = useCallback((entry?: SetEntry) => {
    if (!plan || !pointer || !currentItem) return;
    const setNum = pointer.setIndex + 1;

    // record set details if supplied
    if (entry) {
      setSetBook(prev => {
        const key = `${pointer.phaseIndex}:${pointer.itemIndex}`;
        const next = { ...prev };
        const arr = next[key] ? [...next[key]] : [];
        arr[entry.set - 1] = entry; // store by set index
        next[key] = arr;
        return next;
      });
      setLog(l => l.concat(`Done: ${currentItem.name} — Set ${entry.set}: ${entry.reps} reps @ ${entry.weight} lbs`));
      setTimeline(t =>
        t.concat({
          t: Date.now(),
          type: "done",
          detail: `${currentItem.name} s${entry.set} ${entry.reps}r @ ${entry.weight}lb`,
        }),
      );
    } else {
      setLog(l => l.concat(`Done: ${currentItem.name} (set ${setNum})`));
      setTimeline(t => t.concat({ t: Date.now(), type: "done", detail: currentItem.name }));
    }

    const rest = currentItem.restSeconds ?? defaultRestForPhase(plan, pointer.phaseIndex);
    const next = nextPointer(plan, pointer);
    if (next && next.phaseIndex === pointer.phaseIndex && next.itemIndex === pointer.itemIndex) {
      resetTimer();
      setRestSeconds(rest);
      addCoachLog(`Rest ${rest} seconds.`, setUtterances);
      setTimeline(t => t.concat({ t: Date.now(), type: "restStart" }));
      tickRest();
      setPointer(next);
    } else {
      // gentle prompt for next set with suggestion
      const nextSet = (entry?.set ?? setNum) + 1;
      const tip =
        entry && typeof entry.weight === "number"
          ? `Great. For set ${nextSet}, keep ${entry.weight} lbs or adjust as needed.`
          : `Great. For set ${nextSet}, keep or adjust weight as needed.`;
      addCoachLog(tip, setUtterances);
    }
  }, [plan, pointer, currentItem, nextPointer, tickRest]);

  function parseSetTuple(text: string): SetEntry | null {
    const t = text.trim().toLowerCase();

    // Accept explicit labels: "set 1, 8 reps, 50 pounds"
    const labeled = t.match(/set\s*(\d+).(?:rep|reps)\s(\d+).(?:lb|lbs|pound|kg|kilos?)?\s(\d+(?:.\d+)?)/i);
    if (labeled) {
      const set = Number(labeled[1]), reps = Number(labeled[2]), weight = Number(labeled[3]);
      if (isFinite(set) && isFinite(reps) && isFinite(weight)) return { set, reps, weight };
    }

    // Accept separators: comma / x / slash / spaces
    const m = t.match(/^(\d+)\s*(?:,|x|/|\s)\s*(\d+)\s*(?:,|x|/|\s)\s*(\d+(?:\.\d+)?)$/i);
    if (m) {
      const set = Number(m[1]), reps = Number(m[2]), weight = Number(m[3]);
      if (isFinite(set) && isFinite(reps) && isFinite(weight)) return { set, reps, weight };
    }

    // Word numbers: "one eight fifty"
    const wordMap: Record<string, number> = {
      one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,
      eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,
      twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90,
    };
    const words = t.split(/[^a-z0-9.]+/).filter(Boolean);
    if (words.length >= 3) {
      const nums: number[] = [];
      for (const w of words) {
        if (/^\d+(?:\.\d+)?$/.test(w)) nums.push(Number(w));
        else if (wordMap[w] !== undefined) nums.push(wordMap[w]);
      }
      if (nums.length >= 3) {
        const [set, reps, weight] = nums.slice(0, 3);
        if (isFinite(set) && isFinite(reps) && isFinite(weight)) return { set, reps, weight };
      }
    }

    // Heuristic for concatenated digits from speech: e.g., "1335" => 1,3,35 or "11095" => 1,10,95
    const justDigits = t.replace(/\D+/g, "");
    if (/^\d{3,5}$/.test(justDigits)) {
      const sCandidates = [1,2]; // typical set numbers
      for (const sLen of [1,2]) {
        const setStr = justDigits.slice(0, sLen);
        const rest = justDigits.slice(sLen);
        if (!rest) continue;
        for (let rLen = 1; rLen <= Math.min(2, rest.length - 1); rLen++) {
          const repsStr = rest.slice(0, rLen);
          const weightStr = rest.slice(rLen);
          const set = Number(setStr), reps = Number(repsStr), weight = Number(weightStr);
          const ok =
            isFinite(set) && set >= 1 && set <= 10 &&
            isFinite(reps) && reps >= 3 && reps <= 30 &&
            isFinite(weight) && weight >= 5 && weight <= 600;
          if (ok) return { set, reps, weight };
        }
      }
    }

    return null;
  }

  const handleCommand = useCallback((text: string) => {
    const t = text.toLowerCase();
    if (!t) return;

    // tuple entry "1,8,50"
    const tuple = parseSetTuple(text);
    if (tuple) {
      handleDone(tuple);
      return;
    }

    if (t.includes("done")) { handleDone(); return; }
    if (t.includes("skip")) {
      if (plan && pointer) {
        const phase = plan.phases[pointer.phaseIndex];
        if (phase) {
          setPointer(prev => prev ? { ...prev, setIndex: (phase.items[pointer.itemIndex]?.sets ?? 1) } : prev);
          setTimeline(tl => tl.concat({ t: Date.now(), type: "skip", detail: phase.items[pointer.itemIndex]?.name }));
          handleDone();
        }
      }
      return;
    }
    if (t.includes("pause")) {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
        addCoachLog("Timer paused.", setUtterances);
        setTimeline(t => t.concat({ t: Date.now(), type: "pause" }));
      }
      return;
    }
    if (t.includes("resume")) {
      if (restSeconds > 0 && !timerRef.current) tickRest();
      setTimeline(t => t.concat({ t: Date.now(), type: "resume" }));
      return;
    }
    if (t.includes("what's next") || t.includes("whats next") || t.includes("next")) {
      const ni = pointer && plan ? plan.phases[pointer.phaseIndex]?.items[pointer.itemIndex] : null;
      if (ni) addCoachLog(`Next is ${ni.name}.`, setUtterances);
      return;
    }
  }, [handleDone, plan, pointer, restSeconds, tickRest]);

  const requestPlan = useCallback(async (text: string) => {
    const payload = { message: text, userId: userId ?? null, durationMinutes: null as number | null };
    const res = await fetch("/api/voice-coach", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data?.ok && data?.plan) {
      setPlan(data.plan as WorkoutPlan);
      // Don't echo the long summary into chat to avoid duplicate rendering with the plan card.
      // Instead add a short heads-up message only.
      setUtterances(u => u.concat({ from: "coach", text: "Plan ready. Review below and press Start.", at: Date.now() }));
      setPointer(null);
      setRestSeconds(0);
      setLog([]);
      setTimeline([]);
      setStarted(false);
    }
  }, [userId]);

  if (transcript && transcript !== lastTranscript.current) {
    lastTranscript.current = transcript;
    setUtterances(u => u.concat({ from: "user", text: transcript, at: Date.now() }));
    if (!plan) void requestPlan(transcript);
    else handleCommand(transcript);
  }

  const onSend = async () => {
    const text = input.trim();
    if (!text) return;
    setUtterances(u => u.concat({ from: "user", text, at: Date.now() }));
    setInput("");

    // If the message looks like a new request ("workout", "plan", "instead", equipment words), regenerate.
    const wantsNew =
      /\b(workout|program|plan|instead|change|different)\b/i.test(text) ||
      /\b(cable|functional|dumbbell|barbell|machine|bodyweight)\b/i.test(text);

    if (!plan || wantsNew) { await requestPlan(text); return; }
    handleCommand(text);
  };

  const onStartWorkout = () => { if (plan) beginExecution(plan); };

  const onFinish = async () => {
    if (!plan || !startedAtRef.current || saving) return;
    setSaving(true);
    const ended = new Date();
    const payload: SaveWorkoutRequest = {
      userId: userId ?? null,
      plan,
      chat: { utterances },
      timeline,
      startedAt: new Date(startedAtRef.current).toISOString(),
      endedAt: ended.toISOString(),
      setsCompleted: timeline.filter(e => e.type === "done").length,
    };
    try {
      await fetch("/api/workout/save", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      addCoachLog("Session saved. Great job.", setUtterances);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-100">AI Workout Assistant</h2>
        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-300 flex items-center gap-1">
            <input
              type="checkbox"
              checked={continuous}
              onChange={e => setContinuous(e.target.checked)}
              className="accent-slate-200"
            />
            Continuous (may pick up music)
          </label>
          <a
            href={process.env.NEXT_PUBLIC_SPOTIFY_URL ?? "https://open.spotify.com/search/workout%20pump"}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-2 rounded-2xl bg-green-600 text-white shadow"
            title="Open Spotify (playlist/search)"
          >
            Open Spotify
          </a>
          <button
            onClick={() => (listening ? stop() : start())}
            className={`px-3 py-2 rounded-2xl ${
              listening ? "bg-red-600" : "bg-indigo-600"
            } text-white shadow`}
          >
            {listening ? "Stop" : "Tap to Talk"}
          </button>
        </div>
      </div>
      {!plan && (
        <p className="text-sm text-slate-300">
          Tell me what you want (e.g., "Back day, foot is sore — functional trainer, 45 minutes").
        </p>
      )}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type here…"
          className="flex-1 rounded-xl px-3 py-2 bg-[#121826] text-slate-100 placeholder:text-slate-400 border border-slate-700"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void onSend();
            }
          }}
        />
        <button onClick={onSend} className="px-3 py-2 rounded-xl bg-indigo-600 text-white shadow">
          Send
        </button>
      </div>

      {/* Chat stream */}
      <div className="space-y-3">
        {utterances.map((u, i) => (
          <div
            key={i}
            className={`max-w-[720px] rounded-2xl border ${
              u.from === "coach" ? "bg-[#121826] border-slate-800 text-slate-100" : "bg-transparent border-transparent text-slate-300"
            } p-3`}
          >
            <div className="text-xs opacity-60 mb-1">{u.from === "coach" ? "Coach" : "You"}</div>
            <div className="whitespace-pre-wrap text-sm">{u.text}</div>
          </div>
        ))}
      </div>
      {plan && !started && (
        <div className="p-4 rounded-2xl bg-[#121826] border border-slate-800 shadow">
          <div className="text-sm font-semibold text-slate-100">{plan.name}</div>
          <div className="text-xs text-slate-400">
            ~{plan.durationMinutes} min · {plan.exercisesCount} exercises · {plan.totalSets} sets
          </div>
          <pre className="text-xs whitespace-pre-wrap text-slate-200 mt-2">{plan.summaryMarkdown}</pre>
          <button
            onClick={onStartWorkout}
            className="mt-3 px-3 py-2 rounded-xl bg-emerald-600 text-white shadow"
          >
            Start Workout
          </button>
        </div>
      )}
      {plan && started && currentItem && (
        <div className="p-4 rounded-2xl bg-[#121826] border border-slate-800 shadow">
          <div className="text-sm font-semibold text-slate-100">{currentItem.name}</div>
          <div className="text-xs text-slate-300">
            {(currentItem.sets ?? 1)} sets
            {currentItem.reps ? ` · ${currentItem.reps}` : ""}
            {currentItem.weightHint ? ` · ${currentItem.weightHint}` : ""}
          </div>

          {currentKey && setBook[currentKey] && setBook[currentKey].length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {setBook[currentKey].map((s, idx) =>
                s ? (
                  <span key={idx} className="text-xs px-2 py-1 rounded-full bg-slate-800 text-slate-200 border border-slate-700">
                    S{s.set}: {s.weight}×{s.reps}
                  </span>
                ) : null,
              )}
            </div>
          )}

          {restSeconds > 0 && <div className="mt-2 text-sm text-slate-200">Rest: {restSeconds}s</div>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => handleDone()} className="px-3 py-2 rounded-xl bg-indigo-600 text-white">
              Done
            </button>
            <button
              onClick={() => handleCommand("skip")}
              className="px-3 py-2 rounded-xl border border-slate-700 text-slate-100"
            >
              Skip
            </button>
            <button
              onClick={() => handleCommand("pause")}
              className="px-3 py-2 rounded-xl border border-slate-700 text-slate-100"
            >
              Pause
            </button>
            <button
              onClick={() => handleCommand("resume")}
              className="px-3 py-2 rounded-xl border border-slate-700 text-slate-100"
            >
              Resume
            </button>
          </div>

                  <div className="text-xs text-slate-400 mt-2">
                    Tip: say or type triples like <span className="font-mono">1 8 50</span>, <span className="font-mono">1,8,50</span>, or
                    <span className="font-mono"> 1 x 8 x 50</span> — I'll parse pauses and even "one eight fifty".
                  </div>
        </div>
      )}
              {plan && log.length > 0 && (
                <div className="p-3 rounded-2xl bg-[#121826] border border-slate-800 shadow">
                  <div className="text-xs text-slate-400 mb-1">Log</div>
                  <ul className="text-sm text-slate-100 space-y-1">
                    {log.map((l, i) => (
                      <li key={i}>• {l}</li>
                    ))}
                  </ul>
                </div>
              )}
              {plan && started && (
                <div className="flex">
                  <button
                    onClick={onFinish}
                    disabled={saving}
                    className="ml-auto px-3 py-2 rounded-xl bg-emerald-600 text-white disabled:opacity-60"
                  >
                    {saving ? "Saving…" : "Finish & Save"}
                  </button>
                </div>
              )}
    </div>
  );
}

function defaultRestForPhase(plan: WorkoutPlan, phaseIndex: number): number {
  const phase = plan.phases[phaseIndex]?.phase;
  switch (phase) {
    case "strength": return 150;
    case "accessory": return 90;
    case "warmup": return 30;
    case "finisher": return 30;
    case "cooldown": return 0;
    default: return 60;
  }
}

function addCoachLog(
  text: string,
  setUtterances: React.Dispatch<React.SetStateAction<ChatUtterance[]>>
) {
  setUtterances(u => u.concat({ from: "coach", text, at: Date.now() }));
}