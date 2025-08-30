// components/ChatPanel.tsx
'use client';

import { useEffect, useState } from 'react';

type Msg = { role: 'user' | 'assistant'; content: string };

export default function ChatPanel({ initialAssistant }: { initialAssistant?: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);

  useEffect(() => {
    if (initialAssistant) {
      setMessages([{ role: 'assistant', content: initialAssistant }]);
    }
  }, [initialAssistant]);

  return (
    <div className="rounded-xl bg-slate-900 p-4">
      <div className="text-white text-sm space-y-2 min-h-[160px]">
        {messages.length === 0 ? (
          <div className="opacity-70">Session (~45 min)</div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={m.role === 'assistant' ? 'opacity-100' : 'opacity-80'}>
              {m.content}
            </div>
          ))
        )}
      </div>
      {/* input omitted for now */}
    </div>
  );
}
