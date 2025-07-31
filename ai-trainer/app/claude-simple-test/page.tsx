'use client';
import { useState } from 'react';

export default function ClaudeSimpleTest() {
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');

  const testClaude = async () => {
    try {
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      const data = await res.json();
      setResponse(data.content || 'No response');
    } catch (error) {
      setResponse('Error: Could not reach Claude');
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Claude Simple Test</h1>
      
      <div className="mb-4">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Enter a message..."
          className="w-full p-2 border rounded"
        />
      </div>
      
      <button 
        onClick={testClaude}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
      >
        Test Claude
      </button>
      
      {response && (
        <div className="mt-4 p-3 bg-gray-100 rounded">
          <strong>Response:</strong> {response}
        </div>
      )}
    </div>
  );
} 