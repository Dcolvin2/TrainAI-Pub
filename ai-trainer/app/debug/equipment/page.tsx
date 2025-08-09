// app/debug/equipment/page.tsx
'use client';
import { useEffect, useState } from 'react';

export default function EquipmentDebugPage() {
  const [json, setJson] = useState<any>(null);
  const [err, setErr] = useState<string>('');
  const [override, setOverride] = useState('');

  const load = async (u?: string) => {
    setErr('');
    try {
      const res = await fetch(`/api/debug/equipment${u ? `?userId=${u}` : ''}`, { cache: 'no-store' });
      setJson(await res.json());
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to load');
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div style={{ padding: 16 }}>
      <h1>Equipment Debug</h1>
      <div style={{ margin: '8px 0' }}>
        <input
          style={{ width: 420, padding: 6, marginRight: 8 }}
          placeholder="Override userId (optional)"
          value={override}
          onChange={(e) => setOverride(e.target.value)}
        />
        <button onClick={() => load(override || undefined)}>Reload</button>
      </div>
      {err ? <pre>{err}</pre> : <pre>{JSON.stringify(json, null, 2)}</pre>}
    </div>
  );
}


