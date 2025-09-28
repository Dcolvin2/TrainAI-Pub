// components/ChatPanel.tsx
'use client';

import React from 'react';

export default function ChatMessages({ items }: { items: Array<{ id: string; role: 'user' | 'coach'; text: string; createdAt?: number; ts?: number; smalltalk?: boolean }>}) {
  // Always render chronologically
  const list = [...items].sort((a, b) => {
    const ta = a.createdAt ?? a.ts ?? 0;
    const tb = b.createdAt ?? b.ts ?? 0;
    return ta - tb;
  });

  return (
    <div>
      {list.map(m => (
        <div key={m.id} data-role={m.role} data-smalltalk={m.smalltalk} className={m.smalltalk ? 'opacity-70 italic' : ''}>
          {m.text}
        </div>
      ))}
    </div>
  );
}
