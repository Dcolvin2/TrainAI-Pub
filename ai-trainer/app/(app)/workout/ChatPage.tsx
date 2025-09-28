import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type ChatMsg = { id: string; role: 'user' | 'coach'; text: string; ts: number };

function useIdempotentSetGuard() {
  const seen = useRef<Set<string>>(new Set());
  return useCallback((exerciseId: string, setIndex: number) => {
    const key = `${exerciseId}:${setIndex}`;
    if (seen.current.has(key)) return false;
    seen.current.add(key);
    return true;
  }, []);
}

function useDebounceGate(ms: number) {
  const t = useRef(0);
  return useCallback(() => {
    const now = Date.now();
    if (now - t.current < ms) return false;
    t.current = now;
    return true;
  }, [ms]);
}

// Simple inline styles (no Tailwind) to avoid build incompatibilities
const S = {
  page: { maxWidth: 880, margin: '0 auto', padding: 16, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' } as React.CSSProperties,
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } as React.CSSProperties,
  card: { border: '1px solid #ddd', borderRadius: 8, padding: 12 } as React.CSSProperties,
  btn: { border: '1px solid #ccc', borderRadius: 6, padding: '6px 10px', background: '#fff', cursor: 'pointer' } as React.CSSProperties,
  thread: { height: 320, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 } as React.CSSProperties,
  msgCoach: { fontSize: 14, color: '#222' } as React.CSSProperties,
  msgUser: { fontSize: 14, fontWeight: 600 } as React.CSSProperties,
  inputRow: { display: 'flex', alignItems: 'center', gap: 8 } as React.CSSProperties,
  input: { flex: 1, padding: '8px 10px', border: '1px solid #ccc', borderRadius: 6 } as React.CSSProperties,
};

