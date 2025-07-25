'use client';

import { useState, useEffect } from 'react';

export function WorkoutTimer() {
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const hh = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const mm = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  return (
    <div className="w-full flex justify-center mb-4">
      <div className="flex items-center space-x-3 bg-[#0F172A]/80 backdrop-blur-sm rounded-2xl px-4 py-2 shadow-md">
        <button
          onClick={() => setRunning(!running)}
          className="p-2 text-white bg-green-500 rounded-full focus:outline-none focus:ring-2 focus:ring-green-400 hover:bg-green-600 transition-colors"
        >
          {running ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          )}
        </button>
        <span className="font-mono text-lg text-white">{`${hh}:${mm}:${ss}`}</span>
        <button
          onClick={() => { setSeconds(0); setRunning(false); }}
          className="p-2 text-white bg-gray-700 rounded-full focus:outline-none focus:ring-2 focus:ring-gray-600 hover:bg-gray-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
    </div>
  );
} 