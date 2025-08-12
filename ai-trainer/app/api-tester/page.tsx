'use client';

import { useEffect, useMemo, useState } from 'react';

type Split = 'push' | 'pull' | 'legs' | 'upper' | 'full' | 'hiit';
type Style = 'strength' | 'balanced' | 'hiit';

const DEFAULT_USER_ID = '951f7485-0a47-44ba-b48c-9cd72178d1a7';
const LS_KEY = 'tester.userId';

const SPLITS: Array<{ key: Split; label: string }> = [
  { key: 'push',  label: 'Push' },
  { key: 'pull',  label: 'Pull' },
  { key: 'legs',  label: 'Legs' },
  { key: 'upper', label: 'Upper Body' },
  { key: 'full',  label: 'Full Body' },
  { key: 'hiit',  label: 'HIIT' },
];

export default function ApiTester() {
  // inputs
  const [userId, setUserId] = useState<string>(DEFAULT_USER_ID);
  const [message, setMessage] = useState('');
  const [minutes, setMinutes] = useState(45);
  const [style, setStyle] = useState<Style>('strength'); // non-HIIT default
  const [debugMode, setDebugMode] = useState<'none' | 'dry' | 'deep'>('none');

  // which splits to test
  const [selected, setSelected] = useState<Record<Split, boolean>>({
    push: true, pull: false, legs: true, upper: true, full: false, hiit: true,
  });

  // outputs
  const [equipOut, setEquipOut] = useState('');
  const [results, setResults] = useState<Record<Split, { json: string; prompt?: string; summary?: string }>>({} as any);
  const [running, setRunning] = useState(false);

  // prefill from localStorage or ?user= query once
  useEffect(() => {
    try {
      const urlUser = new URL(window.location.href).searchParams.get('user');
      const saved = localStorage.getItem(LS_KEY);
      const initial = urlUser?.trim() || saved?.trim() || DEFAULT_USER_ID;
      if (initial && initial !== userId) setUserId(initial);
    } catch {
      // noop
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // persist on change
  useEffect(() => {
    try { localStorage.setItem(LS_KEY, userId || DEFAULT_USER_ID); } catch {}
  }, [userId]);

  const card = 'rounded-xl border p-4 space-y-3 bg-white';
  const box  = 'w-full rounded-md border px-3 py-2 text-gray-900 placeholder-gray-400 bg-white';
  const btn  = 'rounded-md bg-black text-white px-3 py-2';

  const selectedSplits = useMemo(
    () => SPLITS.filter(s => selected[s.key]).map(s => s.key),
    [selected]
  );

  function buildQS(split: Split, mode: 'live' | 'dry' | 'deep') {
    const params = new URLSearchParams();
    if (userId) params.set('user', userId);
    if (minutes) params.set('min', String(minutes));
    params.set('split', split);
    params.set('style', split === 'hiit' ? 'hiit' : style);
    if (mode === 'dry') params.set('debug', 'dry');
    if (mode === 'deep') params.set('debug', 'deep');
    return params.toString();
  }

  async function fetchEquipment() {
    setEquipOut('Loading…');
    const res = await fetch(`/api/debug/equipment?user=${encodeURIComponent(userId)}`);
    const json = await res.json();
    setEquipOut(JSON.stringify(json, null, 2));
  }

  function summarize(json: any): string {
    try {
      const ver = json?.debug?.version || 'n/a';
      const primaryAfter = json?.debug?.primaryAfter;
      const swaps = (json?.debug?.swaps || []).length;
      const split = json?.debug?.split || 'n/a';
      const theme = json?.debug?.theme || 'n/a';
      const planName = json?.plan?.name || json?.workout?.name || '—';
      const mins = json?.debug?.durationMin || json?.plan?.duration_min || '—';
      return `v=${ver} • split=${split} • theme=${theme} • ${mins}min • primaries:${primaryAfter ? 'OK' : 'MISSING'} • swaps:${swaps} • plan="${planName}"`;
    } catch {
      return '';
    }
  }

  async function runOne(split: Split, mode: 'live' | 'dry' | 'deep') {
    const qs = buildQS(split, mode);
    const bodyMsg = message || `${split} workout, ${minutes} min, use my equipment`;
    const res = await fetch(`/api/chat-workout?${qs}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: bodyMsg }),
    });
    const json = await res.json();
    setResults(prev => ({
      ...prev,
      [split]: {
        json: JSON.stringify(json, null, 2),
        prompt: json?.debug?.promptPreview || '',
        summary: summarize(json),
      },
    }));
  }

  async function runSelected(mode: 'live' | 'dry') {
    setRunning(true);
    try {
      for (const split of selectedSplits) {
        await runOne(split, mode === 'dry' ? 'dry' : (debugMode === 'deep' ? 'deep' : 'live'));
      }
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">API Tester</h1>

      {/* Equipment */}
      <section className={card}>
        <h2 className="font-semibold text-gray-900">Equipment (GET /api/debug/equipment)</h2>
        <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
          <input className={box} value={userId} onChange={e => setUserId(e.target.value)} placeholder="User UUID" />
          <button className={btn} onClick={() => setUserId(DEFAULT_USER_ID)}>Use Default</button>
          <button className={btn} onClick={fetchEquipment}>Fetch Equipment</button>
        </div>
        <textarea className="w-full h-40 rounded-md border p-2 font-mono text-sm text-gray-900" readOnly value={equipOut} />
      </section>

      {/* Quick Split Tester */}
      <section className={card}>
        <h2 className="font-semibold text-gray-900">Quick Split Tester (POST /api/chat-workout)</h2>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm text-gray-700">Message (optional)</label>
            <input className={box} value={message} onChange={e => setMessage(e.target.value)} placeholder='e.g. "heavy strength focus, avoid bike"' />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-sm text-gray-700">Minutes</label>
              <input className={box} type="number" value={minutes} onChange={e => setMinutes(Number(e.target.value || 45))} />
            </div>
            <div>
              <label className="text-sm text-gray-700">Style (non-HIIT splits)</label>
              <select className={box} value={style} onChange={e => setStyle(e.target.value as Style)}>
                <option value="strength">strength</option>
                <option value="balanced">balanced</option>
                <option value="hiit">hiit</option>
              </select>
            </div>
          </div>
        </div>

        {/* Split checkboxes */}
        <div className="flex flex-wrap gap-3 pt-2">
          {SPLITS.map(s => (
            <label key={s.key} className="inline-flex items-center gap-2 text-sm text-gray-800">
              <input
                type="checkbox"
                checked={!!selected[s.key]}
                onChange={e => setSelected(prev => ({ ...prev, [s.key]: e.target.checked }))}
              />
              {s.label}
            </label>
          ))}
        </div>

        {/* Debug mode */}
        <div className="pt-2">
          <label className="text-sm text-gray-700">Debug mode</label>
          <select className={box} value={debugMode} onChange={e => setDebugMode(e.target.value as any)}>
            <option value="none">none (live)</option>
            <option value="dry">dry (show prompt, no LLM)</option>
            <option value="deep">deep (include prompt in live response)</option>
          </select>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <button className={btn} disabled={running} onClick={() => runSelected('live')}>
            {running ? 'Running…' : 'Run Selected (live)'}
          </button>
          <button className={btn} disabled={running} onClick={() => runSelected('dry')}>
            {running ? 'Working…' : 'Preview Prompts (no tokens)'}
          </button>
        </div>

        {/* Results grid */}
        <div className="grid gap-4 pt-4 md:grid-cols-2">
          {SPLITS.filter(s => selected[s.key]).map(s => {
            const r = results[s.key];
            return (
              <div key={s.key} className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-900">{s.label}</h3>
                  {r?.summary ? (
                    <span className="text-xs rounded bg-gray-100 px-2 py-1 text-gray-700">{r.summary}</span>
                  ) : null}
                </div>
                {r?.prompt ? (
                  <>
                    <div className="mt-2 text-sm font-medium text-gray-700">Prompt Preview</div>
                    <textarea className="w-full h-32 rounded-md border p-2 font-mono text-xs text-gray-900" readOnly value={r.prompt} />
                  </>
                ) : null}
                <div className="mt-2 text-sm font-medium text-gray-700">Response JSON</div>
                <textarea className="w-full h-56 rounded-md border p-2 font-mono text-xs text-gray-900" readOnly value={r?.json || ''} />
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