export default function ChatPage() {
  // Chat thread
  const [msgs, setMsgs] = useState<ChatMsg[]>([
    { id: 'seed1', role: 'coach', text: 'Tell me your split or constraints.', ts: Date.now() - 5000 },
  ]);

  const append = useCallback((role: 'user' | 'coach', text: string) => {
    setMsgs(m => [...m, { id: Math.random().toString(36).slice(2), role, text, ts: Date.now() }]);
  }, []);

  const thread = useMemo(() => [...msgs].sort((a, b) => a.ts - b.ts), [msgs]);

  // HUD state
  type Split = 'legs' | 'pull' | 'push' | 'upper' | 'hiit';
  const [split, setSplit] = useState<Split | null>(null);
  const [mainLift, setMainLift] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [skipWarmups, setSkipWarmups] = useState(false);

  // Active exercise (wireframe demo)
  const [exerciseId] = useState('belt-squat');
  const [totalSets] = useState(4);
  const [currentSet, setCurrentSet] = useState(1);

  // Guards
  const canLog = useIdempotentSetGuard();
  const allowVoice = useDebounceGate(600);

  // Composer
  const [input, setInput] = useState('');

  // Smalltalk fetcher for model metadata
  const answerModel = useCallback(async () => {
    try {
      const r = await fetch('/api/meta');
      const j = await r.json();
      append('coach', `I'm ${j.model} (${j.provider}).`);
    } catch {
      append('coach', "I'm your workout planner.");
    }
  }, [append]);

  // Intent classification
  type Intent = 'smalltalk' | 'modify' | 'plan' | 'other';
  const classifyIntent = (s: string): Intent => {
    const t = s.toLowerCase().trim();
    if (!t) return 'other';
    if (/what\s+model\s+are\s+you|who\s+are\s+you|model??/.test(t)) return 'smalltalk';
    if (/use|swap|change|replace|belt\s*squat|warm.?up|warm-?ups?/.test(t)) return 'modify';
    if (/\b(start|leg day|back day|pull day|push day|upper|hiit|plan|workout)\b/.test(t)) return 'plan';
    return 'other';
  };

  const onSend = useCallback(() => {
    const text = input.trim();
    if (!text) return;

    append('user', text);
    const intent = classifyIntent(text);

    if (intent === 'smalltalk') {
      void answerModel();
      setInput('');
      return;
    }

    if (intent === 'modify') {
      if (/belt\s*squat/i.test(text)) {
        append('coach', 'Noted — I'll use Belt Squat as your main lift on legs.');
        setMainLift('Belt Squat');
      }
      if (/swap.*warm|remove.*warm|no.*warm|skip.*warm/i.test(text)) {
        setSkipWarmups(true);
        append('coach', 'Got it — I'll skip generic warmups for your next plan.');
      } else if (/warm/i.test(text)) {
        append('coach', 'Okay — I'll adjust warmups to match the split.');
      }
      setInput('');
      return;
    }

    if (intent === 'plan') {
      if (/leg/.test(text)) {
        setSplit('legs');
        setMainLift(prev => prev === 'Belt Squat' ? prev : 'Back Squat');
      } else if (/back|pull/.test(text)) {
        setSplit('pull');
        setMainLift('Barbell Deadlift');
      } else if (/push|chest/.test(text)) {
        setSplit('push');
        setMainLift('Barbell Bench Press');
      } else if (/upper/.test(text)) {
        setSplit('upper');
        setMainLift('Overhead Press');
      } else if (/hiit|metcon|wod/.test(text)) {
        setSplit('hiit');
        setMainLift(null);
      }

      const first = mainLift ?? 'Belt Squat';
      append('coach', `Plan ready. First up: ${first} — say "done" or a tuple like "1,8,225".`);
      if (skipWarmups) append('coach', 'Warmups minimized per your preference.');
      setStarted(true);
      setInput('');
      return;
    }

    append('coach', 'Tell me the split (legs/pull/push/upper/HIIT) or say "start leg day".');
    setInput('');
  }, [append, input, answerModel, mainLift, skipWarmups]);

  // Set-by-set: Done logs once and advances set index
  const onDone = useCallback(() => {
    if (!canLog(exerciseId, currentSet)) return;
    append('coach', `Logged set ${currentSet}.`);
    const next = currentSet + 1;
    if (next > totalSets) {
      append('coach', 'Exercise complete. Moving on when you're ready.');
    } else {
      setCurrentSet(next);
    }
  }, [append, canLog, currentSet, exerciseId, totalSets]);

  // Tuple "1,8,225"
  const onTuple = useCallback((s: string) => {
    const m = s.match(/^\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d+))?\s*$/);
    if (!m) return;
    const setIndex = Number(m[1]);
    const reps = Number(m[2]);
    const weight = m[3] ? Number(m[3]) : undefined;
    if (setIndex !== currentSet) return;
    if (!canLog(exerciseId, setIndex)) return;
    append('coach', `Logged set ${setIndex}${Number.isFinite(reps) ? `, ${reps} reps` : ''}${Number.isFinite(weight) ? ` at ${weight}` : ''}.`);
    const next = setIndex + 1;
    if (next > totalSets) {
      append('coach', 'Exercise complete. Moving on when you're ready.');
    } else {
      setCurrentSet(next);
    }
  }, [append, canLog, currentSet, exerciseId, totalSets]);

  // Voice (stub): post a message to window with "1,8,225" or "done"
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!allowVoice()) return;
      const payload = typeof e.data === 'string' ? e.data : '';
      if (/^\d+\s*,\s*\d+/.test(payload)) onTuple(payload);
      if (/^\s*done\s*$/i.test(payload)) onDone();
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [allowVoice, onDone, onTuple]);

  // HUD text
  const hud = useMemo(() => {
    const parts = [
      `Split: ${split ?? '—'}`,
      `Main Lift: ${mainLift ?? '—'}`,
      'Est. Duration: 45m',
      'Sets: 18',
      'Exercises: 7',
    ];
    return parts.join(' • ');
  }, [split, mainLift]);

  return (
    <div style={S.page}>
      <header style={S.row}>
        <div style={{ fontWeight: 600 }}>TrainAI · Today's Workout</div>
        <div style={{ fontSize: 13 }}>Timer 00:00 ↑</div>
      </header>

      <section style={{ ...S.card, marginTop: 12 }}>
        <div style={{ fontSize: 14 }}>{hud}</div>
        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <button style={S.btn}>{started ? 'Started' : 'Start'}</button>
          <button style={S.btn}>Pause</button>
          <button style={S.btn}>Resume</button>
          <button style={S.btn}>Finish</button>
          <button style={S.btn}>View Plan</button>
        </div>
      </section>

      <section style={{ ...S.card, marginTop: 12 }}>
        <div style={S.thread}>
          {thread.map(m => (
            <div key={m.id} style={m.role === 'coach' ? S.msgCoach : S.msgUser}>
              <span style={{ display: 'inline-block', width: 52 }}>{m.role === 'coach' ? 'Coach' : 'You'}</span>
              <span>{m.text}</span>
            </div>
          ))}
        </div>
      </section>

      <section style={{ ...S.card, marginTop: 12 }}>
        <div style={{ fontWeight: 600 }}>{mainLift ?? 'Belt Squat'}</div>
        <div>Set {currentSet} of {totalSets}</div>
        <div style={{ fontSize: 12, color: '#666' }}>Tip: type "1,8,225" or say it via mic (stub).</div>
        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <button style={S.btn} onClick={onDone}>Done</button>
          <button style={S.btn}>Skip</button>
          <button style={S.btn}>Pause</button>
          <button style={S.btn}>Resume</button>
        </div>
      </section>

      <section style={{ ...S.card, marginTop: 12 }}>
        <div style={S.inputRow}>
          <button
            style={S.btn}
            onClick={() => append('coach', '🎤 Listening (stub). Use window.postMessage("1,8,225") in console.')}
            aria-label="Voice"
          >
            🎤
          </button>
          <input
            style={S.input}
            placeholder="Type a message…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onSend(); }}
          />
          <button style={S.btn} onClick={onSend} aria-label="Send">➤</button>
        </div>
        <div style={{ marginTop: 6, fontSize: 12, color: '#666' }}>
          Hints: "use the belt squat", "swap to goblet squats", "start leg day", "finish workout"
        </div>
      </section>
    </div>
  );
}
