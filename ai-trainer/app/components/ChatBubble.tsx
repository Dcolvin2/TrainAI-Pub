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
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className="max-w-xs lg:max-w-md">
        <div
          className={`px-4 py-3 rounded-lg text-sm ${
            isUser
              ? 'bg-[#22C55E] text-white rounded-br-md'
              : 'bg-[#334155] text-white rounded-bl-md'
          }`}
        >
          <div className="whitespace-pre-wrap">{message}</div>
        </div>
        {timestamp && (
          <div className={`text-xs text-gray-400 mt-1 ${isUser ? 'text-right' : 'text-left'}`}>
            {timestamp}
          </div>
        )}
      </div>
    </div>
  );
} 