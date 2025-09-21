"use client";
import { useCallback, useMemo, useRef, useState } from "react";
import { useSpeechRecognition, speak } from "@/app/components/useSpeech";
import type { WorkoutPlan, PlanItem, ChatUtterance, TimelineEvent, SaveWorkoutRequest } from "@/app/lib/types";

type StepPointer = { phaseIndex: number; itemIndex: number; setIndex: number };

export default function WorkoutVoiceCoach({ userId }: { userId?: string | null }) {
  const { listening, transcript, start, stop, continuous, setContinuous } = useSpeechRecognition();
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

  const currentItem: PlanItem | null = useMemo(() => {
    if (!plan || !pointer) return null;
    const p = plan.phases[pointer.phaseIndex];
    return p?.items[pointer.itemIndex] ?? null;
  }, [plan, pointer]);

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
          speakLogged("Rest over. Get ready for your next set.", setUtterances);
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
    speakLogged(`First up: ${p.phases[0]?.items[0]?.name ?? "Warm-up"}. Say done when you complete a set.`, setUtterances);
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

  const handleDone = useCallback(() => {
    if (!plan || !pointer || !currentItem) return;
    setLog(l => l.concat(`Done: ${currentItem.name} (set ${pointer.setIndex + 1})`));
    setTimeline(t => t.concat({ t: Date.now(), type: "done", detail: currentItem.name }));
    const rest = currentItem.restSeconds ?? defaultRestForPhase(plan, pointer.phaseIndex);
    const next = nextPointer(plan, pointer);
    if (next && next.phaseIndex === pointer.phaseIndex && next.itemIndex === pointer.itemIndex) {
      resetTimer();
      setRestSeconds(rest);
      speakLogged(`Rest ${rest} seconds.`, setUtterances);
      setTimeline(t => t.concat({ t: Date.now(), type: "restStart" }));
      tickRest();
      setPointer(next);
    } else {
      resetTimer();
      setPointer(next);
      const ni = next ? plan.phases[next.phaseIndex]?.items[next.itemIndex] : null;
      if (ni) speakLogged(`Next: ${ni.name}. Say done when finished.`, setUtterances);
      else speakLogged("Workout complete. Tap Finish to save.", setUtterances);
    }
  }, [plan, pointer, currentItem, nextPointer, tickRest]);

  const handleCommand = useCallback((text: string) => {
    const t = text.toLowerCase();
    if (!t) return;
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
        speakLogged("Timer paused.", setUtterances);
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
      if (ni) speakLogged(`Next is ${ni.name}.`, setUtterances);
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
      setUtterances(u => u.concat({ from: "coach", text: data.plan.summaryMarkdown, at: Date.now() }));
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
    if (!plan) { await requestPlan(text); return; }
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
      speakLogged("Session saved. Great job.", setUtterances);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Workout (Chat + Voice)</h2>
        <div className="flex items-center gap-2">
          <label className="text-xs">
            <input type="checkbox" checked={continuous} onChange={e => setContinuous(e.target.checked)} className="mr-1" />
            Continuous (may pick up music)
          </label>
          <button onClick={() => (listening ? stop() : start())} className={`px-3 py-2 rounded-2xl shadow ${listening ? "bg-red-500 text-white" : "bg-black text-white"}`}>
            {listening ? "Stop" : "Tap to Talk"}
          </button>
        </div>
      </div>
      {!plan && <p className="text-sm opacity-80">Tell me what you want (e.g., "Back day, foot is sore — functional trainer, 45 minutes").</p>}
      <div className="flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="Type here…" className="flex-1 border rounded-xl px-3 py-2" />
        <button onClick={onSend} className="px-3 py-2 rounded-xl bg-black text-white">Send</button>
      </div>
      {plan && !started && (
        <div className="p-4 rounded-2xl bg-white shadow space-y-2">
          <div className="text-sm font-semibold">{plan.name}</div>
          <div className="text-xs opacity-70">~{plan.durationMinutes} min · {plan.exercisesCount} exercises · {plan.totalSets} sets</div>
          <pre className="text-xs whitespace-pre-wrap">{plan.summaryMarkdown}</pre>
          <button onClick={onStartWorkout} className="mt-2 px-3 py-2 rounded-xl bg-black text-white">Start Workout</button>
        </div>
      )}
      {plan && started && currentItem && (
        <div className="p-4 rounded-2xl bg-white shadow">
          <div className="text-sm font-semibold">{currentItem.name}</div>
          <div className="text-xs opacity-80">
            {(currentItem.sets ?? 1)} sets{currentItem.reps ? ` · ${currentItem.reps}` : ""}{currentItem.weightHint ? ` · ${currentItem.weightHint}` : ""}
          </div>
          {restSeconds > 0 && <div className="mt-2 text-sm">Rest: {restSeconds}s</div>}
          <div className="mt-3 flex gap-2">
            <button onClick={handleDone} className="px-3 py-2 rounded-xl bg-black text-white">Done</button>
            <button onClick={() => handleCommand("skip")} className="px-3 py-2 rounded-xl border">Skip</button>
            <button onClick={() => handleCommand("pause")} className="px-3 py-2 rounded-xl border">Pause</button>
            <button onClick={() => handleCommand("resume")} className="px-3 py-2 rounded-xl border">Resume</button>
          </div>
        </div>
      )}
      {plan && (
        <div className="p-3 rounded-2xl bg-white shadow">
          <div className="text-xs opacity-70 mb-1">Log</div>
          <ul className="text-sm space-y-1">{log.map((l, i) => <li key={i}>• {l}</li>)}</ul>
          {started && <button onClick={onFinish} disabled={saving} className="mt-3 px-3 py-2 rounded-xl bg-green-600 text-white">{saving ? "Saving…" : "Finish & Save"}</button>}
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

function speakLogged(text: string, setUtterances: React.Dispatch<React.SetStateAction<ChatUtterance[]>>) {
  speak(text);
  setUtterances(u => u.concat({ from: "coach", text, at: Date.now() }));
}