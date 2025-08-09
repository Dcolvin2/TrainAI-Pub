// app/debug/equipment/page.tsx
'use client';

import { useState } from 'react';

export default function EquipmentDebugPage() {
  const [userId, setUserId] = useState('');
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function fetchData(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    setData(null);
    try {
      const res = await fetch(`/api/debug/equipment?userId=${encodeURIComponent(userId)}`);
      const json = await res.json();
      if (!res.ok) setErr(json.error || 'Request failed');
      else setData(json);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto', fontFamily: 'ui-sans-serif' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>Equipment Debug</h1>
      <form onSubmit={fetchData} style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <input
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="Paste auth.users.id here"
          style={{ flex: 1, padding: 8, border: '1px solid #ccc', borderRadius: 6 }}
        />
        <button
          type="submit"
          disabled={!userId || loading}
          style={{ padding: '8px 12px', borderRadius: 6, border: 0, background: '#111', color: '#fff' }}
        >
          {loading ? 'Loading…' : 'Fetch'}
        </button>
      </form>

      {err && <p style={{ color: 'crimson', marginTop: 12 }}>{err}</p>}

      {data && (
        <pre
          style={{
            marginTop: 16,
            background: '#0f172a',
            color: '#e2e8f0',
            padding: 12,
            borderRadius: 8,
            overflow: 'auto',
          }}
        >
          {JSON.stringify(data, null, 2)}
        </pre>
      )}

      <p style={{ marginTop: 16 }}>
        Or hit the API directly in your browser: <code>/api/debug/equipment?userId=&lt;YOUR_UUID&gt;</code>
      </p>
      <p style={{ marginTop: 6, opacity: 0.8 }}>
        If your client still passes <code>sessionId</code>, you can also use{' '}
        <code>/api/debug/equipment?sessionId=&lt;ID&gt;</code>.
      </p>
    </div>
  );
}


