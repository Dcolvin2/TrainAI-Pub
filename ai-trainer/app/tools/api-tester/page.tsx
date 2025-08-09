'use client';

import React, { useEffect, useMemo, useState } from 'react';

type Resp = { ok?: boolean; [k: string]: any };

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      border: '1px solid #e5e7eb', borderRadius: 12, padding: 16,
      background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,.05)'
    }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

function Pre({ data }: { data: any }) {
  const text = useMemo(() => {
    try { return JSON.stringify(data, null, 2); } catch { return String(data); }
  }, [data]);
  return (
    <pre style={{
      background: '#0b0f17', color: '#b4f1b4', padding: 12,
      borderRadius: 8, overflow: 'auto', maxHeight: 360, fontSize: 13, lineHeight: 1.35
    }}>
      {text || '—'}
    </pre>
  );
}

export default function ApiTesterPage() {
  // Persist user id for convenience
  const [userId, setUserId] = useState('');
  const [prefix, setPrefix] = useState(''); // basePath if you deploy under one (e.g. /todays-workout)
  const [message, setMessage] = useState('kettlebell workout 30 min');

  const [loadingEq, setLoadingEq] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [loadingPing, setLoadingPing] = useState(false);

  const [eqResp, setEqResp] = useState<Resp | null>(null);
  const [chatResp, setChatResp] = useState<Resp | null>(null);
  const [pingResp, setPingResp] = useState<Resp | null>(null);

  const [sendHeader, setSendHeader] = useState(false); // let you send x-user-id header instead of query
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('apiTester.userId');
    if (saved) setUserId(saved);
    // naive auto-detect for basePath like /todays-workout
    if (typeof window !== 'undefined') {
      const maybe = window.location.pathname.split('/').filter(Boolean)[0];
      if (maybe && maybe !== 'tools' && maybe !== 'api') {
        setPrefix('/' + maybe); // e.g. /todays-workout
      }
    }
  }, []);

  useEffect(() => {
    if (userId) localStorage.setItem('apiTester.userId', userId);
  }, [userId]);

  const urlEq = useMemo(() => {
    const base = `${prefix}/api/debug/equipment`;
    return sendHeader || !userId ? base : `${base}?user=${encodeURIComponent(userId)}`;
  }, [prefix, userId, sendHeader]);

  const urlChat = useMemo(() => {
    const base = `${prefix}/api/chat-workout`;
    return userId ? `${base}?user=${encodeURIComponent(userId)}` : base;
  }, [prefix, userId]);

  async function doPing() {
    setError(null); setPingResp(null); setLoadingPing(true);
    try {
      const r = await fetch(`${prefix}/api/debug/ping?q=${encodeURIComponent('Say "pong".')}`);
      const j = await r.json();
      setPingResp(j);
    } catch (e: any) {
      setError(e?.message || 'Ping failed');
    } finally { setLoadingPing(false); }
  }

  async function getEquipment() {
    setError(null); setEqResp(null); setLoadingEq(true);
    try {
      const r = await fetch(urlEq, {
        method: 'GET',
        headers: sendHeader && userId ? { 'x-user-id': userId } : undefined,
      });
      const j = await r.json();
      setEqResp(j);
    } catch (e: any) {
      setError(e?.message || 'Request failed');
    } finally { setLoadingEq(false); }
  }

  async function postChat() {
    setError(null); setChatResp(null); setLoadingChat(true);
    try {
      const r = await fetch(urlChat, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sendHeader && userId ? { 'x-user-id': userId } : {}),
        },
        body: JSON.stringify({ message }),
      });
      const j = await r.json();
      setChatResp(j);
    } catch (e: any) {
      setError(e?.message || 'Request failed');
    } finally { setLoadingChat(false); }
  }

  return (
    <div style={{ maxWidth: 960, margin: '40px auto', padding: '0 16px', display: 'grid', gap: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800 }}>API Tester</h1>

      <Box title="Settings">
        <div style={{ display: 'grid', gap: 8 }}>
          <label style={{ display: 'grid', gap: 4 }}>
            <span>Base path (leave empty unless your app lives under something like <code>/todays-workout</code>)</span>
            <input
              value={prefix}
              onChange={(e) => setPrefix(e.target.value.trim())}
              placeholder="/todays-workout"
              style={{ border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 10px' }}
            />
          </label>

          <label style={{ display: 'grid', gap: 4 }}>
            <span>User UUID</span>
            <input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="951f7485-0a47-44ba-b48c-9cd72178d1a7"
              style={{ border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 10px' }}
            />
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={sendHeader} onChange={(e) => setSendHeader(e.target.checked)} />
            <span>Send user id in request header (<code>x-user-id</code>) instead of query string</span>
          </label>
        </div>
      </Box>

      <Box title="1) Ping Claude (sanity check)">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <button
            onClick={doPing}
            disabled={loadingPing}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #111827', background: '#111827', color: '#fff' }}
          >
            {loadingPing ? 'Pinging…' : 'Ping'}
          </button>
          <span style={{ color: '#6b7280' }}>{prefix}/api/debug/ping</span>
        </div>
        <Pre data={pingResp} />
      </Box>

      <Box title="2) Equipment for user">
        <div style={{ display: 'grid', gap: 8, marginBottom: 8 }}>
          <div style={{ color: '#6b7280' }}>GET {urlEq || '/api/debug/equipment'}</div>
          <button
            onClick={getEquipment}
            disabled={loadingEq || (!sendHeader && !userId)}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #0ea5e9', background: '#0ea5e9', color: '#fff', width: 160 }}
          >
            {loadingEq ? 'Loading…' : 'Fetch Equipment'}
          </button>
        </div>
        <Pre data={eqResp} />
      </Box>

      <Box title="3) Chat message → /api/chat-workout">
        <label style={{ display: 'grid', gap: 4, marginBottom: 8 }}>
          <span>Message</span>
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="kettlebell workout 30 min"
            style={{ border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 10px' }}
          />
        </label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <button
            onClick={postChat}
            disabled={loadingChat}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #16a34a', background: '#16a34a', color: '#fff', width: 160 }}
          >
            {loadingChat ? 'Planning…' : 'Send to Chat'}
          </button>
          <span style={{ color: '#6b7280' }}>POST {urlChat || '/api/chat-workout'} (JSON body)</span>
        </div>
        <Pre data={chatResp} />
      </Box>

      {error && (
        <div style={{ color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', padding: 12, borderRadius: 8 }}>
          {error}
        </div>
      )}

      <div style={{ color: '#6b7280', fontSize: 12 }}>
        Tip: if your app is deployed under a base path (e.g. <code>/todays-workout</code>), set "Base path" above.
      </div>
    </div>
  );
}
