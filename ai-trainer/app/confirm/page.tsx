'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function ConfirmPage() {
  const searchParams = useSearchParams();

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    // parse access_token and type from either search or hash
    let token = searchParams?.get('access_token');
    let t = searchParams?.get('type');
    if (!token) {
      const hash = typeof window !== 'undefined' && window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
      const params = new URLSearchParams(hash);
      token = params.get('access_token');
      t = params.get('type');
    }

    if (t === 'signup' && token) {
      supabase.auth
        .setSession({ access_token: token, refresh_token: '' })
        .then(({ error }) => {
          if (error) {
            setStatus('error');
            setMessage('Error confirming email: ' + error.message);
          } else {
            setStatus('success');
            setMessage('✅ Email confirmed! You can now log in.');
          }
        });
    } else {
      setStatus('error');
      setMessage('Invalid confirmation link.');
    }
  }, [searchParams]);

  return (
    <div style={{ padding: '2rem', maxWidth: 400, margin: '0 auto', textAlign: 'center' }}>
      {status === 'loading' && <p>Confirming your email…</p>}
      {status === 'success' && <p style={{ color: 'green' }}>{message}</p>}
      {status === 'error' && <p style={{ color: 'red' }}>{message}</p>}
      {status === 'success' && (
        <p style={{ marginTop: '1rem' }}>
          <a href="/login" style={{ color: '#3b82f6' }}>Go to Login →</a>
        </p>
      )}
    </div>
  );
} 