'use client';

import React from 'react';

interface ChatBubbleProps {
  sender: 'user' | 'assistant';
  message: string;
  timestamp?: string;
}

export default function ChatBubble({ sender, message, timestamp }: ChatBubbleProps) {
  const isUser = sender === 'user';
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-2`} style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
      <div className="max-w-xs lg:max-w-md" style={{ 
        maxWidth: '100%', 
        boxSizing: 'border-box',
        wordWrap: 'break-word',
        overflowWrap: 'break-word'
      }}>
        <div
          className={`px-3 py-2 rounded-lg text-sm ${
            isUser
              ? 'bg-[#22C55E] text-white rounded-br-md'
              : 'bg-[#334155] text-white rounded-bl-md'
          }`}
          style={{
            maxWidth: '100%',
            boxSizing: 'border-box',
            wordWrap: 'break-word',
            overflowWrap: 'break-word',
            whiteSpace: 'pre-wrap'
          }}
        >
          <div className="whitespace-pre-wrap" style={{
            maxWidth: '100%',
            boxSizing: 'border-box',
            wordWrap: 'break-word',
            overflowWrap: 'break-word'
          }}>{message}</div>
        </div>
        {timestamp && (
          <div className={`text-xs text-gray-400 mt-1 ${isUser ? 'text-right' : 'text-left'}`} style={{
            maxWidth: '100%',
            boxSizing: 'border-box',
            wordWrap: 'break-word',
            overflowWrap: 'break-word'
          }}>
            {timestamp}
          </div>
        )}
      </div>
    </div>
  );
} 