'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function ChangeEmailPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = async () => {
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ email });
    setLoading(false);

    if (error) {
      alert(error.message);
    } else {
      setSent(true);
    }
  };

  return (
    <div className="p-4 max-w-sm mx-auto">
      <h1 className="text-xl font-bold mb-4 text-center">Change Email</h1>
      {sent ? (
        <p className="text-center text-green-600">Check your inbox to confirm the new email.</p>
      ) : (
        <>
          <input
            className="border p-2 mb-4 block w-full rounded"
            type="email"
            placeholder="New Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button
            disabled={loading || !email}
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white px-4 py-2 rounded"
            onClick={handleChange}
          >
            {loading ? 'Updating...' : 'Change my email'}
          </button>
        </>
      )}
    </div>
  );
} 