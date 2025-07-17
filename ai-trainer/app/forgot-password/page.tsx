'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`;
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      if (error) {
        setError(error.message);
      } else {
        setMessage('Check your inbox for reset instructions.');
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-sm mx-auto">
      <h1 className="text-xl font-bold mb-4 text-center">Forgot Password</h1>
      <input
        className="border p-2 mb-4 block w-full rounded"
        placeholder="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button
        disabled={loading || !email}
        className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white px-4 py-2 rounded mb-4"
        onClick={handleSend}
      >
        {loading ? 'Sending…' : 'Send reset link'}
      </button>

      {message && <p className="text-green-600 mb-2">{message}</p>}
      {error && <p className="text-red-600 mb-2">{error}</p>}

      <div className="text-sm text-center">
        <a href="/login" className="text-blue-600 hover:underline">Back to Login</a>
      </div>
    </div>
  );
} 