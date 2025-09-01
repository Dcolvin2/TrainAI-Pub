'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { normalizePlan, buildChatSummary, NormalizedPlan } from '@/lib/normalizePlan';
import { getUserEquipment } from '@/lib/getUserEquipment';

// --- response adapter (drop-in) ---
function toStr(v: any) {
  if (v == null) return undefined;
  return typeof v === 'number' ? String(v) : String(v);
}
function dur(v: any) {
  if (v?.duration) return v.duration;
  if (v?.duration_seconds != null) {
    const s = Number(v.duration_seconds);
    if (Number.isFinite(s)) return s % 60 === 0 ? `${s / 60} min` : `${s}s`;
  }
  return undefined;
}
function normItems(list: any[]): any[] {
  return (Array.isArray(list) ? list : [])
    .map((it: any) => ({
      name: it?.name ?? it?.exercise ?? '',
      sets: it?.sets,
      reps: toStr(it?.reps),
      duration: dur(it),
      instruction: it?.instruction,
      isAccessory: typeof it?.isAccessory === 'boolean' ? it.isAccessory : undefined,
      is_main: it?.is_main,
    }))
    .filter(x => x.name);
}

/** Accepts any LLM shape; returns { plan, workout, coach } the UI expects */
function normalizeForUI(raw: any, split: string, minutes: number) {
  const phases = Array.isArray(raw?.plan?.phases) ? raw.plan.phases : [];
  const byPhase = (name: string) =>
    phases.find((p: any) => String(p?.phase || '').toLowerCase() === name)?.items || [];

  const w = raw?.workout || {};
  const warmSrc =
    w?.warmup ?? w?.warm_up ?? (byPhase('warmup').length ? byPhase('warmup') : byPhase('prep'));
  const mainSrc =
    w?.mainExercises ?? w?.main ?? byPhase('main').concat(byPhase('strength'));
  const finSrc =
    w?.finisher ??
    byPhase('carry')[0] ??
    byPhase('carry_block')[0] ??
    byPhase('conditioning')[0] ??
    byPhase('cooldown')[0] ??
    null;

  const warmup = normItems(warmSrc);
  const main = normItems(mainSrc);
  if (main.length) {
    main[0] = { ...main[0], isAccessory: false, is_main: undefined };
    for (let i = 1; i < main.length; i++) {
      main[i] = { ...main[i], isAccessory: true, is_main: undefined };
    }
  }
  const finisher = finSrc ? normItems([finSrc])[0] : undefined;

  const mainLift = raw?.plan?.main_lift || main?.[0]?.name || '';
  const plan = {
    split,
    duration: minutes,
    name: raw?.name || `${split[0]?.toUpperCase()}${split.slice(1)} (~${minutes} min)`,
    main_lift: mainLift,
    phases: [
      { phase: 'prep', items: warmup },
      { phase: 'strength', items: main },
      { phase: 'activation', items: [] },
      { phase: 'carry', items: finisher ? [finisher] : [] },
    ],
  };
  const workout = { warmup, mainExercises: main, finisher, cooldown: [] };
  
  // Optional client-side safety net for cooldown
  const banHi = (name: string) => /(burpee|sprint|thruster|box\s*jump|mountain\s*climber|jumping\s*jacks)/i.test(name);
  const isStretch = (name: string) => /(stretch|mobility|pose|pigeon|child'?s|hamstring|quad|lat|pec|hip\s*flexor|thoracic|breathing)/i.test(name);
  const cd = (workout.cooldown || []).filter((x: any) => !banHi(x.name));
  if (!cd.length) workout.cooldown = (workout.cooldown || []).filter((x: any) => isStretch(x.name));
  
  const coach =
    (raw?.coach && String(raw.coach).trim().length > 20 && !/^trainai$/i.test(raw.coach))
      ? raw.coach
      : `${String(split).toUpperCase()} day. Main lift: ${mainLift || '—'}. Warm-up includes scap/shoulder prep and thoracic rotation/anti-rotation.`;

  return { plan, workout, coach };
}

// ── LLM → UI helpers (keeps your table layout) ─────────────────
type DisplayItem = {
  name: string;
  sets?: string;
  reps?: string;
  duration?: string;
  instruction?: string;
  isAccessory?: boolean;
};

interface GeneratedWorkout {
  name: string;
  warmup: DisplayItem[];
  main: DisplayItem[];            // primaries only
  accessories: DisplayItem[];     // flagged or overflow
  cooldown: DisplayItem[];
  conditioning?: DisplayItem[];   // optional (for chat only; table stays the same)
  duration?: number;
  focus?: string;
}

const S = (v: any) => (v == null ? undefined : String(v));
const cleanName = (raw?: string) => {
  let s = S(raw)?.replace(/^\d+\.\s*/, '').trim() ?? 'Exercise';
  s = s.replace(/\b(\w+)\s+\1\b/gi, '$1');
  s = s.replace(/\bBarbells?\b/gi, 'Barbell')
       .replace(/\bDumbbells?\b/gi, 'Dumbbell')
       .replace(/\bKettlebells?\b/gi, 'Kettlebell')
       .replace(/\bBattle\s*Ropes?\b/gi, 'Battle Rope')
       .replace(/\bAir\s*Bike|Assault|Echo|Airdyne\b/gi, 'Exercise Bike');
  s = s.replace(/\s*-\s*\d+.*$/, '').trim();
  return s;
};
const toKey = (name: string) => cleanName(name).toLowerCase().replace(/[^a-z0-9]+/g, '');
const isNoise = (name: string) => /\b(rounds?|perform|interval|emom|amrap|tabata|work\/rest|rest)\b/i.test(name);

const toDisplayItem = (x: any): DisplayItem => {
  const name = cleanName(typeof x === 'string' ? x : x?.name);
  if (!name || isNoise(name)) return { name: '' };
  return {
    name,
    sets: S(x?.sets),
    reps: S(x?.reps),
    duration: S(x?.duration),
    instruction: S(x?.instruction),
    isAccessory: Boolean(x?.isAccessory),
  };
};

// Helper for both exercise and name keys
const toName = (it: any) => it?.name ?? it?.exercise ?? '';

// Adapter to map workout shape to phases that UI expects
function toPhasesFromWorkout(data: any) {
  const warm = Array.isArray(data?.workout?.warmup) ? data.workout.warmup : [];
  const main = Array.isArray(data?.workout?.mainExercises) ? data.workout.mainExercises : [];
  const fin = data?.workout?.finisher ? [data.workout.finisher] : [];

  // Your UI uses: prep, strength, activation, carry (you may only need some of these)
  return [
    { phase: 'prep',       items: warm.map((i:any) => ({ name: i.name ?? i.exercise, sets: i.sets, reps: i.reps, duration: i.duration, instruction: i.instruction })) },
    { phase: 'strength',   items: main.map((i:any) => ({ name: i.name ?? i.exercise, sets: i.sets, reps: i.reps, duration: i.duration, instruction: i.instruction, isAccessory: !!i.isAccessory })) },
    { phase: 'activation', items: [] },
    { phase: 'carry',      items: fin.map((i:any) => ({ name: i.name ?? i.exercise, sets: i.sets, reps: i.reps, duration: i.duration, instruction: i.instruction })) },
  ];
}

function dedup(items: DisplayItem[]): DisplayItem[] {
  const seen = new Set<string>();
  const out: DisplayItem[] = [];
  for (const it of items) {
    const k = toKey(it.name || '');
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

function llmToGeneratedWorkout(raw: any): GeneratedWorkout {
  const w = raw || {};

  const warmup = Array.isArray(w.warmup)
    ? w.warmup.map(toDisplayItem).filter((i: DisplayItem) => i.name)
    : [];

  // Accept BOTH shapes: main[] OR mainExercises[]
  const mainAll = Array.isArray(w.main)
    ? w.main.map(toDisplayItem).filter((i: DisplayItem) => i.name)
    : Array.isArray(w.mainExercises)
    ? w.mainExercises.map(toDisplayItem).filter((i: DisplayItem) => i.name)
    : [];

  // Accept BOTH shapes: cooldown[] OR a single finisher object
  const cooldown = Array.isArray(w.cooldown)
    ? w.cooldown.map(toDisplayItem).filter((i: DisplayItem) => i.name)
    : w.finisher
    ? [toDisplayItem(w.finisher)].filter((i: DisplayItem) => i.name)
    : [];

  const conditioning = Array.isArray(w.conditioning)
    ? w.conditioning.map(toDisplayItem).filter((i: DisplayItem) => i.name)
    : [];

  let primaries = mainAll.filter((it: DisplayItem) => !it.isAccessory);
  let accessories = mainAll.filter((it: DisplayItem) => it.isAccessory);

  if (primaries.length === 0 && mainAll.length) {
    const splitN = Math.min(2, mainAll.length);
    primaries = mainAll.slice(0, splitN).map((it: DisplayItem) => ({ ...it, isAccessory: false }));
    accessories = mainAll.slice(splitN).map((it: DisplayItem) => ({ ...it, isAccessory: true }));
  }

  // after the fallback that splits primaries/accessories…
  primaries = primaries.map((it: DisplayItem) => ({ ...it, isAccessory: false }));
  accessories = accessories.map((it: DisplayItem) => ({ ...it, isAccessory: true }));

  const mainDedup = dedup(primaries);
  const mainKeys = new Set(mainDedup.map((i: DisplayItem) => toKey(i.name)));
  const accDedup = dedup(accessories.filter((a: DisplayItem) => !mainKeys.has(toKey(a.name))));

  return {
          name: S(w.name) ?? 'Workout',
    warmup: dedup(warmup),
    main: mainDedup,
    accessories: accDedup,
    cooldown: dedup(cooldown),
    conditioning: dedup(conditioning),
    duration: Number(w.est_total_minutes ?? w.duration_min ?? 0) || undefined,
  };
}

// ── Pretty chat message with cues, incl. Conditioning block ──
const fmtLine = (it: DisplayItem, idx: number, phase: 'warmup'|'main'|'conditioning'|'cooldown') => {
  const sets = it.sets?.trim();
  const reps = it.reps?.trim();
  const dur  = it.duration?.trim();
  const cue  = it.instruction?.trim();

  let body = '';
  if (phase === 'cooldown') {
    const time = dur || (reps && /^[0-9]+$/.test(reps) ? `${reps} min` : reps);
    body = time ? `${it.name} - ${time}` : it.name;
  } else if (dur && !sets && !reps) {
    body = `${it.name} - ${dur}`;
  } else {
    const setsPart = sets ? `${sets} sets` : (reps ? '1 sets' : '');
    const repsPart = reps ? ` x ${reps}` : '';
    body = `${it.name}${setsPart || repsPart ? ' - ' : ''}${setsPart}${repsPart}`;
  }

  return cue ? `${idx}. ${body} — ${cue}` : `${idx}. ${body}`;
};

const asCoachMessage = (gw: GeneratedWorkout, title?: string, minutes?: number) => {
  // Title: use top-level name/message first
  const displayTitle =
    title ||              // passed parameter
    gw.name ||            // generated workout name
    'Workout';            // last resort
  
  const header = `${displayTitle}${minutes ? ` (~${minutes} min)` : ''}`;
  const mainBlock: DisplayItem[] = [...gw.main, ...gw.accessories];

  const lines: string[] = [
    header,
    '🔥 Warm-up:',
    ...gw.warmup.map((it, i) => fmtLine(it, i + 1, 'warmup')),
    ...(mainBlock.length ? ['💪 Main Workout:', ...mainBlock.map((it, i) => fmtLine(it, i + 1, 'main'))] : []),
    ...(gw.conditioning && gw.conditioning.length
      ? ['⚡ Conditioning:', ...gw.conditioning.map((it, i) => fmtLine(it, i + 1, 'conditioning'))]
      : []),
    ...(gw.cooldown.length ? ['🧘 Cool-down:', ...gw.cooldown.map((it, i) => fmtLine(it, i + 1, 'cooldown'))] : []),
  ];

  // Drop empty section headers
  const cleaned: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const isHeader = /^([🔥💪⚡🧘].*?:)$/.test(lines[i]);
    const nextIsHeaderOrEnd = i === lines.length - 1 || /^([🔥💪⚡🧘].*?:)$/.test(lines[i + 1]);
    if (isHeader && nextIsHeaderOrEnd) continue;
    cleaned.push(lines[i]);
  }
  return cleaned.join('\n');
};

// Define workout types with proper text
const workoutTypes = [
  {
    id: 'push',
    title: 'PUSH',
    subtitle: 'Chest, Shoulders, Triceps',
    color: 'border-blue-500',
    bgHover: 'hover:bg-blue-500/10'
  },
  {
    id: 'pull',
    title: 'PULL',
    subtitle: 'Back, Biceps',
    color: 'border-green-500',
    bgHover: 'hover:bg-green-500/10'
  },
  {
    id: 'legs',
    title: 'LEGS',
    subtitle: 'Quads, Hamstrings, Glutes',
    color: 'border-purple-500',
    bgHover: 'hover:bg-purple-500/10'
  },
  {
    id: 'upper',
    title: 'UPPER BODY',
    subtitle: 'Chest, Back, Shoulders, Arms',
    color: 'border-orange-500',
    bgHover: 'hover:bg-orange-500/10'
  },
  {
    id: 'full',
    title: 'FULL BODY',
    subtitle: 'Total Body Workout',
    color: 'border-red-500',
    bgHover: 'hover:bg-red-500/10'
  },
  {
    id: 'hiit',
    title: 'HIIT',
    subtitle: 'High Intensity Intervals',
    color: 'border-yellow-500',
    bgHover: 'hover:bg-yellow-500/10'
  }
];

type ApiResp = {
  ok: boolean;
  name: string;
  message: string;
  workout?: any;
  plan?: any;
  debug?: any;
};

export default function TodaysWorkoutPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [selectedTime, setSelectedTime] = useState(45);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedWorkout, setGeneratedWorkout] = useState<GeneratedWorkout | null>(null);
  const [previousWorkoutData, setPreviousWorkoutData] = useState<any>({});
  const [resp, setResp] = useState<ApiResp | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Debug: log assistant payload
  useEffect(() => { 
    if (resp) console.log('assistant payload', resp); 
  }, [resp]);

  // Fetch previous workout data
  useEffect(() => {
    const fetchPreviousWorkout = async () => {
      if (!user) return;
      
      const { data: previousSets } = await supabase
        .from('workout_sets')
        .select('id, session_id, exercise_name, set_number, prescribed_weight, actual_weight, reps, rest_seconds, rpe, session:workout_sessions!inner(user_id, date)')
        .eq('session.user_id', user.id)
        .order('date', { foreignTable: 'workout_sessions', ascending: false })
        .limit(50);
      
      // Group by exercise name to get most recent
      const previousData: Record<string, { weight: number; reps: number }> = {};
      previousSets?.forEach(set => {
        if (!previousData[set.exercise_name]) {
          previousData[set.exercise_name] = {
            weight: set.actual_weight,
            reps: set.reps
          };
        }
      });
      
      setPreviousWorkoutData(previousData);
    };
    
    fetchPreviousWorkout();
  }, [user]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;
    
    const userMessage = inputMessage;
    setInputMessage('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      // Check if user is requesting a Nike workout
      const messageLower = userMessage.toLowerCase();
      if (messageLower.includes('nike') || messageLower.includes('nike workout') || messageLower.includes('nike wod')) {
        // Extract workout number from message (e.g., "Nike 23" -> 23)
        let workoutNumber = 1; // Default to workout 1
        
        // Look for patterns like "nike 23", "nike workout 5", "nike wod 12"
        const nikeMatch = userMessage.match(/nike\s+(?:workout\s+)?(?:wod\s+)?(\d+)/i);
        if (nikeMatch) {
          workoutNumber = parseInt(nikeMatch[1]);
          // Ensure workout number is within valid range (1-24)
          if (workoutNumber < 1) workoutNumber = 1;
          if (workoutNumber > 24) workoutNumber = 24;
        }
        
        // Call Nike API with specific workout number
        const nikeResponse = await fetch('/api/nike-workout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workout: workoutNumber })
        });
        
        if (nikeResponse.ok) {
          const ct = nikeResponse.headers.get('content-type') || '';
        if (!ct.includes('application/json')) {
          const text = await nikeResponse.text();
          throw new Error(`Expected JSON but got ${ct || 'unknown'} (status ${nikeResponse.status}). First 120: ${text.slice(0,120)}`);
        }
        const nikeData = await nikeResponse.json();
          
          // Add Nike response to chat
          setChatMessages(prev => [...prev, { 
            role: 'assistant', 
            content: `Here's your Nike workout: ${nikeData.workout_name} (Workout #${nikeData.workout_number})` 
          }]);
          
          // Update workout display
          setGeneratedWorkout({
            name: nikeData.workout_name,
            warmup: nikeData.exercises.warmup.map((e: any) => e.exercise),
            main: nikeData.exercises.main.map((e: any) => e.exercise),
            accessories: nikeData.exercises.accessory.map((e: any) => e.exercise),
            cooldown: nikeData.exercises.cooldown.map((e: any) => e.exercise)
          });
        } else {
          setChatMessages(prev => [...prev, { 
            role: 'assistant', 
            content: "Sorry, I couldn't fetch a Nike workout right now. Please try again later." 
          }]);
        }
      } else {
        // Use regular chat endpoint for other requests
        const equipment = await getUserEquipment(user?.id || '');
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store', // avoid stale
          body: JSON.stringify({ 
            userId: user?.id,
            minutes: selectedTime,
            equipment,
            messages: [
              { role: 'user', content: userMessage }
            ]
          })
        });

        const ct = response.headers.get('content-type') || '';
        if (!ct.includes('application/json')) {
          const text = await response.text();
          throw new Error(`Expected JSON but got ${ct || 'unknown'} (status ${response.status}). First 120: ${text.slice(0,120)}`);
        }
        const raw = await response.json();
        
        // Handle error responses
        if (raw.error) {
          setChatMessages(prev => [...prev, { 
            role: 'assistant', 
            content: `Error: ${raw.error}` 
          }]);
        } else {
          // Resolve split from server if it gave you one; fallback to "pull" for chatty asks
          const resolvedSplit = raw?.plan?.split || 'pull';

          // Use the adapter for consistent data handling
          const { plan, workout, coach } = normalizeForUI(raw, resolvedSplit, selectedTime);

          // Persist the full raw response (so plan.phases is available for tables)
          setResp({ ...raw, plan });

          // Prefer the full cooldown array from workout, then plan.phases
          const cooldownFromWorkout = Array.isArray((workout as any)?.cooldown)
            ? (workout as any).cooldown
            : [];
          const cooldownFromPlan =
            Array.isArray(plan?.phases)
              ? (plan.phases.find((p: any) => String(p?.phase).toLowerCase() === 'cooldown')?.items ?? [])
              : [];

          const rawCooldown = cooldownFromWorkout.length
            ? cooldownFromWorkout
            : (cooldownFromPlan.length ? cooldownFromPlan : (workout.finisher ? [workout.finisher] : []));

          const legacy = {
            name: plan.name,
            warmup: workout.warmup,
            main: workout.mainExercises,
            cooldown: sanitizeCooldown(rawCooldown),
            est_total_minutes: plan.duration,
          };

          const gw = llmToGeneratedWorkout(legacy);
          // do NOT overwrite gw.cooldown again; we already sanitized
          setGeneratedWorkout(gw);

          // Handle modification responses
          if (raw.isModification && workout) {
            setChatMessages(prev => [...prev, {
              role: 'assistant',
              content: raw.chatMsg || raw.message
            }]);
          } else if (workout && !raw.isModification) {
            setChatMessages(prev => [...prev, { role: 'assistant', content: coach }]);
          } else {
            setChatMessages(prev => [...prev, {
              role: 'assistant',
              content: raw.chatMsg || raw.message || raw.response
            }]);
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "Sorry, I encountered an error. Please try again." 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  async function requestWorkout(split: 'pull'|'push'|'legs'|'upper'|'full'|'hiit', minutes: number, equipment: string[]) {
    // before the fetch
    setChatMessages?.(prev => [...prev, { role:'assistant', content:'Planning your session…', meta:'planning' }]);

    const res = await fetch('/api/chat', { 
      method: 'POST', 
      headers: { 'content-type': 'application/json' },
      cache: 'no-store', // avoid stale
      body: JSON.stringify({ 
        userId: user?.id,
        split, 
        minutes, 
        equipment, 
        messages: [
          { role: 'user', content: `I'd like a ${minutes} minute ${split} workout.` }
        ],
      }),
    });

    const ct = res.headers.get('content-type') || '';
    const raw = ct.includes('application/json') ? await res.json() : { ok:false, error: await res.text() };

    if (!raw?.ok) {
      setChatMessages?.(prev => [...prev, { role: 'assistant', content: raw?.error || 'Sorry, I hit an error.' }]);
      return;
    }

    // Adapt whatever shape came back → the one your tables use
    const { plan, workout, coach } = normalizeForUI(raw, split, minutes);

    // Update your existing UI state (keep your current setters)
    setResp(raw);

    // remove planning + placeholder, then append coach
    setChatMessages?.(prev => {
      const base = prev.filter(m => m?.meta !== 'planning' && !(m?.content && /Session \(~\d+ min\)/i.test(m.content)));
      return [...base, { role:'assistant', content: coach }];
    });

    const cooldownFromWorkout = Array.isArray((workout as any)?.cooldown)
      ? (workout as any).cooldown
      : [];
    const cooldownFromPlan =
      Array.isArray(plan?.phases)
        ? (plan.phases.find((p: any) => String(p?.phase).toLowerCase() === 'cooldown')?.items ?? [])
        : [];
    const rawCooldown = cooldownFromWorkout.length
      ? cooldownFromWorkout
      : (cooldownFromPlan.length ? cooldownFromPlan : (workout.finisher ? [workout.finisher] : []));

    const legacy = {
      name: plan.name,
      warmup: workout.warmup,
      main: workout.mainExercises,
      cooldown: sanitizeCooldown(rawCooldown),
      est_total_minutes: plan.duration,
    };
    const gw = llmToGeneratedWorkout(legacy);
    setGeneratedWorkout(gw);
  }

  const handleWorkoutSelect = async (workoutType: string) => {
    setIsLoading(true);
    setResp(null);
    
    try {
      // Get user equipment
      const equipment = await getUserEquipment(user?.id || '');
      
      // Use the new requestWorkout function
      await requestWorkout(workoutType as any, selectedTime, equipment);
    } catch (error) {
      console.error('Error generating workout:', error);
      setChatMessages(prev => [
        ...prev,
        { role: 'assistant', content: `Sorry, I had trouble generating your ${workoutType} workout. Please try again.` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // client-side cooldown guard (in case an older route sneaks through)
  const BAN_HI = /(burpee|sprint|thruster|box\s*jump|mountain\s*climber|jump(ing)?\s*jacks?)/i;

  function sanitizeCooldown(items: any[] = []) {
    const src = Array.isArray(items) ? items : [];
    // keep the server's picks; just strip HIITy items and dedupe
    const cleaned = src
      .map((i:any) => ({
        name: i?.name || i?.exercise || '',
        duration: i?.duration || i?.reps || '45–60s',
      }))
      .filter(i => i.name && !BAN_HI.test(i.name));

    const seen = new Set<string>();
    const out: { name: string; duration?: string }[] = [];
    for (const it of cleaned) {
      const k = it.name.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(it);
    }
    return out;
  }

  // Use normalized data for rendering - single source of truth
  const normalized: NormalizedPlan | null = useMemo(() => normalizePlan(resp), [resp]);
  
  // Use the rendered object as the single source of truth
  const hasAny =
    (generatedWorkout?.warmup?.length || 0) +
    (generatedWorkout?.main?.length || 0) +
    (generatedWorkout?.accessories?.length || 0) +
    (generatedWorkout?.cooldown?.length || 0) > 0;
  const isPlanning = chatMessages.some(m => m?.meta === 'planning');

  // Quick debug hook (so your DevTools command works)
  useEffect(() => {
    (window as any).gw = generatedWorkout;
    (window as any).resp = resp;
  }, [generatedWorkout, resp]);

  // Redirect if not authenticated
  if (!user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-white text-xl mb-4">Please log in to access your workout</div>
          <button
            onClick={() => router.push('/login')}
            className="bg-green-600 px-6 py-3 rounded-xl text-white font-semibold hover:bg-green-700 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-6 py-8 h-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Left side - Workout Selection */}
          <div className="lg:col-span-2 space-y-8">
            {/* Time Selection */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Time Available</h2>
              <div className="flex gap-3">
                {[15, 30, 45, 60].map((time) => (
                  <button
                    key={time}
                    onClick={() => setSelectedTime(time)}
                    className={`px-6 py-3 rounded-lg transition-all ${
                      selectedTime === time
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    {time === 60 ? '60+' : time} min
                  </button>
                ))}
              </div>
            </div>

            {/* Workout Type Cards */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Choose Your Workout</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {workoutTypes.map((workout) => (
          <button
                    key={workout.id}
                    onClick={() => handleWorkoutSelect(workout.id)}
                    className={`p-6 rounded-lg bg-gray-900 border-t-4 ${workout.color} 
                      ${workout.bgHover} transition-all hover:scale-105 text-left`}
                    disabled={isLoading}
                  >
                    <h3 className="text-lg font-bold mb-2">{workout.title}</h3>
                    <p className="text-sm text-gray-400">{workout.subtitle}</p>
          </button>
                ))}
              </div>
              
              {/* Nike Test Button - REMOVED - Now integrated into chat */}
            </div>

            {/* Debug Drawer - Hidden unless explicitly enabled */}
            {process.env.NEXT_PUBLIC_SHOW_DEBUG === '1' && resp?.debug && (
              <div className="rounded-lg border border-slate-700 p-3 text-xs text-slate-300 mb-4">
                <pre className="text-xs opacity-70">{JSON.stringify(resp.debug, null, 2)}</pre>
              </div>
            )}

            {/* Preview block removed to avoid duplicate rendering. The logger below is now the single source of truth. */}

            {/* Generated Workout Display */}
            {generatedWorkout && (
              <div className="bg-gray-900 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">{generatedWorkout.name}</h3>
                
                {/* Warm-up Section */}
                {generatedWorkout.warmup?.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-md font-semibold text-gray-300 mb-3">Warm-up</h4>
                    <div className="space-y-2">
                      {generatedWorkout.warmup.map((exercise, idx) => (
                        <div key={idx} className="flex items-center">
                          <span className="w-6 h-6 bg-gray-700 rounded-full flex items-center justify-center text-xs text-white mr-3">
                            {idx + 1}
                          </span>
                          <span className="text-gray-200">
                            {(typeof exercise === 'string' ? exercise : exercise.name || 'Exercise').replace(/^-\s*/, '')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Main Exercises Section */}
                {generatedWorkout.main?.length > 0 && (
                  <div className="mb-6">
                    {Array.isArray(generatedWorkout.main) && 
                      generatedWorkout.main
                        .filter(exercise => {
                          // Filter out instruction text
                          const name = typeof exercise === 'string' ? exercise : exercise.name;
                          return !name.toLowerCase().includes('perform') && 
                                 !name.toLowerCase().includes('rounds') &&
                                 name.length > 3;
                        })
                        .map((exercise, exerciseIndex) => {
                          // Parse exercise details
                          let exerciseName = typeof exercise === 'string' ? exercise : exercise.name;
                          let targetSets = typeof exercise === 'object' && exercise.sets ? 
                            parseInt(exercise.sets) : 3;
                          let targetReps = typeof exercise === 'object' && exercise.reps ? 
                            exercise.reps : '10';
                          
                          // Clean exercise name
                          exerciseName = exerciseName.replace(/^\d+\.\s*/, '');
                          const repsMatch = exerciseName.match(/(.+?)\s*-\s*(\d+)\s*reps?/i);
                          if (repsMatch) {
                            exerciseName = repsMatch[1].trim();
                            targetReps = repsMatch[2];
                          }
                          exerciseName = exerciseName.replace(/\s*\([^)]*\)\s*/g, '').trim();
                          
                          // Get previous workout data
                          const previous = previousWorkoutData[exerciseName];
                          
                          return (
                            <div key={exerciseIndex} className="mb-4">
                              <div className="flex items-center mb-3">
                                <h4 className="text-md font-semibold text-gray-300">
                                  {exerciseName}
                                </h4>
                                <span
                                  className={`ml-2 inline-flex items-center rounded-md px-2 py-0.5 text-xs ${
                                    (exercise as any)?.isAccessory === false || exerciseIndex === 0
                                      ? 'bg-emerald-900/40 text-emerald-200'
                                      : 'bg-slate-700/60 text-slate-200'
                                  }`}
                                >
                                  {(exercise as any)?.isAccessory === false || exerciseIndex === 0 ? 'Main Lift' : 'Accessory'}
                                </span>
                              </div>
                              <div className="bg-gray-800 rounded-lg p-4">
                                {/* Column headers */}
                                <div className="grid grid-cols-5 gap-4 text-sm text-gray-400 mb-2">
                                  <span>Set</span>
                                  <span>Previous</span>
                                  <span>lbs</span>
                                  <span>Reps</span>
                                  <span>Complete</span>
                                </div>
                                
                                {/* Sets */}
                                {[...Array(targetSets)].map((_, setIndex) => (
                                  <div key={setIndex} className="grid grid-cols-5 gap-4 items-center mb-2">
                                    <span className="text-gray-300">
                                      {setIndex + 1}
                                    </span>
                                    <span className="text-gray-500 text-sm">
                                      {/* Previous weight x reps - from DB or default */}
                                      {previous ? `${previous.weight} lbs × ${previous.reps}` : 'N/A'}
                                    </span>
                                    <input
                                      type="number"
                                      className="bg-gray-700 rounded px-2 py-1 text-white"
                                      placeholder="0"
                                    />
                                    <input
                                      type="number"
                                      className="bg-gray-700 rounded px-2 py-1 text-white"
                                      placeholder={targetReps.toString()}
                                      defaultValue={targetReps}
                                    />
                                    <input type="checkbox" className="w-5 h-5 cursor-pointer" />
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })
                    }
                  </div>
                )}
                
                {/* Accessories Section */}
                {generatedWorkout.accessories?.length > 0 && (
                  <div className="mb-6">
                    {generatedWorkout.accessories.map((exercise, idx) => (
                      <div key={idx} className="mb-4">
                        <div className="flex items-center mb-3">
                          <h4 className="text-md font-semibold text-gray-300">
                            {typeof exercise === 'string' ? exercise : exercise.name || 'Exercise'}
                          </h4>
                          <span className="ml-2 px-2 py-1 bg-blue-600 text-xs text-white rounded">Accessory</span>
                        </div>
                        <div className="bg-gray-800 rounded-lg p-4">
                          <div className="grid grid-cols-5 gap-4 text-sm text-gray-400 mb-2">
                            <span>Set</span>
                            <span>Previous</span>
                            <span>lbs</span>
                            <span>Reps</span>
                            <span>Complete</span>
                          </div>
                          {[1, 2, 3].map((setNum) => (
                            <div key={setNum} className="grid grid-cols-5 gap-4 items-center mb-2">
                              <span className="text-gray-300">{setNum}</span>
                              <span className="text-gray-500">N/A</span>
                              <input
                                type="number"
                                className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-gray-200"
                                placeholder="0"
                              />
                              <input
                                type="number"
                                className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-gray-200"
                                placeholder="0"
                              />
                              <input type="checkbox" className="w-5 h-5 cursor-pointer" />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
        </div>
                )}
                
                {/* Cool-down Section */}
                {generatedWorkout.cooldown?.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-md font-semibold text-gray-300 mb-3">Cool-down</h4>
                    <div className="space-y-2">
                      {generatedWorkout.cooldown.map((exercise, idx) => (
                        <div key={idx} className="flex items-center">
                          <span className="w-6 h-6 bg-gray-700 rounded-full flex items-center justify-center text-xs text-white mr-3">
                            {idx + 1}
                          </span>
                          <span className="text-gray-200">
                            {(typeof exercise === 'string' ? exercise : exercise.name || 'Exercise').replace(/^-\s*/, '')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {(isLoading || isPlanning) && !hasAny && (
                  <div className="text-gray-400 text-sm mt-4">Building your workout…</div>
                )}
                
                {hasAny ? (
                  <button
                    onClick={() => console.log('Starting workout:', generatedWorkout)}
                    className="mt-4 w-full bg-green-600 hover:bg-green-700 py-3 rounded-lg font-semibold"
                  >
                    Start Workout
                  </button>
                ) : (
                  !isLoading && !isPlanning && (
                    <div className="text-red-400 text-sm mt-4">
                      No items generated. Check the debug drawer and try again.
                    </div>
                  )
                )}
              </div>
            )}
          </div>
          
          {/* Right side - Chat */}
          <div className="lg:col-span-1">
            <div className="bg-gray-900 rounded-lg h-[500px] flex flex-col">
              <div className="p-4 border-b border-gray-800">
                <h3 className="text-lg font-semibold">AI Workout Assistant</h3>
              </div>
              
              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {chatMessages.length === 0 && (
                  <div className="text-gray-500 text-center mt-8">
                    Ask me anything about workouts or say "Nike workouts" for your program
                  </div>
                )}
                
                {chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 ${
                        msg.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-800 text-gray-100'
                      }`}
                    >
                      <p className="whitespace-pre-line break-words">{msg.content}</p>
                    </div>
                </div>
                ))}
                
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-800 rounded-lg px-4 py-2">
                      <span className="text-gray-400 animate-pulse">Thinking...</span>
                    </div>
                </div>
              )}
              
              {/* Auto-scroll target */}
              <div ref={chatEndRef} />
            </div>

              {/* Chat Input */}
              <div className="p-4 border-t border-gray-800">
                <div className="flex gap-2">
              <input
                type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Ask me anything..."
                    className="flex-1 bg-gray-800 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={isLoading || !inputMessage.trim()}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
            </div>
          </div>
    </div>
  );
}
