'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSignup = async () => {
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match');
      return;
    }

    setErrorMsg('');
    setLoading(true);
    const {
      data: { user },
      error: signUpError,
    } = await supabase.auth.signUp({ email, password });

    if (signUpError) {
      if (signUpError.message?.toLowerCase().includes('already') || signUpError.status === 400) {
        setErrorMsg('An account with this email already exists. Forgot your password?');
      } else {
        setErrorMsg(signUpError.message);
      }
      setLoading(false);
      return;
    }

    if (!user) {
      setErrorMsg('User object not returned.');
      setLoading(false);
      return;
    }

    // Set first_name in user metadata
    const { error: metaError } = await supabase.auth.updateUser({ data: { first_name: firstName } });

    if (metaError) {
      setErrorMsg(metaError.message);
      setLoading(false);
      return;
    }

    // profiles.id is a FK to auth.users.id, so use id column directly
    const { error: insertError } = await supabase
      .from('profiles')
      .insert({ id: user.id, first_name: firstName });

    if (insertError) {
      setErrorMsg(insertError.message);
      setLoading(false);
      return;
    }

    // Success → go to new-workout
    router.push('/new-workout');
  };

  return (
    <div className="p-4 max-w-sm mx-auto">
      <h1 className="text-xl font-bold mb-4 text-center">Sign Up</h1>
      {errorMsg && (
        <div className="mb-2">
          <p className="text-red-500 text-sm mb-1">{errorMsg}</p>
          {errorMsg.toLowerCase().includes('already') && (
            <p className="text-sm">
              <a href="/forgot-password" className="text-blue-500 underline">
                Reset your password
              </a>
            </p>
          )}
        </div>
      )}
      <input
        className="border p-2 mb-2 block w-full rounded"
        placeholder="Email"
        type="email"
        value={email}
        onChange={(e) => { setEmail(e.target.value); setErrorMsg(''); }}
      />
      <input
        className="border p-2 mb-2 block w-full rounded"
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => { setPassword(e.target.value); setErrorMsg(''); }}
      />
      <input
        className="border p-2 mb-4 block w-full rounded"
        type="password"
        placeholder="Confirm Password"
        value={confirmPassword}
        onChange={(e) => { setConfirmPassword(e.target.value); setErrorMsg(''); }}
      />
      <input
        className="border p-2 mb-4 block w-full rounded"
        placeholder="First Name"
        value={firstName}
        onChange={(e) => { setFirstName(e.target.value); setErrorMsg(''); }}
      />
      <button
        disabled={loading}
        className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white px-4 py-2 rounded mb-4"
        onClick={handleSignup}
      >
        {loading ? 'Signing Up...' : 'Sign Up'}
      </button>

      <div className="text-sm text-center">
        <a href="/login" className="text-blue-600 hover:underline">Back to Login</a>
      </div>
    </div>
  );
} 