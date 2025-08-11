'use client';

import { useState } from "react";

export default function ApiTester() {
  // Shared state
  const [userId, setUserId] = useState("");
  const [message, setMessage] = useState("");
  const [debugChat, setDebugChat] = useState(true);

  // Outputs
  const [equipOut, setEquipOut] = useState("");
  const [chatOut, setChatOut] = useState("");
  const [llmOut, setLlmOut] = useState("");

  async function callEquipment() {
    setEquipOut("Loading…");
    const url = `/api/debug/equipment?user=${encodeURIComponent(userId)}`;
    const res = await fetch(url);
    const json = await res.json();
    setEquipOut(JSON.stringify(json, null, 2));
  }

  async function callChat() {
    setChatOut("Loading…");
    const url = `/api/chat-workout?user=${encodeURIComponent(userId)}${debugChat ? "&debug=1" : ""}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const json = await res.json();
    setChatOut(JSON.stringify(json, null, 2));
  }

  async function callLLM() {
    setLlmOut("Loading…");
    const res = await fetch("/api/debug/llm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const json = await res.json();
    setLlmOut(JSON.stringify(json, null, 2));
  }

  const box = "w-full rounded-md border px-3 py-2 text-gray-900 placeholder-gray-400 bg-white";
  const btn = "rounded-md bg-black text-white px-3 py-2";
  const card = "rounded-xl border p-4 space-y-3 bg-white";

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">API Tester</h1>

      {/* 1) Equipment Debug */}
      <section className={card}>
        <h2 className="font-semibold text-gray-900">Equipment (GET /api/debug/equipment)</h2>
        <div className="grid gap-2">
          <label className="text-sm text-gray-700">User ID (UUID)</label>
          <input
            className={box}
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="951f7485-0a47-44ba-b48c-9cd72178d1a7"
          />
          <button className={btn} onClick={callEquipment}>Fetch Equipment</button>
        </div>
        <textarea className="w-full h-56 rounded-md border p-2 font-mono text-sm text-gray-900" value={equipOut} readOnly />
      </section>

      {/* 2) Chat Workout */}
      <section className={card}>
        <h2 className="font-semibold text-gray-900">Chat Workout (POST /api/chat-workout)</h2>
        <div className="grid gap-2">
          <label className="text-sm text-gray-700">User ID (UUID)</label>
          <input className={box} value={userId} onChange={(e) => setUserId(e.target.value)} />
          <label className="text-sm text-gray-700">Message</label>
          <input className={box} value={message} onChange={(e) => setMessage(e.target.value)} placeholder='e.g. "kettlebell workout 45 min (no snatches/cleans)"' />
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={debugChat} onChange={(e) => setDebugChat(e.target.checked)} />
            Debug (adds ?debug=1 to the API call)
          </label>
          <button className={btn} onClick={callChat}>Send to Chat Planner</button>
        </div>
        <textarea className="w-full h-56 rounded-md border p-2 font-mono text-sm text-gray-900" value={chatOut} readOnly />
      </section>

      {/* 3) Raw LLM JSON checker */}
      <section className={card}>
        <h2 className="font-semibold text-gray-900">Raw LLM JSON checker (POST /api/debug/llm)</h2>
        <div className="grid gap-2">
          <label className="text-sm text-gray-700">Message</label>
          <input className={box} value={message} onChange={(e) => setMessage(e.target.value)} placeholder='e.g. "barbell workout 45 min (no snatch/clean/jerk)"' />
          <button className={btn} onClick={callLLM}>Call LLM (raw)</button>
        </div>
        <textarea className="w-full h-56 rounded-md border p-2 font-mono text-sm text-gray-900" value={llmOut} readOnly />
      </section>
    </main>
  );
}
