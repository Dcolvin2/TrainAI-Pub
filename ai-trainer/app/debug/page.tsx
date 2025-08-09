'use client';

import { useState } from 'react';

export default function DebugPage() {
  const [user, setUser] = useState('');
  const [q, setQ] = useState('Say "pong".');
  const [msg, setMsg] = useState('kettlebell workout 30 min');
  const [out, setOut] = useState<any>(null);

  async function getJson(url: string) {
    const res = await fetch(url, { cache: 'no-store' });
    setOut(await res.json());
  }

  async function postChat() {
    // Always append ?user=<uuid> to the URL for chat-workout
    const url = `/api/chat-workout?user=${encodeURIComponent(user)}`;
    
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user: user, message: msg }),
    });
    setOut(await res.json());
  }

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui' }}>
      <h1>Debug Console</h1>

      <section style={{ marginBottom: 24 }}>
        <h2>1) Claude ping</h2>
        <input value={q} onChange={e => setQ(e.target.value)} style={{ width: 400 }} />
        <button onClick={() => getJson(`/api/debug/claude?q=${encodeURIComponent(q)}`)}>
          GET /api/debug/claude
        </button>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2>2) Equipment for user</h2>
        <input placeholder="user uuid" value={user} onChange={e => setUser(e.target.value)} style={{ width: 400 }} />
        <button onClick={() => getJson(`/api/debug/equipment?user=${encodeURIComponent(user)}`)}>
          GET /api/debug/equipment
        </button>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2>3) Chat message → /api/chat-workout</h2>
        <input value={msg} onChange={e => setMsg(e.target.value)} style={{ width: 600 }} />
        <button onClick={postChat}>POST /api/chat-workout</button>
      </section>

      <pre style={{ background: '#111', color: '#0f0', padding: 12, borderRadius: 8, whiteSpace: 'pre-wrap' }}>
        {out ? JSON.stringify(out, null, 2) : '—'}
      </pre>
    </div>
  );
}


