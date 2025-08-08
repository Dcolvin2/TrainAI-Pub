'use client';

import { useState } from 'react';

export default function DebugWorkoutPage() {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const testWorkoutGeneration = async () => {
    setLoading(true);
    const testResults = [];

    // Generate 3 push workouts in a row
    for (let i = 0; i < 3; i++) {
      const response = await fetch('/api/chat-workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'push workout' })
      });

      const data = await response.json();
      
      testResults.push({
        testNumber: i + 1,
        mainLift: data.workout?.main?.[0]?.name || 'NO MAIN LIFT',
        accessories: data.workout?.main?.slice(1).map(e => e.name) || [],
        warmups: data.workout?.warmup?.map(e => e.name) || [],
        timestamp: new Date().toISOString()
      });

      // Wait a bit between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setResults(testResults);
    setLoading(false);
  };

  const testDatabaseQuery = async () => {
    // Test database directly
    const response = await fetch('/api/debug-exercises', {
      method: 'GET'
    });
    const data = await response.json();
    console.log('Database test:', data);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Workout Generation Debug</h1>
      
      <div className="space-x-4 mb-8">
        <button
          onClick={testWorkoutGeneration}
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Testing...' : 'Test 3 Push Workouts'}
        </button>

        <button
          onClick={testDatabaseQuery}
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
        >
          Test Database
        </button>

        <button
          onClick={() => setResults([])}
          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
        >
          Clear Results
        </button>
      </div>

      {results.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Results:</h2>
          
          {/* Summary Table */}
          <div className="bg-gray-100 p-4 rounded">
            <h3 className="font-semibold mb-2">Quick Comparison:</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Test #</th>
                  <th className="text-left p-2">Main Lift</th>
                  <th className="text-left p-2">Accessory 1</th>
                  <th className="text-left p-2">Accessory 2</th>
                  <th className="text-left p-2">Accessory 3</th>
                  <th className="text-left p-2">Accessory 4</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} className="border-b">
                    <td className="p-2">{r.testNumber}</td>
                    <td className={`p-2 ${i > 0 && r.mainLift === results[i-1].mainLift ? 'bg-red-200' : 'bg-green-200'}`}>
                      {r.mainLift}
                    </td>
                    {r.accessories.slice(0, 4).map((acc: string, j: number) => (
                      <td 
                        key={j} 
                        className={`p-2 ${i > 0 && acc === results[i-1].accessories[j] ? 'bg-red-200' : 'bg-green-200'}`}
                      >
                        {acc}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs mt-2">🟩 = Changed from previous | 🟥 = Same as previous</p>
          </div>

          {/* Detailed Results */}
          {results.map((result, index) => (
            <div key={index} className="border p-4 rounded">
              <h3 className="font-semibold mb-2">Test #{result.testNumber}</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="font-medium">Main Lift:</p>
                  <p className={index > 0 && result.mainLift === results[index-1].mainLift ? 'text-red-600 font-bold' : 'text-green-600'}>
                    {result.mainLift}
                  </p>
                </div>
                
                <div>
                  <p className="font-medium">Warmups ({result.warmups.length}):</p>
                  <ul className="text-sm">
                    {result.warmups.map((w: string, i: number) => (
                      <li key={i} className={index > 0 && results[index-1].warmups.includes(w) ? 'text-red-600' : 'text-green-600'}>
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div className="col-span-2">
                  <p className="font-medium">Accessories ({result.accessories.length}):</p>
                  <ul className="text-sm grid grid-cols-2 gap-2">
                    {result.accessories.map((a: string, i: number) => (
                      <li key={i} className={index > 0 && results[index-1].accessories.includes(a) ? 'text-red-600' : 'text-green-600'}>
                        {i+1}. {a}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              
              <p className="text-xs text-gray-500 mt-2">Generated at: {result.timestamp}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 