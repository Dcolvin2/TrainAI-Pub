'use client';

import { useEffect, useMemo, useState } from 'react';

type Split = 'push' | 'pull' | 'legs' | 'upper' | 'full' | 'hiit';
type Style = 'strength' | 'balanced' | 'hiit';

const DEFAULT_USER_ID = '951f7485-0a47-44ba-b48c-9cd72178d1a7';
const LS_USER = 'tester.userId';

const SPLITS: Array<{ key: Split; label: string }> = [
  { key: 'push',  label: 'Push' },
  { key: 'pull',  label: 'Pull' },
  { key: 'legs',  label: 'Legs' },
  { key: 'upper', label: 'Upper Body' },
  { key: 'full',  label: 'Full Body' },
  { key: 'hiit',  label: 'HIIT' },
];

export default function ApiTester() {
  // Inputs
  const [userId, setUserId]   = useState<string>(DEFAULT_USER_ID);
  const [minutes, setMinutes] = useState<number>(45);
  const [style, setStyle]     = useState<Style>('strength'); // used for non-HIIT split runs

  // Free-text Chat playground
  const [chatMsg, setChatMsg]   = useState<string>('');
  const [chatSplit, setChatSplit] = useState<Split | ''>(''); // optional split for chat
  const [chatDebug, setChatDebug] = useState<'none' | 'dry' | 'deep'>('none');
  const [chatOut, setChatOut]   = useState<string>('');
  const [chatPrompt, setChatPrompt] = useState<string>('');

  // Raw LLM checker (direct Anthropic echo)
  const [llmMsg, setLlmMsg]   = useState<string>('');
  const [llmOut, setLlmOut]   = useState<string>('');

  // Menu (split) runner
  const [selected, setSelected] = useState<Record<Split, boolean>>({
    push: true, pull: false, legs: true, upper: true, full: false, hiit: true,
  });
  const [splitResults, setSplitResults] =
    useState<Record<Split, { json: string; prompt?: string; summary?: string }>>({} as any);
  const [busy, setBusy] = useState<boolean>(false);

  // Prefill/persist userId
  useEffect(() => {
    try {
      const urlUser = new URL(window.location.href).searchParams.get('user');
      const saved = localStorage.getItem(LS_USER);
      const initial = urlUser?.trim() || saved?.trim() || DEFAULT_USER_ID;
      if (initial && initial !== userId) setUserId(initial);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { try { localStorage.setItem(LS_USER, userId || DEFAULT_USER_ID); } catch {} }, [userId]);

  // Styles
  const card = 'rounded-xl border p-4 space-y-3 bg-white';
  const box  = 'w-full rounded-md border px-3 py-2 text-gray-900 placeholder-gray-400 bg-white';
  const btn  = 'rounded-md bg-black text-white px-3 py-2';

  const selectedSplits = useMemo(
    () => SPLITS.filter(s => selected[s.key]).map(s => s.key),
    [selected]
  );

  // ---------- helpers ----------
  function buildQS(params: {
    split?: Split | '';
    mode?: 'live' | 'dry' | 'deep';
    minutes?: number;
    forcedStyle?: Style; // used for split runs
  }) {
    const u = new URLSearchParams();
    if (userId) u.set('user', userId);
    if (params.minutes) u.set('min', String(params.minutes));
    if (params.split)  u.set('split', params.split);
    // style logic: HIIT forces hiit; otherwise use provided style or strength
    const s = params.split === 'hiit' ? 'hiit' : (params.forcedStyle || 'strength');
    u.set('style', s);
    if (params.mode === 'dry')  u.set('debug', 'dry');
    if (params.mode === 'deep') u.set('debug', 'deep');
    return u.toString();
  }

  function summarize(json: any): string {
    try {
      const ver = json?.debug?.version || 'n/a';
      const split = json?.debug?.split || 'n/a';
      const mins = json?.debug?.durationMin || json?.plan?.duration_min || '—';
      const primOK = json?.debug?.primaryAfter ?? json?.debug?.primaryBefore;
      const swaps = (json?.debug?.swaps || []).length;
      const title = json?.plan?.name || '—';
      return `v=${ver} • split=${split} • ${mins}min • primaries:${primOK ? 'OK' : 'MISSING'} • swaps:${swaps} • plan="${title}"`;
    } catch { return ''; }
  }

  // ---------- equipment ----------
  const [equipOut, setEquipOut] = useState('');
  async function fetchEquipment() {
    setEquipOut('Loading…');
    const res = await fetch(`/api/debug/equipment?user=${encodeURIComponent(userId)}`);
    const json = await res.json();
    setEquipOut(JSON.stringify(json, null, 2));
  }

  // ---------- chat playground ----------
  async function runChat(mode: 'live' | 'dry' | 'deep') {
    setChatOut('Loading…'); setChatPrompt('');
    const qs = buildQS({
      split: chatSplit,
      mode: mode === 'live' ? (chatDebug === 'deep' ? 'deep' : 'live') : mode,
      minutes,
      forcedStyle: style,
    });
    const res = await fetch(`/api/chat-workout?${qs}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: chatMsg || 'plan a workout' }),
    });
    const json = await res.json();
    setChatOut(JSON.stringify(json, null, 2));
    if (json?.debug?.promptPreview) setChatPrompt(String(json.debug.promptPreview));
  }

  // ---------- raw llm ----------
  async function runLLM() {
    setLlmOut('Loading…');
    const res = await fetch('/api/debug/llm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: llmMsg || 'barbell workout 45 min (no snatch/clean/jerk)' }),
    });
    const json = await res.json();
    setLlmOut(JSON.stringify(json, null, 2));
  }

  // ---------- splits ----------
  async function runSplit(split: Split, mode: 'live' | 'dry' | 'deep') {
    const qs = buildQS({
      split,
      mode: mode === 'live' ? 'live' : mode,
      minutes,
      forcedStyle: style,
    });
    const res = await fetch(`/api/chat-workout?${qs}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `${split} workout ${minutes} min use my equipment` }),
    });
    const json = await res.json();
    setSplitResults(prev => ({
      ...prev,
      [split]: {
        json: JSON.stringify(json, null, 2),
        prompt: json?.debug?.promptPreview || '',
        summary: summarize(json),
      },
    }));
  }

  async function runSelected(mode: 'live' | 'dry') {
    setBusy(true);
    try {
      for (const s of selectedSplits) {
        await runSplit(s, mode === 'dry' ? 'dry' : (chatDebug === 'deep' ? 'deep' : 'live'));
      }
    } finally {
      setBusy(false);
    }
  }

  // ---------- UI ----------
  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-100">API Tester</h1>

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

      {/* Chat Playground (free text) */}
      <section className={card}>
        <h2 className="font-semibold text-gray-900">Chat Playground (POST /api/chat-workout)</h2>
        <div className="grid gap-2 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm text-gray-700">Message</label>
            <input className={box} value={chatMsg} onChange={e => setChatMsg(e.target.value)}
              placeholder='e.g. "I want a joe holder ocho style workout for 32 minutes (avoid bike)"' />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-sm text-gray-700">Minutes</label>
              <input className={box} type="number" value={minutes} onChange={e => setMinutes(Number(e.target.value || 45))} />
            </div>
            <div>
              <label className="text-sm text-gray-700">Split (optional)</label>
              <select className={box} value={chatSplit} onChange={e => setChatSplit(e.target.value as Split | '')}>
                <option value="">auto</option>
                {SPLITS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-700">Style (non-HIIT)</label>
              <select className={box} value={style} onChange={e => setStyle(e.target.value as Style)}>
                <option value="strength">strength</option>
                <option value="balanced">balanced</option>
                <option value="hiit">hiit</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm text-gray-700">Debug</label>
            <select className={box} value={chatDebug} onChange={e => setChatDebug(e.target.value as any)}>
              <option value="none">none (live)</option>
              <option value="dry">dry (show prompt, no LLM)</option>
              <option value="deep">deep (include prompt in live response)</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button className={btn} onClick={() => runChat('live')}>Run Chat</button>
          <button className={btn} onClick={() => runChat('dry')}>Preview Prompt (no tokens)</button>
        </div>

        <div className="grid gap-3 pt-3">
          <h3 className="font-medium">Response JSON</h3>
          <textarea className="w-full h-64 rounded-md border p-2 font-mono text-sm text-gray-900" readOnly value={chatOut} />
          {chatPrompt ? <>
            <h3 className="font-medium">Prompt Preview</h3>
            <textarea className="w-full h-44 rounded-md border p-2 font-mono text-sm text-gray-900" readOnly value={chatPrompt} />
          </> : null}
        </div>
      </section>

      {/* Raw LLM JSON checker (direct Anthropic sanity) */}
      <section className={card}>
        <h2 className="font-semibold text-gray-900">Raw LLM JSON checker (POST /api/debug/llm)</h2>
        <div className="grid gap-2 md:grid-cols-[1fr_auto]">
          <input className={box} value={llmMsg} onChange={e => setLlmMsg(e.target.value)}
            placeholder='e.g. "barbell workout 45 min (no snatch/clean/jerk)"' />
          <button className={btn} onClick={runLLM}>Call LLM (raw)</button>
        </div>
        <textarea className="w-full h-48 rounded-md border p-2 font-mono text-sm text-gray-900" readOnly value={llmOut} />
      </section>

      {/* Menu (Split) Runner */}
      <section className={card}>
        <h2 className="font-semibold text-gray-900">Menu Generator — same as clicking PUSH/PULL/HIIT</h2>

        <div className="grid gap-2 md:grid-cols-3">
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
          <div>
            <label className="text-sm text-gray-700">Debug for runs</label>
            <select className={box} value={chatDebug} onChange={e => setChatDebug(e.target.value as any)}>
              <option value="none">none (live)</option>
              <option value="dry">dry (show prompt, no LLM)</option>
              <option value="deep">deep (include prompt in live response)</option>
            </select>
          </div>
        </div>

        {/* checkboxes */}
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

        <div className="flex flex-wrap gap-2 pt-2">
          <button className={btn} disabled={busy} onClick={() => runSelected('live')}>
            {busy ? 'Running…' : 'Run Selected (live)'}
          </button>
          <button className={btn} disabled={busy} onClick={() => runSelected('dry')}>
            {busy ? 'Working…' : 'Preview Prompts (no tokens)'}
          </button>
        </div>

        {/* results */}
        <div className="grid gap-4 pt-4 md:grid-cols-2">
          {SPLITS.filter(s => selected[s.key]).map(s => {
            const r = splitResults[s.key];
            return (
              <div key={s.key} className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-900">{s.label}</h3>
                  {r?.summary ? (
                    <span className="text-xs rounded bg-gray-100 px-2 py-1 text-gray-700">{r.summary}</span>
                  ) : null}
                </div>
                <div className="flex gap-2 py-2">
                  <button className={btn} onClick={() => runSplit(s.key, 'live')}>Run</button>
                  <button className={btn} onClick={() => runSplit(s.key, 'dry')}>Preview Prompt</button>
                  <button className={btn} onClick={() => runSplit(s.key, 'deep')}>Run (include prompt)</button>
                </div>
                {r?.prompt ? (
                  <>
                    <div className="mt-2 text-sm font-medium text-gray-700">Prompt Preview</div>
                    <textarea className="w-full h-28 rounded-md border p-2 font-mono text-xs text-gray-900" readOnly value={r.prompt} />
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
