'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async () => {
    console.log('Login attempt with:', { email, password: password ? '[HIDDEN]' : 'empty' });
    setLoading(true);
    setError('');
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      console.log('Supabase response:', { data, error });
      
      if (error) {
        console.error('Login error:', error);
        setError(error.message);
        alert(error.message);
      } else {
        console.log('Login successful:', data);
        router.push('/new-workout');
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('An unexpected error occurred');
      alert('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-sm mx-auto">
      <h1 className="text-xl font-bold mb-4 text-center">Log In</h1>
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      <input
        className="border p-2 mb-2 block w-full rounded"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        type="email"
      />
      <input
        className="border p-2 mb-2 block w-full rounded"
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button
        className="w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded mb-4 disabled:opacity-50"
        onClick={handleLogin}
        disabled={loading}
      >
        {loading ? 'Logging in...' : 'Log In'}
      </button>

      <div className="text-sm text-center space-y-1">
        <a href="/signup" className="text-blue-600 hover:underline block">Sign up</a>
        <a href="/forgot-password" className="text-blue-600 hover:underline block">Forgot password?</a>
        <a href="/magic-link" className="text-blue-600 hover:underline block">Use magic link</a>
      </div>
    </div>
  );
} 