'use client';
import { useState } from 'react';

export default function ClaudeWorkoutPage() {
  const [workoutRequest, setWorkoutRequest] = useState('');
  const [workoutResponse, setWorkoutResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const generateWorkout = async () => {
    if (!workoutRequest.trim()) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: `Generate a workout plan for: ${workoutRequest}` 
        })
      });
      const data = await response.json();
      setWorkoutResponse(data.content || 'No response');
    } catch (error) {
      setWorkoutResponse('Error: Could not generate workout');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Claude Workout Generator</h1>
      
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">
          Describe your workout needs:
        </label>
        <textarea
          value={workoutRequest}
          onChange={(e) => setWorkoutRequest(e.target.value)}
          placeholder="e.g., I want a 30-minute upper body workout for beginners with dumbbells..."
          className="w-full p-3 border rounded-lg h-32 resize-none"
        />
      </div>
      
      <button 
        onClick={generateWorkout}
        disabled={loading || !workoutRequest.trim()}
        className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {loading ? 'Generating...' : 'Generate Workout'}
      </button>
      
      {workoutResponse && (
        <div className="mt-8 p-6 bg-gray-50 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Your Workout Plan:</h2>
          <div className="whitespace-pre-wrap">{workoutResponse}</div>
        </div>
      )}
    </div>
  );
} 