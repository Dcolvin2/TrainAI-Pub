'use client';

import React, { useState, KeyboardEvent } from 'react';

interface ChatBoxProps {
  onSendMessage: (message: string) => void;
  placeholder?: string;
  sendOnEnter?: boolean;
  disabled?: boolean;
}

export default function ChatBox({ 
  onSendMessage, 
  placeholder = "Type your message...", 
  sendOnEnter = true,
  disabled = false 
}: ChatBoxProps) {
  const [message, setMessage] = useState('');

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && sendOnEnter) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="bg-[#1E293B] rounded-xl p-4 shadow-md">
      <div className="relative">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full h-24 bg-[#0F172A] border border-[#334155] rounded-lg p-3 text-white resize-none focus:border-[#22C55E] focus:outline-none text-sm pr-12 disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={!message.trim() || disabled}
          className="absolute bottom-3 right-3 p-2 bg-[#22C55E] text-white rounded-lg hover:bg-[#16a34a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Send message"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
      
      {sendOnEnter && (
        <div className="mt-2 text-xs text-gray-400">
          Press Enter to send • Shift+Enter for new line
        </div>
      )}
    </div>
  );
} 