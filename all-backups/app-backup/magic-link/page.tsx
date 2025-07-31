'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function MagicLinkPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      },
    });
    setLoading(false);

    if (error) {
      alert(error.message);
    } else {
      setSent(true);
    }
  };

  return (
    <div className="p-4 max-w-sm mx-auto">
      <h1 className="text-xl font-bold mb-4 text-center">Magic Link Login</h1>
      {sent ? (
        <p className="text-center text-green-600">Check your inbox for the magic link.</p>
      ) : (
        <>
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
            {loading ? 'Sending...' : 'Send magic link'}
          </button>
        </>
      )}

      <div className="text-sm text-center">
        <a href="/login" className="text-blue-600 hover:underline">Back to Login</a>
      </div>
    </div>
  );
} 