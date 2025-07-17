'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) {
      router.push('/new-workout');
    } else {
      alert(error.message);
    }
  };

  return (
    <div className="p-4 max-w-sm mx-auto">
      <h1 className="text-xl font-bold mb-4 text-center">Log In</h1>
      <input
        className="border p-2 mb-2 block w-full rounded"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        className="border p-2 mb-2 block w-full rounded"
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button
        className="w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded mb-4"
        onClick={handleLogin}
      >
        Log In
      </button>

      <div className="text-sm text-center space-y-1">
        <a href="/signup" className="text-blue-600 hover:underline block">Sign up</a>
        <a href="/forgot-password" className="text-blue-600 hover:underline block">Forgot password?</a>
        <a href="/magic-link" className="text-blue-600 hover:underline block">Use magic link</a>
      </div>
    </div>
  );
} 