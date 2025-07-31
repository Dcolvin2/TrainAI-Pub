'use client';
import { useState } from 'react';

export default function ClaudeTestPage() {
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState<string[]>([]);

  const sendMessage = async () => {
    try {
      const response = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      const data = await response.json();
      setChat(prev => [...prev, `You: ${message}`, `Claude: ${data.content}`]);
      setMessage('');
    } catch (error) {
      setChat(prev => [...prev, 'Error: Could not reach Claude']);
    }
  };

  return (
    <div className="p-4">
      <h1>Claude Test Page</h1>
      <div className="border p-4 h-64 overflow-y-auto mb-4">
        {chat.map((msg, i) => <div key={i}>{msg}</div>)}
      </div>
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        className="border p-2 mr-2"
        placeholder="Test Claude..."
      />
      <button onClick={sendMessage} className="bg-blue-500 text-white p-2">
        Send
      </button>
    </div>
  );
} 