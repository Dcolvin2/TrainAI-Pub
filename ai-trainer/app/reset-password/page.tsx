'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

function ResetPasswordContent() {
  const searchParams = useSearchParams();

  // Supabase delivers tokens in the URL *hash* fragment (#) in production emails –
  // but during local tests we may get them as query params (?).  Handle both.
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [type, setType] = useState<string | null>(null);

  // Form state
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState('');
  const [sessionSet, setSessionSet] = useState(false);
  const [loading, setLoading] = useState(false);

  // ────────────────────────────────────────────────────────────
  // Parse tokens on first mount
  // ────────────────────────────────────────────────────────────
  useEffect(() => {
    // 1. Try the App Router-provided search params (covers ?access_token=…)
    let token = searchParams?.get('access_token');
    let t = searchParams?.get('type');
    let refTok = searchParams?.get('refresh_token');

    // 2. If none found, parse the hash fragment (covers #access_token=…)
    if (!token) {
      const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
      const hashParams = new URLSearchParams(hash);
      token = hashParams.get('access_token');
      t = hashParams.get('type');
      refTok = hashParams.get('refresh_token');
    }

    setAccessToken(token ?? null);
    setType(t ?? null);
    setRefreshToken(refTok ?? null);
  }, [searchParams]);

  // ────────────────────────────────────────────────────────────
  // Establish supabase session once we have a recovery token
  // ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (type === 'recovery' && accessToken) {
      supabase.auth
        .setSession({ access_token: accessToken, refresh_token: refreshToken ?? '' })
        .then(({ error }) => {
          if (error) {
            setStatus('Error confirming email: ' + error.message);
          } else {
            setSessionSet(true);
            setStatus('success');
          }
        });
    } else {
      setStatus('Invalid confirmation link.');
    }
  }, [accessToken, refreshToken, type]);

  // ────────────────────────────────────────────────────────────
  // Handle form submit: update the user password
  // ────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('');

    if (password !== confirmPassword) {
      setStatus('Passwords do not match.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setStatus('Update error: ' + error.message);
    } else {
      setStatus('Password updated! You can now log in.');
    }
  };

  // ────────────────────────────────────────────────────────────
  // UI
  // ────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '2rem', maxWidth: 400, margin: '0 auto', textAlign: 'center' }}>
      <h2>Reset Password</h2>

      {!sessionSet && (
        <p style={{ color: 'red' }}>Auth session missing or invalid link!</p>
      )}

      <form onSubmit={handleSubmit}>
        <input
          type="password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ display: 'block', margin: '1rem auto', width: '100%', padding: '0.5rem' }}
        />
        <input
          type="password"
          placeholder="Confirm password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          style={{ display: 'block', margin: '1rem auto', width: '100%', padding: '0.5rem' }}
        />
        <button
          type="submit"
          disabled={!sessionSet || loading}
          style={{ padding: '0.75rem 1.5rem', cursor: loading ? 'not-allowed' : 'pointer' }}
        >
          {loading ? 'Updating…' : 'Update Password'}
        </button>
      </form>

      {status && <p style={{ marginTop: '1rem' }}>{status}</p>}

      <p style={{ marginTop: '2rem' }}>
        <a href="/login">← Back to Login</a>
      </p>
    </div>
  );
}

export default function ResetPassword() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
} 