'use client';

import { useState } from 'react';

export default function ApiTester() {
  const [userId, setUserId] = useState('');
  const [endpoint, setEndpoint] = useState<'equipment' | 'chat'>('equipment');
  const [method, setMethod] = useState<'GET' | 'POST'>('GET');
  const [message, setMessage] = useState('kettlebell workout');
  const [result, setResult] = useState<string>('');

  const inputCls =
    'w-full rounded-lg border px-3 py-2 ' +
    'bg-white text-gray-900 placeholder:text-gray-500 border-gray-300 ' +
    'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ' +
    'dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-400 dark:border-gray-700';

  const labelCls = 'text-sm font-medium text-gray-800 dark:text-gray-200';
  const sectionCls =
    'rounded-xl border border-gray-200 bg-white p-4 shadow-sm ' +
    'dark:bg-gray-900 dark:border-gray-800';

  async function runTest() {
    setResult('…loading…');

    let url = '';
    let init: RequestInit = { method };

    if (endpoint === 'equipment') {
      url = `/api/debug/equipment${userId ? `?user=${encodeURIComponent(userId)}` : ''}`;
      init = { method: 'GET' };
    } else {
      // Always append ?user=<uuid> to the URL for chat-workout
      const sep = '/api/chat-workout'.includes('?') ? '&' : '?';
      url = `/api/chat-workout${sep}user=${encodeURIComponent(userId || 'demo-user')}`;
      init = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: userId || 'demo-user', message }),
      };
    }

    try {
      const res = await fetch(url, init);
      const txt = await res.text();
      setResult(txt);
    } catch (e: any) {
      setResult(`Request failed: ${e?.message || e}`);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 p-6 dark:bg-gray-950 dark:text-gray-100">
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-2xl font-semibold">API Tester</h1>

        <div className={sectionCls}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className={labelCls}>User ID (UUID)</label>
              <input
                className={inputCls}
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="951f7485-0a47-44ba-b48c-9cd72178d1a7"
                spellCheck={false}
              />
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Needed for <code>/api/debug/equipment</code> and to scope chat.
              </p>
            </div>

            <div className="space-y-1">
              <label className={labelCls}>Endpoint</label>
              <select
                className={inputCls}
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value as any)}
              >
                <option value="equipment">GET /api/debug/equipment</option>
                <option value="chat">POST /api/chat-workout</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className={labelCls}>Method</label>
              <select
                className={inputCls}
                value={method}
                onChange={(e) => setMethod(e.target.value as any)}
                disabled={endpoint === 'equipment'}
                title={endpoint === 'equipment' ? 'Equipment uses GET' : ''}
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
              </select>
            </div>

            {endpoint === 'chat' && (
              <div className="space-y-1 sm:col-span-2">
                <label className={labelCls}>Chat message</label>
                <input
                  className={inputCls}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="e.g., kettlebell workout, joe holder style"
                />
              </div>
            )}
          </div>

          <div className="mt-4">
            <button
              onClick={runTest}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Send Request
            </button>
          </div>
        </div>

        <div className={sectionCls}>
          <label className={labelCls}>Response</label>
          <textarea
            className={`${inputCls} mt-1 h-72 font-mono text-sm`}
            value={result}
            readOnly
          />
        </div>
      </div>
    </main>
  );
}
