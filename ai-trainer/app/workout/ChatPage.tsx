// app/workout/ChatPage.tsx
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

export default function ChatPage() {
  // Thread
  const [msgs, setMsgs] = useState<ChatMsg[]>([
    { id: 'seed1', role: 'coach', text: 'Tell me your split or constraints.', ts: Date.now() - 5000 },
  ]);

  // Simple plan HUD state
  const [split, setSplit] = useState<'legs' | 'pull' | 'push' | 'upper' | 'hiit' | null>(null);
  const [mainLift, setMainLift] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  // Active exercise (wireframe only)
  const [exerciseId, setExerciseId] = useState('belt-squat');
  const [totalSets, setTotalSets] = useState(4);
  const [currentSet, setCurrentSet] = useState(1);
  
  // Timer state
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  const canLog = useIdempotentSetGuard();
  const allowVoice = useDebounceGate(600);

  const thread = useMemo(
    () => [...msgs].sort((a, b) => a.ts - b.ts),
    [msgs]
  );

  const append = useCallback((role: 'user' | 'coach', text: string) => {
    setMsgs(m => [...m, { id: Math.random().toString(36).slice(2), role, text, ts: Date.now() }]);
  }, []);

  // Composer
  const [input, setInput] = useState('');


  const onSend = useCallback(async () => {
    const text = input.trim();
    if (!text) return;
    append('user', text);
    setInput('');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, userId: 'demo-user' }),
      });

      const data = await response.json();
      
      if (data.ok) {
        if (data.message) {
          append('coach', data.message);
        }
        
        if (data.plan) {
          // Update HUD with plan data
          setSplit(data.plan.split);
          if (data.plan.phases) {
            const strengthPhase = data.plan.phases.find((p: any) => p.phase === 'strength');
            if (strengthPhase?.items?.[0]) {
              setMainLift(strengthPhase.items[0].name);
              setExerciseId(strengthPhase.items[0].name.toLowerCase().replace(/\s+/g, '-'));
              setTotalSets(strengthPhase.items[0].sets || 4);
              setCurrentSet(1);
            }
          }
          setStarted(true);
          setStartTime(Date.now());
        }
      } else {
        append('coach', data.error || 'Something went wrong.');
      }
    } catch (error) {
      append('coach', 'Error connecting to server. Please try again.');
    }
  }, [append, input]);

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
    append('coach', `Logged set ${setIndex}${reps ? `, ${reps} reps` : ''}${weight ? ` at ${weight}` : ''}.`);
    const next = setIndex + 1;
    if (next > totalSets) {
      append('coach', 'Exercise complete. Moving on when you're ready.');
    } else {
      setCurrentSet(next);
    }
  }, [append, canLog, currentSet, exerciseId, totalSets]);

  // Voice integration with real speech recognition
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    const handleResult = (event: any) => {
      if (!allowVoice()) return;
      
      const transcript = event.results[0][0].transcript.trim().toLowerCase();
      
      // Handle tuple format "1,8,225"
      if (/^\d+\s*,\s*\d+/.test(transcript)) {
        onTuple(transcript);
        return;
      }
      
      // Handle "done" command
      if (/^\s*done\s*$/i.test(transcript)) {
        onDone();
        return;
      }
      
      // Handle other voice commands as regular messages
      if (transcript.length > 0) {
        setInput(transcript);
      }
    };

    recognition.onresult = handleResult;
    recognition.onerror = () => {
      // Silent error handling
    };

    // Store recognition instance for manual triggering
    (window as any).workoutRecognition = recognition;

    return () => {
      recognition.stop();
    };
  }, [allowVoice, onDone, onTuple]);

  // Timer effect
  useEffect(() => {
    if (!startTime) return;
    
    const interval = setInterval(() => {
      setElapsedTime(Date.now() - startTime);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [startTime]);

  // Format timer display
  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Derived HUD text
  const hud = useMemo(() => {
    return [
      `Split: ${split ?? '—'}`,
      `Main Lift: ${mainLift ?? '—'}`,
      'Est. Duration: 45m',
      'Sets: 18',
      'Exercises: 7',
    ].join('  •  ');
  }, [split, mainLift]);

  return (
    <div className="mx-auto max-w-3xl p-4 space-y-4">
      <header className="flex items-center justify-between">
        <div className="font-semibold">TrainAI · Today's Workout</div>
        <div className="text-sm">Timer {formatTime(elapsedTime)} ↑</div>
      </header>

      <section className="rounded-lg border p-3">
        <div className="text-sm">{hud}</div>
        <div className="mt-2 flex gap-2">
          <button className="border px-3 py-1 rounded">{started ? 'Started' : 'Start'}</button>
          <button className="border px-3 py-1 rounded">Pause</button>
          <button className="border px-3 py-1 rounded">Resume</button>
          <button className="border px-3 py-1 rounded">Finish</button>
          <button className="border px-3 py-1 rounded">View Plan</button>
        </div>
      </section>

      <section className="rounded-lg border p-3 h-80 overflow-auto space-y-2">
        {thread.map(m => (
          <div key={m.id} className={m.role === 'coach' ? 'text-sm' : 'text-sm font-medium'}>
            <span className="inline-block w-14">{m.role === 'coach' ? 'Coach' : 'You'}</span>
            <span>{m.text}</span>
          </div>
        ))}
      </section>

      <section className="rounded-lg border p-3 space-y-2">
        <div className="font-medium">{mainLift ?? 'Belt Squat'}</div>
        <div>Set {currentSet} of {totalSets}</div>
        <div className="text-xs text-gray-600">Tip: type "1,8,225" or say it on mic.</div>
        <div className="mt-2 flex gap-2">
          <button className="border px-3 py-1 rounded" onClick={onDone}>Done</button>
          <button className="border px-3 py-1 rounded">Skip</button>
          <button className="border px-3 py-1 rounded">Pause</button>
          <button className="border px-3 py-1 rounded">Resume</button>
        </div>
      </section>

      <section className="rounded-lg border p-2 flex items-center gap-2">
        <button
          className="border px-2 py-1 rounded"
          onClick={() => {
            if (typeof window !== 'undefined' && (window as any).workoutRecognition) {
              (window as any).workoutRecognition.start();
            }
          }}
        >
          🎤
        </button>
        <input
          className="flex-1 px-2 py-1 outline-none"
          placeholder="Type a message…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' ? onSend() : undefined}
        />
        <button className="border px-3 py-1 rounded" onClick={onSend}>➤</button>
      </section>
    </div>
  );
}
